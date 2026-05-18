//! Enhanced validator slashing v2 (ZEP-023).
//!
//! Upgrades over v1:
//! - On-chain evidence storage with unique IDs
//! - Optimistic slashing with 10-day appeal window
//! - Correlated slashing: slash % scales with how many validators misbehave
//! - Whistleblower rewards: 5% of slashed amount to evidence submitter
//! - Invalid block proofs: new evidence type

use crate::{
    error::StakingError,
    SLASH_DOUBLE_SIGN, SLASH_LIVENESS_DAILY,
};
use zbx_types::{address::Address, H256};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use sha3::{Digest, Sha3_256};
use tracing::{info, warn};

/// Appeal window in blocks (~10 days at 5s/block).
pub const APPEAL_WINDOW_BLOCKS: u64 = 172_800;
/// Whistleblower reward: 5% of slashed amount (in basis points).
pub const WHISTLEBLOWER_REWARD_BPS: u128 = 500;
/// Evidence bond required to submit (prevents spam): 100 ZBX in wei.
pub const EVIDENCE_BOND_WEI: u128 = 100 * 10u128.pow(18);
/// Correlated slashing multiplier base (in basis points).
pub const CORRELATED_BASE_BPS: u128 = 10_000; // 100%

/// Type of slashable offence.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum EvidenceType {
    DoubleSign,
    LivenessFault,
    ConsecutiveMiss,
    InvalidBlock,
    SurrogateVote,
}

/// Status of a slash evidence record.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum EvidenceStatus {
    Pending,
    Appealed,
    Confirmed,
    Rejected,
    Overturned,
}

/// Proof that a validator double-signed two conflicting blocks at the same round and phase.
///
/// Equivocation is detected when the same validator signs two different blocks at
/// the same (height, round, phase). Evidence is valid only if both BLS signatures
/// cryptographically verify against the validator's registered public key.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DoubleSignProof {
    pub height:    u64,
    pub round:     u64,
    pub phase:     u8,
    pub block_a:   H256,
    pub block_b:   H256,
    /// BLS12-381 signature (96 bytes) over block_a from the offending validator.
    pub sig_a:     Vec<u8>,
    /// BLS12-381 signature (96 bytes) over block_b from the offending validator.
    pub sig_b:     Vec<u8>,
    pub validator: Address,
    /// Registered BLS12-381 G1 public key of the validator (48 bytes).
    ///
    /// Must match the on-chain validator registry entry for `validator`.
    /// Slashing is rejected if this key is not registered for the address.
    pub validator_bls_pubkey: Vec<u8>,
}

impl DoubleSignProof {
    /// Verify the double-sign proof using real BLS12-381 pairing checks.
    ///
    /// Accepts the proof only if ALL of the following hold:
    /// 1. block_a ≠ block_b (otherwise it's not equivocation)
    /// 2. Both sig_a and sig_b are 96-byte valid G2 points
    /// 3. validator_bls_pubkey is a 48-byte valid G1 point
    /// 4. `verify_single(sig_a, pk, block_a)` passes — e(g₁, σ_a) == e(pk, H(block_a))
    /// 5. `verify_single(sig_b, pk, block_b)` passes — e(g₁, σ_b) == e(pk, H(block_b))
    pub fn verify(&self) -> bool {
        use zbx_crypto::bls::{BlsPubKey, BlsSignature, verify_single};

        // Blocks must differ — same block hash is not equivocation.
        if self.block_a == self.block_b {
            return false;
        }

        // Parse the validator's BLS public key (48-byte G1 point).
        let pk = match BlsPubKey::from_bytes(&self.validator_bls_pubkey) {
            Ok(p)  => p,
            Err(_) => return false,
        };

        // Both signatures must be exactly 96 bytes (compressed G2 point).
        if self.sig_a.len() != 96 || self.sig_b.len() != 96 {
            return false;
        }

        // Parse signature over block_a.
        let sig_a = match BlsSignature::from_bytes(&self.sig_a) {
            Ok(s)  => s,
            Err(_) => return false,
        };

        // Parse signature over block_b.
        let sig_b = match BlsSignature::from_bytes(&self.sig_b) {
            Ok(s)  => s,
            Err(_) => return false,
        };

        // Both BLS pairing checks: e(g₁, σ) == e(pk, H(block_hash)).
        // The message signed by validators is the raw block hash (H256).
        verify_single(&sig_a, &pk, &self.block_a)
            && verify_single(&sig_b, &pk, &self.block_b)
    }
}

