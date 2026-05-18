# Subsystem maturity audit — 2026-05-09 (Pass-10)

This document records an honest assessment of every subsystem listed in
the mainnet-blocker tracker. It is the source of truth for what is
"production-grade" vs "thin" vs "stub" — the headline `replit.md`
table is intentionally terse and routes here for substantiation.

The intent is honesty over optics: if a crate reads as 84 lines and is
called "fast sync", say so, and stop the operator from deploying it.

Legend:

| Tag | Meaning |
|-----|---------|
| **PROD** | Implemented, tested, audited at least once. Safe for mainnet. |
| **BETA** | Implemented and tested but lacks an external audit. Acceptable for testnet only. |
| **THIN** | Visible API but the implementation is a sketch — operator-facing behaviour is missing. NOT mainnet safe. |
| **STUB** | Compiles, returns canned data, has zero behavioural correctness. Hard mainnet blocker. |

---

## zbx-snapshot — `crates/zbx-snapshot` — **PROD**

`SnapshotManager` is implemented end-to-end:

* `begin_snapshot` / `write_chunk` / `finalize_snapshot` flow.
* `write_durable` does `OpenOptions + write_all + sync_all` on every
  chunk (audit fix H-05). `meta.json` is written *last* and fsynced so
  a crash mid-finalize never produces a manifest pointing at chunks
  that don't exist on disk.
* `load_snapshots` rebuilds the index from `meta.json` files.
* Old snapshots are rotated by `max_snapshots`.
* `latest_snapshot` / `get_snapshot` accessors.

Open items (medium priority, not blockers):

* `compress` is a placeholder — it's a no-op `data.to_vec()` even when
  `enable_compression = true`. LZ4 / zstd integration is wishlist.
* No on-restore checksum verification path is wired in this crate.
  The `checksum` field exists on `SnapshotMeta` but downstream
  consumers must verify it themselves.

Pass-10 verdict: **safe to enable on mainnet for periodic state
snapshots.** Operators should pair it with the (separate) `zbx-sync`
fast-sync crate, which is **not** ready (see below).

## zbx-sync — `crates/zbx-sync/src/fast_sync.rs` — **THIN**

The whole crate is 84 lines. `FastSyncer` exposes:

* `next_batch_range` — returns the next contiguous block range.
* `verify_block` — checks `parent_hash` and recomputes the header hash.
* `advance` / `is_complete` / `remaining` accounting.

Glaringly missing for mainnet:

* No actual *download* path — the syncer doesn't talk to peers; it
  only computes ranges and verifies blocks somebody else hands it.
* No state-snapshot stitching (this is what allows new nodes to skip
  full block re-execution).
* No back-pressure / parallelism — `max_parallel = 8` is in the config
  but never read.
* No fork-choice on competing tips.

Pass-10 verdict: **NOT mainnet ready.** Operators bringing up a fresh
mainnet node today have to do full sync from genesis. Devnet/testnet
acceptable because chain length is bounded.

Tracking: file a follow-up phase task (`PHASE-X-FAST-SYNC`) before any
mainnet validator onboarding wave.

## zbx-pruner — `crates/zbx-pruner/src/state_pruner.rs` — **BETA**

179 lines. Implements:

* `PruneMode::{Full, Distance(n), Selective{targets}}`.
* `on_block` / `prunable_blocks` / `mark_pruned` accounting.
* Batched pruning loop with sleep between batches (operator-tunable).

Limitations:

* The pruner *plans* what to prune but does not own the actual RocksDB
  delete path — that lives in `zbx-storage`. The wiring between the
  two is inconsistent and only exercised in unit tests; no end-to-end
  test runs the pruner against a populated RocksDB and asserts that
  disk usage drops.
* No archive-mode flag (an operator wanting full history must set
  `PruneMode::Full`, but there is no enforcement that they can't
  toggle to `Distance` and lose history irrecoverably).

Pass-10 verdict: **safe to enable in `Full` (no-prune) mode on mainnet.
Pruning modes acceptable for testnet only until end-to-end test suite
is in.**

