//! SEC-2026-05-09 Pass-11 — end-to-end slashing execution pipeline.
//!
//! This module closes the second HARD mainnet blocker from
//! `docs/SUBSYSTEM-MATURITY-AUDIT-2026-05-09.md`: the consensus
//! remote-equivocation detector verified evidence and emitted a
//! `tracing::error!("SLASHABLE")` log, but no on-chain consequence
//! followed. There was no submission to `SlashingRegistryV2`, no
//! finalization tick, no stake-burn against `ValidatorSet`.
//!
//! `SlashingPipeline` ties the pieces together:
//!
//! ```text
//!   Detector                 Pipeline                 State
//!   ─────────                 ────────                 ─────
//!  HotStuff::on_vote
//!     │ RemoteEquivocation
//!     ▼
//!  EvidenceStore.put_evidence ──┐
//!                                ▼
//!                       Registry::submit_evidence ──► EvidenceStore.put_record
//!                                                       (status = Pending,
//!                                                        appeal_deadline)
//!
//!  per-block tick:
//!     Pipeline::tick_finalize(current_block)
//!     ├─ load_records_ready_to_finalize     (status==Pending && now>deadline)
//!     ├─ Registry::finalize_slash           (status → Confirmed)
//!     ├─ EvidenceStore.put_record           (persist transition)
//!     └─ ValidatorSet.apply_slash_burn      (debit self_stake, jail)
//! ```
//!
//! # Honest scope (Pass-11)
//!
//! - **In-scope**: pipeline orchestration, persistence wiring, the
//!   actual stake debit + jail on `ValidatorSet`, idempotency,
//!   restart-safety, deterministic in-memory E2E tests covering
//!   detection → submission → finalization → state mutation.
//! - **Deferred**: whistleblower-bond escrow against `StateDB`
//!   (currently in-memory in `SlashingRegistryV2.pending_bonds`),
//!   on-chain governance appeal flow, cross-validator correlated
//!   slashing on the SAME equivocation by multiple reporters
//!   (current path supports correlated *epochs*, not co-witness).
//!   These are explicitly documented and do NOT silently degrade
//!   security — they are conservative omissions.

use crate::error::StakingError;
use crate::persistence::{EvidenceStore, evidence_to_double_sign};
use crate::slashing_v2::{SlashingRegistryV2, SlashEvidenceRecord};
use crate::validator::{ValidatorSet, ValidatorStatus};
use zbx_consensus::vote::EquivocationEvidence;
use zbx_types::{address::Address, H256};
use parking_lot::{Mutex, RwLock};
use std::sync::Arc;
use tracing::{info, warn, error};

/// Outcome of `tick_finalize` per record.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AppliedSlash {
    pub record_id:        H256,
    pub offender:         Address,
    pub burn_wei:         u128,
    /// Whistleblower reward portion (already deducted from `burn_wei`).
    pub whistleblower_wei: u128,
    pub whistleblower:    Address,
    pub jailed:           bool,
}

/// End-to-end slashing pipeline.
///
/// Holds references to the durable evidence store, the in-memory
/// (but persistence-backed) registry, and the live validator set.
/// All three are `Arc` because consensus driver, RPC, and
/// pipeline-tick task share them.
#[derive(Clone)]
pub struct SlashingPipeline {
    store:      EvidenceStore,
    registry:   Arc<Mutex<SlashingRegistryV2>>,
    /// Validator set is shared with the RPC layer (`rpc_state.validator_set`)
    /// so a stake-burn here is visible to `eth_getBalance` / staking views
    /// without a refresh tick. parking_lot RwLock matches the node's choice.
    validators: Arc<RwLock<ValidatorSet>>,
}

impl SlashingPipeline {
    pub fn new(
        store:      EvidenceStore,
        registry:   Arc<Mutex<SlashingRegistryV2>>,
        validators: Arc<RwLock<ValidatorSet>>,
    ) -> Self {
        Self { store, registry, validators }
    }

    /// Bootstrap the in-memory `SlashingRegistryV2` from persisted
    /// records. Called at node startup so a crash mid-window does
    /// not lose pending slashes.
    ///
    /// Returns the count of records rehydrated (informational).
    pub fn rehydrate_from_disk(&self) -> Result<usize, StakingError> {
        let records = self.store.load_all_records()?;
        let n = records.len();
        if n == 0 {
            return Ok(0);
        }
        let mut reg = self.registry.lock();
        for rec in records {
            reg.insert_rehydrated_record(rec);
        }
        info!(rehydrated = n, "slashing pipeline: records rehydrated from disk");
        Ok(n)
    }

