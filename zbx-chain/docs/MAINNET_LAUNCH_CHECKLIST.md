# ZBX Chain — Mainnet Launch Checklist

**Task #14 deliverable.** This document is the go/no-go criteria for
the ZBX Chain (chain ID 8989) mainnet launch. Each item must be
verifiable with concrete evidence (a passing test, a CI job output,
a code reference).

---

## Background — why this checklist exists

Pass-12 (SEC-2026-05-09 first crypto-stub audit) introduced runtime
`assert_not_mainnet_*` panic guards that refused to start a node with
chain ID 8989. The guards were the right call while crypto stubs
existed (forgeable BLS aggregation, `Ok(price > 0)` ZK verifier).

Pass-17 + Pass-18 closed those gaps with real bls12_381, real Groth16,
real precompiles, and mandatory BLS Proof-of-Possession at validator
registration. The panic guards were removed.

Task #14 replaces the removed guards with a positive structured
readiness predicate (`zbx_node::readiness::verify_mainnet_ready`)
backed by this checklist. The predicate runs at boot, gated on
`network == Network::Mainnet`. CI runs the same predicate on every PR
via `.github/workflows/mainnet-readiness.yml`.

---

## Go/no-go items

### 1. BLS Proof-of-Possession enforced at validator registration

**Evidence:**

- `zbx-staking::ValidatorSet::register_with_pop` calls
  `BlsPubKey::verify_pop(pop, address)` and rejects with
  `StakingError::InvalidEvidence` on failure.
  Source: `zbx-chain/crates/zbx-staking/src/validator.rs` L153–173.
- Unit test: `cargo test -p zbx-node readiness::tests::bls_pop_check_rejects_zero_pop`
  must exit 0.
- Integration: any RPC-side `Stake` flow must route through
  `register_with_pop`; `register` (legacy) is reserved for genesis
  loaders only.