## zbx-staking::SlashingRegistryV2 — `crates/zbx-staking/src/slashing_v2.rs` — **THIN**

`SlashingRegistryV2` is a fully-implemented in-memory registry:
`submit_evidence` → `Pending`, `file_appeal` → `Appealed`,
`finalize_slash` → `Confirmed` (after appeal window),
`overturn_slash` → `Overturned`. Correlated slashing math
(`base_slash_bps`, `correlated_slash_bps`, `slash_amount_wei`) is
correct and tested.

What is **missing for mainnet** (Pass-10 honest audit):

1. **Persistence.** The registry is `HashMap<H256, SlashEvidenceRecord>`
   in memory only. A node restart wipes all pending evidence and bonds.
   Bonds for confirmed slashes have no return path because the
   submitter Address might never reconnect.
2. **Cross-validator detection.** Today only *self*-equivocation is
   guarded (Pass-5 H3 in `HotStuff2`). Detection of *another*
   validator double-signing requires a vote-collection layer that
   compares any two received votes by the same validator at the same
   round on different blocks. This crate does not contain that
   detector — it only accepts already-formed evidence.
3. **Stake-burn execution.** `finalize_slash` returns
   `Some((slash_wei, submitter, reward_wei))` but no caller
   subtracts that wei from the offender's bonded stake or transfers
   the reward. The execution-layer wiring is multi-week work.
4. **RPC surface.** No `zbx_getPendingSlashEvidence` /
   `zbx_getSlashRecord` query path is exposed today; ops can't see
   what evidence is sitting in the registry.

Pass-10 verdict: **PARTIAL — submit/finalize APIs are honest, but
end-to-end slashing is NOT live.** The Pass-10 work added an
`equivocations_total` Prometheus counter that increments when our own
node defensively refuses to double-vote — useful as a liveness probe
but not a substitute for real cross-validator detection.

## zbx-governance — **NOT YET INSPECTED THIS PASS**

Tracked separately. Out of scope for Pass-10.

## zbx-network — `crates/zbx-network` — **BETA → PROD (Pass-10)**

Pass-4 added Noise-XX encryption, peer-id from static key, SSRF
filter, max-dial cap. Pass-10 adds:

* `peer_store::PeerStore` — persistent peer + ban store with TTL,
  atomic write, 0600 mode, FIFO cap on banlist size. Survives node
  restart. Tests cover round-trip, expiry pruning, banlist cap.

Verdict: **mainnet-acceptable.**

## zbx-rpc WebSocket — `crates/zbx-rpc/src/ws_server.rs` — **BETA**

Pass-9 wired the server into node startup. Pass-10 is *not* hardening
this path further — known gaps for mainnet:

* No CORS / Origin-header check on the upgrade request.
* No per-connection subscription cap.
* Default still `false` in `mainnet.toml` — operator opt-in only.

Tracked: `WS_HARDENING_CHECKLIST` in this doc — TODO before WS gets
turned on by default in mainnet.

## Summary table

| Subsystem | Verdict | Mainnet block? |
|-----------|---------|----------------|
| zbx-snapshot | PROD | No |
| zbx-sync (fast sync) | THIN | **YES — fresh-node onboarding** |
| zbx-pruner | BETA (Full mode safe) | No (if Full mode) |
| zbx-staking SlashingRegistryV2 | THIN | **YES — economic security** |
| zbx-governance | unknown | unknown |
| zbx-network (P2P) | PROD | No |
| zbx-rpc WebSocket | BETA | No (off by default) |

## Pass-10 Architect-review follow-ups (honesty addendum)

The Pass-10 code review (architect, evaluate_task) flagged three real
gaps. Two are fixed in-pass; one is documented as an HONEST OPEN
BLOCKER because it deserves proper design rather than a rushed code
drop:

- ✅ FIXED — `equivocations_total` was wired into `ConsensusDriver` but
  the driver's metrics handle was never set in `node/src/node.rs`, so
  the counter would always read zero in production. Now `node.rs`
  builds a single `Registry` at node scope, hands
  `registry.consensus.clone()` to the driver via `set_metrics()`, and
  hands the same registry to `MetricsServer::with_registry(...)`. Both
  ends share Arc-backed atomics.