    /// Ingest one freshly-detected `EquivocationEvidence`. The full
    /// happy path:
    ///
    /// 1. Re-verify (defence-in-depth — the detector also verified,
    ///    but a corrupted in-memory copy or test injection might not
    ///    have).
    /// 2. Persist evidence (durable, idempotent on content hash).
    /// 3. Convert to `SlashEvidenceV2::DoubleSign`.
    /// 4. Submit to `SlashingRegistryV2` (computes correlated slash,
    ///    sets `appeal_deadline = current_block + APPEAL_WINDOW`).
    /// 5. Persist the resulting `SlashEvidenceRecord`.
    ///
    /// Returns the registry record ID. If the evidence was already
    /// submitted (deduplication via offender/block/type tuple in
    /// `SlashEvidenceRecord::compute_id`), returns `Ok(existing_id)`
    /// rather than an error — the caller treats re-detection as
    /// idempotent.
    pub fn ingest_equivocation(
        &self,
        ev:               &EquivocationEvidence,
        submitter:        Address,
        current_block:    u64,
        current_epoch:    u64,
        offender_stake:   u128,
    ) -> Result<H256, StakingError> {
        if !ev.verify() {
            error!(validator = ?ev.validator,
                   "rejecting equivocation evidence — verify() returned false");
            return Err(StakingError::InvalidEvidence(
                "evidence failed BLS / structural re-verification".into()));
        }

        // 1. Persist raw evidence (idempotent).
        let _evidence_id = self.store.put_evidence(ev)?;

        // 2. Convert + submit. The registry computes the slash amount
        //    and appeal deadline.
        let evidence_v2 = evidence_to_double_sign(ev);
        let mut reg = self.registry.lock();
        let record_id = match reg.submit_evidence(
            evidence_v2,
            submitter,
            current_block,
            current_epoch,
            offender_stake,
        ) {
            Ok(id) => id,
            Err(StakingError::DuplicateEvidence) => {
                // Re-detection of an already-submitted equivocation.
                // Idempotent — return the existing record's ID.
                let id = SlashEvidenceRecord::compute_id_for_offender(
                    &ev.validator, current_block,
                    crate::slashing_v2::EvidenceType::DoubleSign,
                );
                debug_assert!(reg.get_record(&id).is_some(),
                              "DuplicateEvidence implies record exists");
                warn!(record_id = ?id, validator = ?ev.validator,
                      "equivocation re-detected — idempotent submission");
                return Ok(id);
            }
            Err(e) => return Err(e),
        };

        // 3. Persist the freshly-created record. Drop the lock first
        //    to avoid holding it across an fsync.
        let record = reg.get_record(&record_id)
            .cloned()
            .ok_or_else(|| StakingError::Persistence(
                "submitted record vanished from registry".into()))?;
        drop(reg);
        self.store.put_record(&record)?;

        info!(
            record_id = ?record_id,
            offender = ?ev.validator,
            slash_wei = record.final_slash_wei,
            appeal_deadline = record.appeal_deadline,
            "equivocation evidence submitted to slashing pipeline"
        );
        Ok(record_id)
    }