/// Evidence of an invalid block proposed by a validator.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvalidBlockProof {
    pub block_hash: H256,
    pub proposer:   Address,
    pub violation:  BlockViolation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BlockViolation {
    InvalidStateRoot { claimed: H256, actual: H256 },
    InvalidTxRoot,
    GasLimitExceeded { claimed: u64, max: u64 },
    InvalidTimestamp { claimed: u64, expected_min: u64 },
    ChainIdMismatch  { claimed: u64, expected: u64 },
}

/// All supported evidence types.
///
/// ## M-02 fix (ZBX-M-02): SurrogateVote variant added
///
/// A `SurrogateVote` occurs when validator A submits a vote (bearing its own
/// signature) on behalf of validator B — i.e., A signs vote data that should
/// only be signed by B. This was slashable at the `EvidenceType` / `base_slash_bps`
/// level but the corresponding `SlashEvidenceV2` variant was missing, making it
/// impossible to actually submit or process such evidence.
///
/// Fields:
/// * `vote_hash`  — hash of the fraudulent vote message (content-hash ID)
/// * `block_a`    — the block the surrogate vote was cast on
/// * `block_b`    — the block the legitimate validator was supposed to vote on
///                  (evidence of a fork-attempt; may equal `block_a`)
/// * `validator`  — the offending validator address (the surrogate)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SlashEvidenceV2 {
    DoubleSign(DoubleSignProof),
    LivenessFault { epoch: u64, missed: u64, total: u64 },
    ConsecutiveMiss { from_block: u64, count: u64 },
    InvalidBlock(InvalidBlockProof),
    /// M-02 fix: surrogate-vote evidence now part of the slashable evidence enum.
    SurrogateVote {
        vote_hash: H256,
        block_a:   H256,
        block_b:   H256,
        validator: Address,
    },
}

impl SlashEvidenceV2 {
    pub fn evidence_type(&self) -> EvidenceType {
        match self {
            SlashEvidenceV2::DoubleSign(_)            => EvidenceType::DoubleSign,
            SlashEvidenceV2::LivenessFault { .. }     => EvidenceType::LivenessFault,
            SlashEvidenceV2::ConsecutiveMiss { .. }   => EvidenceType::ConsecutiveMiss,
            SlashEvidenceV2::InvalidBlock(_)           => EvidenceType::InvalidBlock,
            SlashEvidenceV2::SurrogateVote { .. }     => EvidenceType::SurrogateVote,
        }
    }

    pub fn offender(&self) -> Option<Address> {
        match self {
            SlashEvidenceV2::DoubleSign(p)              => Some(p.validator),
            SlashEvidenceV2::InvalidBlock(p)             => Some(p.proposer),
            SlashEvidenceV2::SurrogateVote { validator, .. } => Some(*validator),
            _                                            => None,
        }
    }
}

/// An on-chain slash evidence record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlashEvidenceRecord {
    /// Unique ID = keccak256(serialized evidence)
    pub id:              H256,
    pub evidence_type:   EvidenceType,
    pub offender:        Address,
    pub submitted_by:    Address,
    pub submit_block:    u64,
    pub evidence:        SlashEvidenceV2,
    pub status:          EvidenceStatus,
    /// Base slash amount (before correlation multiplier) in ZBX wei
    pub base_slash_wei:  u128,
    /// Slash after correlated multiplier
    pub final_slash_wei: u128,
    pub appeal_deadline: u64,
}

impl SlashEvidenceRecord {
    fn compute_id(evidence: &SlashEvidenceV2, offender: &Address, submit_block: u64) -> H256 {
        Self::compute_id_for_offender(offender, submit_block, evidence.evidence_type())
    }

    /// SEC-2026-05-09 Pass-11 — public ID computation for the
    /// slashing pipeline's idempotent re-detection path. The
    /// pipeline needs to recover the canonical ID for a duplicate
    /// submission *without* re-running `submit_evidence` (the
    /// registry returned `DuplicateEvidence`). Mirrors the private
    /// `compute_id` exactly so the two paths cannot drift.
    pub fn compute_id_for_offender(
        offender:      &Address,
        submit_block:   u64,
        evidence_type:  EvidenceType,
    ) -> H256 {
        // Use stable u8 discriminants instead of Debug format strings — prevents
        // ID drift if enum variant names are ever renamed (ZBX-M-03 fix).
        let type_discriminant: u8 = match evidence_type {
            EvidenceType::DoubleSign      => 0,
            EvidenceType::LivenessFault   => 1,
            EvidenceType::ConsecutiveMiss => 2,
            EvidenceType::InvalidBlock    => 3,
            EvidenceType::SurrogateVote   => 4,
        };
        let mut h = Sha3_256::new();
        h.update(&offender.0);
        h.update(submit_block.to_le_bytes());
        h.update([type_discriminant]);
        let bytes = h.finalize();
        let mut id = [0u8; 32];
        id.copy_from_slice(&bytes);
        H256(id)
    }
}