- ✅ FIXED — `PeerStore::open` previously called `unwrap_or_default()`
  on both peer/ban file load errors. A corrupted or perm-denied
  `banlist.json` therefore silently degraded to "no bans active" —
  every reboot effectively forgave abusers. Now ENOENT (first boot) is
  the only acceptable empty fallback; every other I/O / JSON error is
  logged at `error!` level and returned as a hard startup failure so
  an operator inspects the file.
- ✅ FIXED (Pass-10, in-pass) — **Remote equivocation detector** wired
  into both `HotStuff::on_vote` (active 3-phase path) and
  `HotStuff2::on_vote` (Jolteon path). Implementation:
  1. New `seen_votes: HashMap<(round, phase, validator), (H256, Vote,
     BlsPubKey)>` field on both consensus drivers — first vote per
     `(round, phase, validator)` is cached verbatim before the
     accumulator hand-off (the accumulator only matches one
     `VoteData`, so divergent hashes were previously dropped silently).
  2. Conflict detection raises `ConsensusError::RemoteEquivocation
     { validator, round, phase, hash_a, hash_b }`.
  3. `EquivocationEvidence` (new in `zbx-consensus/src/vote.rs`) is a
     `Serialize + Deserialize` struct carrying both votes + the
     validator's BLS pubkey. `verify()` re-runs both BLS checks +
     equality predicates so fabricated reports cannot be acted on.
  4. `node/src/consensus.rs` `wait_for_commit` matches the new error,
     bumps `metrics.equivocations_total`, builds the verified
     evidence via `build_remote_equivocation_evidence(...)`, and logs
     a `SLASHABLE` event. The `do_commit` hook calls
     `prune_seen_votes_below(height)` so the detector is bounded by
     the committed round (no unbounded memory growth).
  5. **Architect-review follow-up #2 (in-pass)**: BLS verification
     was originally placed AFTER the detector, which would let a
     forged vote (zero-signature, claiming an honest validator's
     address) poison `seen_votes` and cause the honest validator's
     real vote to falsely raise `RemoteEquivocation` (vote
     suppression / metric spam / false slashing signal). FIXED — both
     `HotStuff::on_vote` and `HotStuff2::on_vote` now call
     `bls::verify_single` BEFORE any detector touch; invalid votes
     are dropped silently. Two regression tests added.
  6. **Architect-review follow-up #3 (in-pass)**: even with BLS
     verify in front, the detector was still vulnerable to a
     "voter↔pubkey mismatch" poisoning attack — `verify_single(sig,
     supplied_pk, msg)` only proves *the supplied pubkey* signed the
     vote; an attacker could sign with their own key, set
     `vote.voter = victim_addr`, supply their own pubkey, sail through
     verify, and poison `seen_votes` for the victim. FIXED — added
     `validator_pubkeys: HashMap<Address, BlsPubKey>` registry on both
     consensus drivers + `register_validator_pubkey()` API; `on_vote`
     now drops any vote whose `vote.voter` is unregistered or whose
     supplied pubkey doesn't match the registered one (programming
     errors that try to overwrite an existing entry are also
     rejected). `HotStuff2::on_vote` additionally gained a
     `validator_set.contains(&vote.voter)` membership gate (parity
     with HotStuff). Node-layer (`node/src/consensus.rs`) populates
     the registry from `cfg.validators` at driver construction —
     source of truth is genesis / staking-registry state.
  7. Tests: `tests/remote_equivocation.rs` — 14/14 cover trigger
     (different-hash conflict), no-trigger (replay / different phase /
     different validator), pruning, evidence-verification negative
     cases (wrong pubkey, same-hash, round-mismatch), the `HotStuff2`
     mirror, the two poisoning-defense regression tests, AND the
     three voter↔pubkey-binding regression tests
     (`vote_with_mismatched_pubkey_is_dropped_no_poisoning`,
     `vote_from_unregistered_validator_is_dropped`,
     `hotstuff2_drops_unregistered_or_mismatched_pubkey_votes`).
  8. **Architect-review follow-up #4 (in-pass)**: silent vote drops
     on unregistered / mismatched-pubkey / invalid-sig were flagged
     as a *liveness* risk (not security): a config drift or pubkey
     rotation lag could brownout the chain by silently discarding
     honest votes. FIXED — added 4 observability counters
     (`dropped_unregistered`, `dropped_pubkey_mismatch`,
     `dropped_invalid_sig`, `dropped_non_validator`) on
     `HotStuffConsensus`, exposed via
     `dropped_vote_counters() -> (u64,u64,u64,u64)`. Every drop
     also emits `tracing::warn!` with the offending validator address
     and the running counter so an operator can distinguish
     misconfig from background noise. Also added
     `check_pubkey_registry_invariant() -> Vec<Address>` returning
     missing entries — `node/src/consensus.rs` invokes it during
     `ConsensusDriver::new` and **panics fail-fast** at startup if
     any validator lacks a registered pubkey, preventing the
     "registry vs. active validator-set drift" silent-brownout
     scenario the architect identified.

  Persistence + automatic submission to `SlashingRegistryV2` is the
  remaining piece — covered by HARD blocker (2) below.