    /// Per-block tick — finalize any records whose appeal window
    /// has closed and apply the stake burn.
    ///
    /// The state mutation order is:
    /// 1. `Registry::finalize_slash` flips status → `Confirmed`.
    /// 2. We persist the updated record (commit-before-burn so a
    ///    crash between burn and persist cannot un-slash).
    /// 3. `ValidatorSet::apply_slash_burn` debits `self_stake`,
    ///    transitions `status` to `Jailed`, and credits the
    ///    whistleblower reward to the submitter's pending_rewards.
    ///
    /// Idempotent: replaying the tick on the same `current_block`
    /// is a no-op because finalize moves status away from `Pending`.
    pub fn tick_finalize(
        &self,
        current_block: u64,
    ) -> Result<Vec<AppliedSlash>, StakingError> {
        let ready = self.store.load_records_ready_to_finalize(current_block)?;
        if ready.is_empty() {
            return Ok(Vec::new());
        }

        let mut applied = Vec::with_capacity(ready.len());
        for rec in ready {
            // Only finalize if registry still says Pending — guards
            // against a concurrent appeal between disk-load and
            // finalize.
            let result = {
                let mut reg = self.registry.lock();
                reg.finalize_slash(rec.id, current_block)?
            };

            let Some((slash_wei, submitter, reward_wei)) = result else {
                // Registry already moved it (e.g., appealed since
                // last load). Skip.
                continue;
            };

            // SEC-2026-05-09 Pass-11 (architect-review follow-up):
            // ATOMICITY. We MUST NOT early-return on persist failure
            // between finalize and burn — that would leave the
            // in-memory registry as Confirmed but the on-disk record
            // as Pending AND skip the burn for the rest of this
            // process lifetime. Two changes:
            //   1. Re-fetch + persist BEFORE the burn (so the burn
            //      only runs if the on-disk transition is durable).
            //   2. If persist fails, propagate the error WITHOUT
            //      doing the burn — the next tick (or a restart +
            //      rehydrate) will re-attempt finalization. The
            //      registry's `finalize_slash` is idempotent on
            //      already-Confirmed records, so re-application is
            //      safe.
            let updated = {
                let reg = self.registry.lock();
                reg.get_record(&rec.id).cloned()
            };
            let Some(r) = updated else {
                // Should be impossible — finalize_slash just produced
                // a result for this id. Treat as a hard inconsistency.
                return Err(StakingError::Persistence(format!(
                    "post-finalize record {:?} vanished from registry",
                    rec.id
                )));
            };
            // Persist the Confirmed record FIRST. If this fails the
            // burn is intentionally skipped and the caller (consensus
            // driver) panics — re-attempt happens on next process.
            self.store.put_record(&r)?;

            // State mutation: burn from validator's self_stake +
            // jail. Whistleblower reward credited to submitter's
            // pending_rewards.
            let jailed = {
                let mut vs = self.validators.write();
                apply_slash_burn(&mut vs, rec.offender, slash_wei,
                                  submitter, reward_wei)
            };

            applied.push(AppliedSlash {
                record_id:        rec.id,
                offender:         rec.offender,
                burn_wei:         slash_wei,
                whistleblower_wei: reward_wei,
                whistleblower:    submitter,
                jailed,
            });

            info!(
                record_id = ?rec.id,
                offender = ?rec.offender,
                burn_wei = slash_wei,
                whistleblower_wei = reward_wei,
                jailed,
                "slashing pipeline: stake burnt + validator jailed",
            );
        }
        Ok(applied)
    }

    pub fn pending_count(&self) -> usize {
        self.registry.lock().pending_count()
    }
}