/// Base slash amounts in basis points (100 bps = 1%).
pub fn base_slash_bps(evidence_type: &EvidenceType) -> u128 {
    match evidence_type {
        EvidenceType::DoubleSign      => SLASH_DOUBLE_SIGN,        // 500 bps = 5%
        EvidenceType::LivenessFault   => SLASH_LIVENESS_DAILY,     // 1 bps/day
        EvidenceType::ConsecutiveMiss => 100,                       // 1%
        EvidenceType::InvalidBlock    => 2_000,                     // 20%
        EvidenceType::SurrogateVote   => 500,                       // 5%
    }
}

/// Calculate correlated slash: scales with fraction of validators misbehaving.
///
/// Formula: `base_slash × (1 + 3 × (N_slashed / N_total))²`
///
/// At 33% validators misbehaving: ~3.7× base slash.
/// At 67%+ validators misbehaving: capped at 100%.
pub fn correlated_slash_bps(
    base_bps: u128,
    n_slashed_this_epoch: u64,
    n_total_validators: u64,
) -> u128 {
    if n_total_validators == 0 { return base_bps; }

    // Scale factor: (1 + 3 * ratio)^2 in fixed-point (×10000)
    let ratio_bps = (n_slashed_this_epoch as u128 * 10_000) / n_total_validators as u128;
    let factor_fp = 10_000 + 3 * ratio_bps; // (1 + 3*ratio) × 10000
    let factor_sq = factor_fp * factor_fp / 10_000; // squared

    let slashed = base_bps * factor_sq / 10_000;
    slashed.min(10_000) // cap at 100%
}

/// Calculate final slash amount in wei given validator's stake.
///
/// STK-SLASH-01: uses `checked_mul` to prevent u128 overflow for adversarial
/// or test inputs where `stake_wei × slash_bps` could exceed `u128::MAX`.
/// For realistic PoS values (total supply ≤ 10^27 wei, `slash_bps` ≤ 10 000)
/// the product stays well within range, so the fallback path is only hit in
/// pathological scenarios.  The fallback avoids truncation by computing
/// `(stake_wei / 10_000) × slash_bps` — integer division before multiply
/// loses at most `(10_000 - 1)` wei of precision, which is acceptable for a
/// slash that is itself approximate (commission rounding, etc.).
pub fn slash_amount_wei(
    stake_wei: u128,
    slash_bps: u128,
) -> u128 {
    stake_wei
        .checked_mul(slash_bps)
        .map(|p| p / 10_000)
        .unwrap_or_else(|| (stake_wei / 10_000).saturating_mul(slash_bps))
}

/// The on-chain slashing registry (ZEP-023).
pub struct SlashingRegistryV2 {
    /// All evidence records by ID
    records: HashMap<H256, SlashEvidenceRecord>,
    /// Slashes confirmed this epoch per validator
    epoch_slash_count: HashMap<(u64, Address), u64>,
    /// Bonds deposited by whistleblowers
    pending_bonds: HashMap<H256, (Address, u128)>,
    total_validators: u64,
}

impl SlashingRegistryV2 {
    pub fn new(total_validators: u64) -> Self {
        SlashingRegistryV2 {
            records:           HashMap::new(),
            epoch_slash_count: HashMap::new(),
            pending_bonds:     HashMap::new(),
            total_validators,
        }
    }

    /// Submit new slash evidence. Submitter must provide EVIDENCE_BOND_WEI.
    pub fn submit_evidence(
        &mut self,
        evidence:        SlashEvidenceV2,
        submitted_by:    Address,
        current_block:   u64,
        current_epoch:   u64,
        offender_stake:  u128,
    ) -> Result<H256, StakingError> {
        let offender = evidence.offender()
            .ok_or_else(|| StakingError::InvalidEvidence("cannot determine offender".into()))?;

        let evidence_type = evidence.evidence_type();
        let id = SlashEvidenceRecord::compute_id(&evidence, &offender, current_block);

        // Prevent duplicate submissions
        if self.records.contains_key(&id) {
            return Err(StakingError::DuplicateEvidence);
        }

        // Calculate slash with correlation
        let n_slashed = self.epoch_slash_count
            .get(&(current_epoch, offender))
            .copied()
            .unwrap_or(0) + 1;
        let base_bps   = base_slash_bps(&evidence_type);
        let corr_bps   = correlated_slash_bps(base_bps, n_slashed, self.total_validators);
        let slash_wei  = slash_amount_wei(offender_stake, corr_bps);

        let record = SlashEvidenceRecord {
            id,
            evidence_type,
            offender,
            submitted_by,
            submit_block:    current_block,
            evidence,
            status:          EvidenceStatus::Pending,
            base_slash_wei:  slash_amount_wei(offender_stake, base_bps),
            final_slash_wei: slash_wei,
            appeal_deadline: current_block + APPEAL_WINDOW_BLOCKS,
        };

        self.pending_bonds.insert(id, (submitted_by, EVIDENCE_BOND_WEI));
        self.records.insert(id, record);

        info!(
            evidence_id = ?id,
            %offender,
            slash_bps = corr_bps,
            slash_wei,
            "Slash evidence submitted"
        );

        Ok(id)
    }