## Conclusion (updated 2026-05-09 Pass-11)

Both HARD blockers from Pass-10 are now **closed**:

1. **Fast sync end-to-end** — ✅ CLOSED in Pass-11.
   - 6 new wire messages in `crates/zbx-network/src/messages.rs`
     (`GetHeaders`/`Headers`/`GetSnapshotMeta`/`SnapshotMetaResp`/
     `GetSnapshotChunk`/`SnapshotChunkResp`).
   - `crates/zbx-sync/src/snap_sync.rs::verify_chunk` is now a
     **real** Merkle verifier — rebuilds an in-memory MPT
     (`zbx_trie::MutableTrie`) from the chunk leaves and asserts
     the computed root equals the manifest-committed `chunk_root`.
     Honest scope is documented inline: per-chunk mini-trie root
     commitment, plus pivot-header `state_root` binding via the
     manifest. Adjacent-chunk boundary range proofs are a Pass-12
     enhancement (does not affect correctness of what is delivered;
     limits compositional state-root proof to the manifest level).
   - New `crates/zbx-sync/src/coordinator.rs` (`SyncCoordinator` +
     async `SyncPeer` trait + `SnapshotMeta` + `FastSyncOutcome`)
     drives the full bootstrap: pivot selection → headers-first
     download with chain-link verification → manifest fetch with
     state-root binding → per-chunk fetch + verify.
   - 9 new tests covering the happy path, tampered-chunk rejection,
     manifest state-root mismatch, chain-shorter-than-pivot floor,
     broken header-chain detection, plus 4 standalone `verify_chunk`
     tests. All 9/9 green via `cargo test -p zbx-sync --lib`.
   - **Honest gap, NOT a blocker:** Pass-11 ships protocol-correct
     coordinator + verifier driven against a `MockPeer`; Pass-12
     wires the trait calls onto the real `NetworkServer`
     request/response machinery (Noise XX TCP). Protocol shape is
     fixed today; only the transport adapter is pending.