/// Apply a confirmed slash to the validator set.
///
/// - Debits `slash_wei` from the offender's `self_stake` (saturating
///   at zero — over-slash should be impossible because the registry
///   computed `slash_wei` from `offender_stake` at submission time,
///   but stake may have been withdrawn since; saturating is safer
///   than panic).
/// - Transitions offender to `Jailed` if they were `Active`.
/// - Credits `reward_wei` to the whistleblower's `pending_rewards`
///   (no-op if whistleblower is not a registered validator — bonds
///   for non-validator submitters are tracked in
///   `SlashingRegistryV2.pending_bonds` and paid out via the bond
///   escrow path, deferred to a later sprint).
///
/// Returns `true` if the offender was newly jailed.
pub fn apply_slash_burn(
    vs:                   &mut ValidatorSet,
    offender:             Address,
    slash_wei:            u128,
    whistleblower:        Address,
    whistleblower_reward: u128,
) -> bool {
    let mut newly_jailed = false;
    if let Some(v) = vs.validators.get_mut(&offender) {
        let actual = slash_wei.min(v.self_stake);
        v.self_stake = v.self_stake.saturating_sub(actual);
        if v.status == ValidatorStatus::Active {
            v.status = ValidatorStatus::Jailed;
            newly_jailed = true;
        }
    } else {
        warn!(?offender,
              "slash: offender not in validator set — no stake to burn");
    }
    if let Some(w) = vs.validators.get_mut(&whistleblower) {
        w.pending_rewards = w.pending_rewards.saturating_add(whistleblower_reward);
    }
    // The active set may need rotation if the offender was a member.
    vs.active_set.retain(|a| *a != offender);
    newly_jailed
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::slashing_v2::{SlashingRegistryV2, EvidenceType};
    use crate::validator::{Validator, ValidatorStatus};
    use zbx_consensus::vote::{Vote, VoteData};
    use zbx_crypto::bls::BlsPrivKey;
    use zbx_storage::ZbxDb;
    use tempfile::TempDir;

    const STAKE: u128 = 100_000 * 10u128.pow(18);

    fn fresh_pipeline() -> (TempDir, SlashingPipeline, BlsPrivKey, Address) {
        let tmp = TempDir::new().unwrap();
        let db  = Arc::new(ZbxDb::open(tmp.path()).unwrap());
        let store = EvidenceStore::new(db);
        let registry = Arc::new(Mutex::new(SlashingRegistryV2::new(10)));

        let offender = Address([0xaa; 20]);
        let sk = BlsPrivKey::from_bytes(&[42u8; 32]).unwrap();
        let pk = sk.to_pubkey();

        let mut vs = ValidatorSet::new();
        vs.validators.insert(offender, Validator {
            address: offender, bls_pubkey: pk,
            self_stake: STAKE, delegated_stake: 0,
            commission_bps: 500, status: ValidatorStatus::Active,
            last_signed_block: 0, pending_rewards: 0,
            delegator_reward_pool: 0, pool_denominator: 0, registered_epoch: 0,
        });
        vs.active_set = vec![offender];
        let validators = Arc::new(RwLock::new(vs));

        (tmp, SlashingPipeline::new(store, registry, validators), sk, offender)
    }

    fn mk_evidence(sk: &BlsPrivKey, addr: Address,
                    hash_a: H256, hash_b: H256) -> EquivocationEvidence {
        let pk = sk.to_pubkey();
        let mk_vote = |h: H256| {
            let data = VoteData {
                block_hash: h, block_number: 5, phase: 0, epoch: 0,
            };
            let sig_msg = zbx_crypto::keccak::keccak256(&data.signing_bytes());
            let sig = sk.sign(&sig_msg);
            Vote { data, voter: addr, signature: sig }
        };
        EquivocationEvidence {
            validator: addr, round: 5, phase: 0,
            vote_a: mk_vote(hash_a),
            vote_b: mk_vote(hash_b),
            pubkey: pk,
        }
    }

    #[test]
    fn full_flow_ingest_finalize_burn() {
        let (_tmp, pipeline, sk, offender) = fresh_pipeline();
        let ev = mk_evidence(&sk, offender,
                              H256([1u8; 32]), H256([2u8; 32]));
        let submitter = Address([0xbb; 20]);

        // 1. Submit
        let id = pipeline.ingest_equivocation(
            &ev, submitter, /*block*/ 1, /*epoch*/ 0, STAKE).unwrap();
        assert_eq!(pipeline.pending_count(), 1);

        // 2. Tick before deadline → no-op
        let none = pipeline.tick_finalize(100).unwrap();
        assert!(none.is_empty(), "tick before appeal deadline must no-op");

        // 3. Tick after deadline → finalize + burn
        let applied = pipeline.tick_finalize(
            crate::slashing_v2::APPEAL_WINDOW_BLOCKS + 10).unwrap();
        assert_eq!(applied.len(), 1);
        let a = &applied[0];
        assert_eq!(a.record_id, id);
        assert_eq!(a.offender, offender);
        assert!(a.burn_wei > 0);
        assert!(a.jailed);

        // 4. Validator state mutation
        {
            let vs = pipeline.validators.read();
            let v = vs.validators.get(&offender).unwrap();
            assert_eq!(v.self_stake, STAKE - a.burn_wei);
            assert_eq!(v.status, ValidatorStatus::Jailed);
            assert!(!vs.active_set.contains(&offender),
                    "jailed validator must be removed from active set");
        }
    }

    #[test]
    fn ingest_rejects_unverified_evidence() {
        let (_tmp, pipeline, sk, offender) = fresh_pipeline();
        let mut ev = mk_evidence(&sk, offender,
                                  H256([1u8; 32]), H256([2u8; 32]));
        // Tamper with vote_b's hash so the cached signature no
        // longer matches → verify() returns false.
        ev.vote_b.data.block_hash = H256([99u8; 32]);
        let err = pipeline.ingest_equivocation(
            &ev, Address([0xbb; 20]), 1, 0, STAKE).unwrap_err();
        match err {
            StakingError::InvalidEvidence(_) => {}
            e => panic!("expected InvalidEvidence, got {e:?}"),
        }
    }

    #[test]
    fn re_detection_is_idempotent() {
        let (_tmp, pipeline, sk, offender) = fresh_pipeline();
        let ev = mk_evidence(&sk, offender,
                              H256([1u8; 32]), H256([2u8; 32]));
        let submitter = Address([0xbb; 20]);

        let id1 = pipeline.ingest_equivocation(
            &ev, submitter, 1, 0, STAKE).unwrap();
        let id2 = pipeline.ingest_equivocation(
            &ev, submitter, 1, 0, STAKE).unwrap();
        assert_eq!(id1, id2, "re-detection must return same record ID");
        assert_eq!(pipeline.pending_count(), 1);
    }

    #[test]
    fn rehydrate_restores_records_after_restart() {
        // Persist a record under one pipeline, then build a fresh
        // pipeline against the same DB — rehydrate must restore the
        // pending record so finalize still fires.
        let tmp = TempDir::new().unwrap();
        let path = tmp.path().to_owned();
        let offender = Address([0xcc; 20]);
        let sk = BlsPrivKey::from_bytes(&[88u8; 32]).unwrap();

        // Phase A: ingest, then drop everything.
        let id = {
            let db  = Arc::new(ZbxDb::open(&path).unwrap());
            let store = EvidenceStore::new(db);
            let registry = Arc::new(Mutex::new(SlashingRegistryV2::new(10)));
            let mut vs = ValidatorSet::new();
            vs.validators.insert(offender, Validator {
                address: offender, bls_pubkey: sk.to_pubkey(),
                self_stake: STAKE, delegated_stake: 0,
                commission_bps: 500, status: ValidatorStatus::Active,
                last_signed_block: 0, pending_rewards: 0,
                delegator_reward_pool: 0, pool_denominator: 0, registered_epoch: 0,
            });
            vs.active_set = vec![offender];
            let validators = Arc::new(RwLock::new(vs));
            let pipeline = SlashingPipeline::new(store, registry, validators);

            let ev = mk_evidence(&sk, offender,
                                  H256([1; 32]), H256([2; 32]));
            pipeline.ingest_equivocation(
                &ev, Address([0xbb; 20]), 1, 0, STAKE).unwrap()
        };

        // Phase B: fresh pipeline, same DB. Rehydrate + finalize.
        let db2 = Arc::new(ZbxDb::open(&path).unwrap());
        let store2 = EvidenceStore::new(db2);
        let registry2 = Arc::new(Mutex::new(SlashingRegistryV2::new(10)));
        let mut vs2 = ValidatorSet::new();
        vs2.validators.insert(offender, Validator {
            address: offender, bls_pubkey: sk.to_pubkey(),
            self_stake: STAKE, delegated_stake: 0,
            commission_bps: 500, status: ValidatorStatus::Active,
            last_signed_block: 0, pending_rewards: 0,
            delegator_reward_pool: 0, pool_denominator: 0, registered_epoch: 0,
        });
        vs2.active_set = vec![offender];
        let validators2 = Arc::new(RwLock::new(vs2));
        let pipeline2 = SlashingPipeline::new(
            store2, registry2.clone(), validators2);

        let n = pipeline2.rehydrate_from_disk().unwrap();
        assert_eq!(n, 1, "must rehydrate the persisted record");
        assert_eq!(pipeline2.pending_count(), 1);

        // Finalize after window
        let applied = pipeline2.tick_finalize(
            crate::slashing_v2::APPEAL_WINDOW_BLOCKS + 10).unwrap();
        assert_eq!(applied.len(), 1);
        assert_eq!(applied[0].record_id, id);
        assert!(applied[0].jailed);
    }

    #[test]
    fn appealed_record_is_not_finalized() {
        let (_tmp, pipeline, sk, offender) = fresh_pipeline();
        let ev = mk_evidence(&sk, offender,
                              H256([1; 32]), H256([2; 32]));
        let id = pipeline.ingest_equivocation(
            &ev, Address([0xbb; 20]), 1, 0, STAKE).unwrap();

        // File appeal before deadline
        pipeline.registry.lock().file_appeal(id, 100).unwrap();

        // Tick after deadline → still no burn (status=Appealed)
        let applied = pipeline.tick_finalize(
            crate::slashing_v2::APPEAL_WINDOW_BLOCKS + 10).unwrap();
        assert!(applied.is_empty(), "appealed record must not auto-finalize");
        let vs = pipeline.validators.read();
        assert_eq!(vs.validators.get(&offender).unwrap().self_stake, STAKE,
                   "no stake burnt while under appeal");
    }
}