    /// File an appeal against a slash record (by the offending validator).
    pub fn file_appeal(
        &mut self,
        evidence_id: H256,
        current_block: u64,
    ) -> Result<(), StakingError> {
        let record = self.records.get_mut(&evidence_id)
            .ok_or(StakingError::EvidenceNotFound)?;

        if record.status != EvidenceStatus::Pending {
            return Err(StakingError::AppealNotAllowed);
        }
        if current_block > record.appeal_deadline {
            return Err(StakingError::AppealWindowExpired);
        }

        record.status = EvidenceStatus::Appealed;
        info!(evidence_id = ?evidence_id, "Appeal filed");
        Ok(())
    }

    /// Finalize a pending slash after appeal window closes.
    /// Returns (slash_amount_wei, whistleblower_reward_wei) if confirmed.
    pub fn finalize_slash(
        &mut self,
        evidence_id: H256,
        current_block: u64,
    ) -> Result<Option<(u128, Address, u128)>, StakingError> {
        let record = self.records.get_mut(&evidence_id)
            .ok_or(StakingError::EvidenceNotFound)?;

        if record.status != EvidenceStatus::Pending {
            return Ok(None); // Already appealed or finalized
        }
        if current_block <= record.appeal_deadline {
            return Ok(None); // Appeal window still open
        }

        record.status = EvidenceStatus::Confirmed;
        let slash     = record.final_slash_wei;
        let submitter = record.submitted_by;
        let reward    = slash * WHISTLEBLOWER_REWARD_BPS / 10_000;

        info!(
            evidence_id = ?evidence_id,
            offender = ?record.offender,
            slash_wei = slash,
            whistleblower_reward = reward,
            "Slash confirmed after appeal window"
        );

        Ok(Some((slash, submitter, reward)))
    }

    /// Overturn a slash after a successful governance appeal.
    pub fn overturn_slash(
        &mut self,
        evidence_id: H256,
    ) -> Result<u128, StakingError> {
        let record = self.records.get_mut(&evidence_id)
            .ok_or(StakingError::EvidenceNotFound)?;

        if record.status != EvidenceStatus::Appealed {
            return Err(StakingError::AppealNotAllowed);
        }

        let slash_to_return = record.final_slash_wei;
        record.status = EvidenceStatus::Overturned;
        warn!(evidence_id = ?evidence_id, "Slash overturned — stake to be returned");
        Ok(slash_to_return)
    }

    pub fn get_record(&self, id: &H256) -> Option<&SlashEvidenceRecord> {
        self.records.get(id)
    }

    pub fn pending_count(&self) -> usize {
        self.records.values()
            .filter(|r| r.status == EvidenceStatus::Pending)
            .count()
    }