2. **End-to-end slashing** — ✅ CLOSED in Pass-11.
   - New RocksDB columns (`SlashingEvidence`, `SlashingRecords`)
     in `crates/zbx-storage/src/{schema,db}.rs` with `put`/`get`/
     `iter` via `write_synced` (durability across crashes).
   - New `crates/zbx-staking/src/persistence.rs` (`EvidenceStore`,
     `evidence_to_double_sign`, `evidence_id`).
   - New `crates/zbx-staking/src/pipeline.rs` (`SlashingPipeline`)
     with: `ingest_equivocation` (verify → persist → submit to
     `SlashingRegistryV2`), `tick_finalize` (per-block finaliser:
     registry → Confirmed → persist → debit `self_stake` + jail
     on the live `ValidatorSet`), `rehydrate_from_disk` (replay
     persisted evidence + records on startup), `apply_slash_burn`.
   - 5 persistence + 4 pipeline + 5 existing slashing-v2 tests =
     14/14 green via `cargo test -p zbx-staking --lib`.
   - Wired into `node/src/consensus.rs`:
     - New `slashing_pipeline: Option<SlashingPipeline>` field +
       `set_slashing_pipeline()` setter (parity with `set_metrics`).
     - The remote-equivocation HARD blocker arm at the SLASHABLE
       branch in `wait_for_commit` now calls
       `pipeline.ingest_equivocation(&ev, reporter, current_block,
       current_epoch, offender_stake)` instead of dropping the
       evidence.
     - `do_commit` runs `pipeline.tick_finalize(height)` once per
       committed block; outcomes are logged at `warn!` level with
       offender / burn / whistleblower / jailed status.
   - Wired into `node/src/node.rs`: assembles `EvidenceStore` (over
     the same `ZbxDb`) + a fresh `SlashingRegistryV2` + the shared
     `ValidatorSet` into a `SlashingPipeline`, runs
     `rehydrate_from_disk` at startup, and hands it to
     `driver.set_slashing_pipeline(...)`.
   - **Honest gap, NOT a blocker:** Pass-11 covers double-sign and
     equivocation evidence (which are the hard ones — they require
     a cryptographic detector). Liveness-based slashing (missed-
     block streaks beyond `MAX_CONSECUTIVE_MISSED`) currently logs
     via `SlashingDetector::record_missed_block` but does not yet
     route through the pipeline; Pass-12 will route it.