**Status:** ✅ PASS (Pass-18 #3, verified by readiness check #1).

### 2. All 9 standard EVM precompiles implemented on mainnet path

**Evidence:**

- `zbx-evm/src/precompiles.rs` and `zbx-zvm/src/precompiles.rs` ship
  real bodies for 0x01 ECRECOVER, 0x02 SHA256, 0x03 RIPEMD160, 0x04
  IDENTITY, 0x05 MODEXP (EIP-2565 gas), 0x06 BN128_ADD, 0x07
  BN128_MUL, 0x08 BN128_PAIRING, 0x09 BLAKE2F.
- Cross-VM equivalence test: `zbx-evm/tests/precompiles.rs` and
  `zbx-zvm/tests/pass18_*.rs` must run green.
- No dispatcher returns `Err(InvalidInput)` unconditionally for
  precompile addresses 0x01–0x09 on the mainnet path.

**Status:** ✅ PASS (Pass-18 #1+#2, verified by readiness check #2).

### 3. Snapshot manifest cryptographically bound to chain state

**Evidence:**

- `SnapshotManifest` covers `state_root`, `code_hashes_root`,
  `validator_set_root`, `chunks_root`, `block_hash`, `block_height`,
  `chain_id`, and `timestamp_unix`; each field is mixed into a
  `keccak256(SNAPSHOT_SIG_DOMAIN || chain_id_be8 || bincode(manifest))`
  digest BLS-signed under the producer's key.
- Cross-chain replay defence: explicit `chain_id` field + domain tag.
- **Same-chain stale-replay defence (Pass-19 CRIT #3):** `verify`
  takes `expected_checkpoint: Option<(block_height, block_hash)>` and
  rejects with `CheckpointMismatch` when a validly-signed manifest is
  presented at the wrong height/hash. Mainnet/testnet sync paths MUST
  pass `Some(...)` from the chain's checkpoint store.
- **Import-boundary enforcement (Task #22):** `node/src/snapshot_import.rs`
  is the live caller. `maybe_import_snapshot` does an atomic
  read-then-decide on `<data_dir>/snapshot.manifest.bin`; on
  mainnet (8989) and testnet (8990) a present manifest WITHOUT a
  configured trusted checkpoint hard-fails boot
  (`CheckpointRequired`). Mandatory chain config keys when using
  snapshots: `[chain.trusted_snapshot_checkpoint] { height, hash }`
  and `chain.snapshot_allowed_producers = ["0x<bls-pubkey>", ...]`.
  Integration test: `cargo test -p zbx-node --test snapshot_import_boundary`
  (3 tests — stale rejection, live-chain TOCTOU closure, no-manifest
  no-op).
- Producer authorisation: caller passes the allowed pubkey set; an
  unauthorised signer is rejected before BLS pairing runs.
- Source: `zbx-chain/crates/zbx-state/src/snapshot.rs`
  (`SnapshotManifest`, `SignedSnapshotManifest::verify`,
  `probe_in_memory`).
- Unit test: `cargo test -p zbx-state snapshot::tests` — 9 tests
  cover round-trip, every-field-changes-digest, tamper rejection,
  unauthorised producer, cross-chain replay, version mismatch,
  pinned-root mismatch, **stale-checkpoint rejection**, and
  matching-checkpoint acceptance.
- Boot probe: `zbx_state::snapshot::probe_in_memory` (called by
  `node::readiness::verify_snapshot_manifest_binding`) regression
  hard-fails the readiness predicate.

**Status:** ✅ PASS (Task #11, verified by readiness check #3).

### 4. Trie pruner wired into node startup

**Evidence:**

- `zbx_storage::pruner::prune_once` runs bounded-history mark-and-
  sweep over `Column::TrieNodes`: retain the last N state roots
  (default 256) → **snapshot all current trie keys via
  `for_each_trie_node` BEFORE marking** (Pass-19 CRIT #1: closes the
  concurrency window where blocks committed during a cycle could be
  unmarked AND visible to the sweep iterator) → BFS-mark every
  reachable node via `TrieNode::decode` (decode failures
  **fail-closed** per Pass-19 CRIT #2 — they propagate as
  `StorageError` and abort the entire cycle, never sweep on a
  partial reachable set) → batch-delete only snapshot-time keys
  not in the marked set via `delete_trie_nodes`. Progress is
  persisted to operator-visible `pruner.last_run_height`,
  `pruner.last_run_unix`, `pruner.swept_total` metadata keys.
- `zbx-node` subsystem #5 (in `node/src/node.rs`, between mempool
  heartbeat and consensus driver) ticks the pruner every
  `storage.pruner.interval_secs` (default 300s). Auto-restart with
  exponential backoff on failure. Disabled by setting
  `storage.pruner.enabled = false` (archive-node mode).
- Source: `zbx-chain/crates/zbx-storage/src/pruner.rs`,
  `zbx-chain/node/src/node.rs` subsystem #5,
  `zbx-chain/node/src/config.rs` `PrunerSettings`.
- Unit tests: `cargo test -p zbx-storage pruner::tests` covers
  ring-buffer eviction + dedup; `probe_in_memory` covers the full
  mark-and-sweep predicate against an in-memory store with a
  controlled orphan.
- Boot probe: `zbx_storage::pruner::probe_in_memory` (called by
  `node::readiness::verify_trie_pruner_wired`) regression hard-fails
  the readiness predicate.
- Stress test: 1000-block pruner sweep at synthetic load remains
  pending Task #2 (tracked separately — performance characterisation,
  not a correctness gate).

**Status:** ✅ PASS (Task #1, verified by readiness check #4).

---

## Operator runbook

### First boot

```bash
zbx-node --network mainnet --config /etc/zbx/mainnet.toml
```

If the readiness predicate reports any `Fail` gap, **do not pass
`--accept-mainnet-readiness`**. A `Fail` gap means a code regression
was merged and the canonical defense (e.g. PoP enforcement, real
precompiles) is no longer active. Roll back to the last release tag
where CI's `mainnet-readiness-check` was green.

If the readiness predicate reports only `Unknown` gaps, you are in
the 30-day grace window post-Pass-12-removal. Pass
`--accept-mainnet-readiness` to proceed:

```bash
zbx-node --network mainnet --config /etc/zbx/mainnet.toml --accept-mainnet-readiness
```

The grace window exists because Tasks #1 and #11 are not yet merged;
once they land, the gaps flip to `Pass` and the flag is no longer
needed. After 30 days post-removal **without** Tasks #1 and #11
merging, this checklist must be revisited — running mainnet without a
pruner is a long-term operational risk (unbounded disk growth).

### Existing operational gates that REMAIN

These pre-Task-#14 mainnet sanity gates are **not** part of the
readiness predicate and continue to fail-fast independently:

| Gate | Source | Behavior |
|------|--------|----------|
| KZG trusted setup loaded | `node/src/main.rs` Task #4 | Hard-fail on mainnet if missing |
| `chain_id` matches `--network` | `node/src/main.rs` N2 | Hard-fail unless `--allow-chain-mismatch` |
| Validator key set in validator mode | `node/src/main.rs` OPERATOR-04 | Hard-fail if `--validator` + no key |
| Vault registry deployed at 0x..5455 | `node/src/main.rs` Task #7 | Hard-fail on mainnet |

These are operational hygiene checks; they were never the Pass-12
panic guards and are not affected by Task #14.

---

## CI enforcement

`.github/workflows/mainnet-readiness.yml` runs the readiness predicate
on every PR touching:
- `zbx-chain/node/**`
- `zbx-chain/crates/zbx-staking/**`
- `zbx-chain/crates/zbx-threshold/**`
- `zbx-chain/crates/zbx-crypto/**`
- `zbx-chain/crates/zbx-evm/**`
- `zbx-chain/crates/zbx-zvm/**`
- `zbx-chain/crates/zbx-state/**`
- `zbx-chain/crates/zbx-storage/**`

`Fail` status hard-blocks merge. `Unknown` status is informational
during the grace window; once Tasks #1 and #11 merge, any regression
to `Unknown` will hard-block.

---

## Architect sign-off

The final `architect` review on Tasks #1–#14 is recorded in the
project task tracker. This checklist is updated whenever the readiness
predicate gains or loses a check — see `node/src/readiness.rs`
`ReadinessCheck` enum for the canonical list.

**Document version:** Pass-19 / Task #14 (2026-05-12).