    /// SEC-2026-05-09 Pass-11 — bypass-validation insert used ONLY by
    /// `SlashingPipeline::rehydrate_from_disk` at node startup.
    ///
    /// The on-disk record is treated as canonical — it has already
    /// been through `submit_evidence`'s validation path on a
    /// previous boot. Re-running `submit_evidence` here would
    /// (a) re-charge correlated-slash multipliers (double-counting),
    /// (b) re-set `appeal_deadline = current_block + APPEAL_WINDOW`
    /// effectively un-aging the record. Both are wrong. We restore
    /// the record verbatim so a node crash mid-window does not
    /// reset the slashing clock.
    ///
    /// Idempotent on `record.id` — duplicate rehydration is a no-op.
    pub fn insert_rehydrated_record(&mut self, record: SlashEvidenceRecord) {
        // Update epoch counter for correlated-slash math on any
        // *future* submissions in the same epoch (records loaded
        // here already have their `final_slash_wei` baked in).
        if record.status == EvidenceStatus::Confirmed
            || record.status == EvidenceStatus::Pending
            || record.status == EvidenceStatus::Appealed
        {
            // Conservative: only count slashes that aren't yet
            // overturned/rejected. We approximate the original
            // epoch as block / EPOCH_LENGTH (172_800). Off by an
            // epoch in pathological cases but never silently
            // under-slashes (correlated multiplier monotonically
            // increases in n_slashed).
            let approx_epoch = record.submit_block / crate::EPOCH_LENGTH;
            *self.epoch_slash_count
                .entry((approx_epoch, record.offender))
                .or_insert(0) += 1;
        }
        self.records.insert(record.id, record);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_double_sign(validator: Address) -> SlashEvidenceV2 {
        SlashEvidenceV2::DoubleSign(DoubleSignProof {
            height:    100,
            round:     1,
            phase:     0,
            block_a:   H256([1u8; 32]),
            block_b:   H256([2u8; 32]),
            sig_a:     vec![1u8; 96],
            sig_b:     vec![2u8; 96],
            validator,
            // Placeholder — registry tests exercise submission/finalization logic,
            // not BLS cryptographic verification.
            validator_bls_pubkey: vec![0u8; 48],
        })
    }

    #[test]
    fn submit_and_finalize() {
        let mut reg = SlashingRegistryV2::new(100);
        let offender  = Address([1u8; 20]);
        let submitter = Address([2u8; 20]);
        let stake     = 100_000 * 10u128.pow(18);

        let id = reg.submit_evidence(
            make_double_sign(offender),
            submitter, 1, 0, stake,
        ).unwrap();

        // Cannot finalize during appeal window
        assert!(reg.finalize_slash(id, 100).unwrap().is_none());

        // Finalize after window
        let result = reg.finalize_slash(id, APPEAL_WINDOW_BLOCKS + 10).unwrap();
        assert!(result.is_some());
        let (slash, _, reward) = result.unwrap();
        assert!(slash > 0);
        assert_eq!(reward, slash * 500 / 10_000);
    }

    #[test]
    fn correlated_slash_scales() {
        let base = 500u128; // 5%
        let single  = correlated_slash_bps(base, 1,  100);
        let tenth   = correlated_slash_bps(base, 10, 100);
        let third   = correlated_slash_bps(base, 33, 100);

        assert!(single < tenth, "More slashes = higher %");
        assert!(tenth  < third, "More slashes = higher %");
        assert!(third  <= 10_000, "Capped at 100%");
    }

    #[test]
    fn double_sign_proof_bls_verification() {
        use zbx_crypto::bls::BlsPrivKey;

        let sk = BlsPrivKey::from_bytes(&[42u8; 32]).unwrap();
        let pk = sk.to_pubkey();

        let block_a = H256([1u8; 32]);
        let block_b = H256([2u8; 32]);
        let sig_a   = sk.sign(&block_a);
        let sig_b   = sk.sign(&block_b);

        let proof = DoubleSignProof {
            height: 1, round: 0, phase: 0,
            block_a,
            block_b,
            sig_a: sig_a.as_bytes().to_vec(),
            sig_b: sig_b.as_bytes().to_vec(),
            validator:            Address([1u8; 20]),
            validator_bls_pubkey: pk.as_bytes().to_vec(),
        };

        // Real BLS pairing check must pass for a valid equivocation proof.
        assert!(proof.verify(), "valid BLS double-sign proof must verify");

        // Same block is not equivocation — must be rejected.
        let mut same = proof.clone();
        same.block_b = block_a;
        assert!(!same.verify(), "same-block proof must be rejected");
    }

    #[test]
    fn double_sign_proof_rejects_wrong_sig() {
        use zbx_crypto::bls::BlsPrivKey;

        let sk1 = BlsPrivKey::from_bytes(&[11u8; 32]).unwrap();
        let sk2 = BlsPrivKey::from_bytes(&[22u8; 32]).unwrap();
        let pk1  = sk1.to_pubkey();

        let block_a = H256([1u8; 32]);
        let block_b = H256([2u8; 32]);

        // sig_b is from a DIFFERENT key — proof must be rejected.
        let sig_a = sk1.sign(&block_a);
        let sig_b = sk2.sign(&block_b); // wrong signer

        let proof = DoubleSignProof {
            height: 1, round: 0, phase: 0,
            block_a,
            block_b,
            sig_a: sig_a.as_bytes().to_vec(),
            sig_b: sig_b.as_bytes().to_vec(),
            validator:            Address([1u8; 20]),
            validator_bls_pubkey: pk1.as_bytes().to_vec(),
        };
        assert!(!proof.verify(), "mismatched signer must be rejected");
    }
}