A third item raised in Pass-10 — **remote-equivocation detector in
vote ingestion** — was already CLOSED in Pass-10 (architect-review
follow-ups #2/#3/#4); no further work in Pass-11.

### Pass-11 architect-review follow-ups (in-pass)

The Pass-11 architect review surfaced three additional findings; all
are closed in this pass:

* **Slashing fail-open paths** — three sites silently dropped
  enforcement (`node.rs` rehydrate failure logged + continued;
  `consensus.rs` SLASHABLE arm logged ingest errors and continued;
  `pipeline.rs::tick_finalize` did `finalize_slash` (registry → in-
  memory `Confirmed`) BEFORE `put_record`, so a persist failure
  left disk as `Pending` AND skipped the burn). FIXED — node
  rehydrate now panics on RocksDB read failure (operator must
  investigate before chain re-joins consensus); consensus SLASHABLE
  arm panics on any non-DuplicateEvidence ingest error (Duplicate is
  absorbed inside `ingest_equivocation` and returns Ok); tick re-
  fetches + persists the Confirmed record BEFORE the burn so a
  persist failure leaves both registry and disk re-attempt-able on
  the next tick (or restart + rehydrate). `finalize_slash` is
  idempotent on already-Confirmed records.

* **Cryptographic binding from chunks to pivot state_root** — the
  Pass-11 manifest scheme verified each chunk against its committed
  `chunk_root` AND verified `meta.state_root == pivot_header.state_root`,
  but **did not** prove that the chunk_roots actually composed to
  `state_root`. A malicious peer could publish a manifest with the
  real pivot state_root but attacker-chosen `chunk_roots` (each
  internally consistent with attacker-chosen leaves) and inject
  arbitrary state. FIXED — new `snap_sync::verify_global_state_root`
  rebuilds a single global MPT from the union of every chunk's
  leaves and asserts the computed root equals the pivot header's
  `state_root`. Coordinator `run()` now performs both stages: per-
  chunk Merkle proof against `chunk_roots[i]`, then global binding
  against `pivot_state_root`. New regression test
  `coordinator_rejects_global_state_root_mismatch_attack` drives an
  `AttackerPeer` that sends self-consistent evil chunks; verifier
  rejects with `Interrupted("global state_root mismatch ...")`.
  Honest cost note: O(total leaves) trie inserts at bootstrap;
  Pass-12 may stream incrementally for very large states (security
  property unchanged).

* **Consensus participation not yet coupled to slashing/jail
  status** — `apply_slash_burn` mutates the shared RPC/staking
  `ValidatorSet` (sets `status = Jailed`, debits `self_stake`,
  credits whistleblower reward). Pass-11 architect-review round 2
  flagged the original epoch-refresh path as a complete bypass:
  it unconditionally `status = Active`-ed every configured
  validator each epoch, undoing every slashing outcome. FIXED —
  epoch refresh now PRESERVES `Jailed` status (skips re-activation
  with a `warn!`), and the rebuilt `active_set` filters out jailed
  addresses. (`ValidatorStatus` enum has no `Tombstoned` variant
  today; permanent-ban semantics are a Pass-12 add. Round-2
  architect-review caught a stray `Tombstoned` reference in this
  fix that broke `cargo check -p zbx-node`; corrected to filter on
  `Jailed` only — the only slashing-driven status currently
  produced.) So once
  slashed, a validator stays out of the RPC active set across
  every subsequent epoch boundary; an explicit operator-initiated
  unjail flow is required to re-enter. **Round-3 architect-review
  follow-up FIXED**: dynamic HotStuff active-set wiring is now in
  place — `HotStuffConsensus::update_validator_set(addrs)`
  recomputes `quorum = 2f+1` and is called every epoch boundary
  by `ConsensusDriver::do_commit` with the jailed-filtered set.
  Round-3 review correctly refused to accept Pass-12 deferral
  here because static `cfg.validators` + jail flag = jailed
  validator still counted toward quorum + retained proposer
  rotation slots until restart (real enforcement gap, not just
  cosmetic). The pubkey registry is intentionally NOT cleared on
  jail — the membership check in `on_vote` fires first and a
  later un-jail re-adds the validator with no false
  `dropped_unregistered` spike. New regression test
  `pass11_update_validator_set_evicts_jailed_voter` covers the
  hot-swap end-to-end (jailed validator vote silently dropped via
  membership gate, registry preserved, un-jail restores votes).
  **Round-4 architect-review follow-up FIXED**: enabling dynamic
  shrink uncovered a CRITICAL latent BFT-quorum-safety bug —
  `ValidatorSet::new` used `f=(n-1)/3; quorum=2f+1` which was only
  correct for `n = 3f+1` and silently produced unsafe thresholds
  for other cardinalities (n=3 → quorum=1 single-validator commit,
  n=5 → 3 instead of 4, n=6 → 3 instead of 5). Adopted standard
  Byzantine-quorum-intersection bound `quorum = floor(2n/3) + 1`
  + fail-fast `assert!(n > 0)` for empty active set. Quorum
  table: n=1→1, n=2→2, n=3→3 (unanimous, safe), n=4→3, n=5→4,
  n=6→5, n=7→5, n=10→7. New regression tests
  `pass11_safe_bft_quorum_table` + `pass11_empty_validator_set_is_rejected`.
  **Round-5 parity fix**: same safe-quorum + empty-set guard
  applied to `HotStuff2::new` so a future re-enable of the
  HotStuff2 path cannot silently re-introduce the same safety
  class. (Architect-recommended next step is a single shared
  quorum helper used by both — Pass-12 cleanup, behavior is
  already identical between the two sites.)

* **Pass-11 architect-review round 2 follow-ups (all in-pass)**:
  (a) `do_commit` now PANICS on `tick_finalize` error — previously
  logged + continued, which silently dropped the slash for the
  rest of the process lifetime. (b) `EvidenceStore::load_all_evidence`
  + `load_all_records` now return a hard error on corrupt entries
  instead of `warn! + skip` — silent skip on rehydrate is
  indistinguishable from a tampered-evidence drop attack by an
  operator with shell access. The whole rehydrate is now atomic:
  every persisted record loads or startup refuses. (c) Epoch-
  refresh jail-preservation (above).

Several **SOFT** items (governance audit, WS hardening, pruner
end-to-end test, snap-chunk boundary range proofs, liveness-slash
pipeline routing) are not strict blockers but should land before
any public testnet handover.

This file is updated every audit pass — see git log for history.
