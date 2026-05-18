# S33-state-root MPT — Production-Harden the Patricia Trie + Wire It

**Status:** ACTIVE — Sprint S33-state-root opened 2026-05-02 (Session 15)
**Author:** Replit Agent (architect-reviewed)
**Closes:** C-09 (CRITICAL launch blocker), M-02 (HIGH, reclassified Session 14)
**Opens:** zero new launch blockers (this is a pure remediation sprint)
**Effort:** ~5 workstreams, ~3-5 turns, similar magnitude to S32 (S7-EVM3 W1+W2+W3+W6)

---

## 1. Goal

Replace the placeholder `state_root` hash (currently
`keccak256(addr || nonce || balance [|| code_hash || storage_root])` over
sorted dirty accounts) with a real Merkle Patricia Trie (MPT) root computed
by `zbx-trie`, in both call-sites:

- `crates/zbx-state/src/state_db.rs:111-127` — `StateDB::state_root() -> H256`
- `crates/zbx-execution/src/executor.rs:109-124` — `StateView::state_root() -> [u8; 32]`

Then propagate the new root through `BlockExecutor::execute → ExecutionResult →
node/src/block_producer.rs` so every produced block header carries a Patricia-
trie root that an external Ethereum-style verifier can independently re-derive
from the post-state.

Genesis (`crates/zbx-genesis/src/builder.rs:102-145`) must use the same MPT
construction so the operator-pinned `MAINNET_GENESIS_HASH` (in
`zbx-types::pinned_genesis`) is computed against canonical roots from day one.

---

## 2. Why this is C-09 (CRITICAL launch blocker)

A blockchain header's `state_root` is the trust anchor that lets any node —
without trusting the producer — re-execute the block and verify the result.

The current placeholder hash is:

```rust
// state_db.rs:111-127
pub fn state_root(&self) -> H256 {
    let mut accounts: Vec<(Address, AccountState)> = self
        .dirty_accounts.iter().map(|(&k, v)| (k, v.clone())).collect();
    accounts.sort_by_key(|(a, _)| a.0);
    let mut input = Vec::new();
    for (addr, state) in &accounts {
        input.extend_from_slice(&addr.0);
        input.extend_from_slice(&state.nonce.to_be_bytes());
        input.extend_from_slice(&state.balance);          // ⚠ but balance is U256, not [u8;_]
        input.extend_from_slice(&state.code_hash);
        input.extend_from_slice(&state.storage_root);
    }
    keccak256(&input)
}
```

This has **three independent fatal defects**:

1. **Only dirty accounts are hashed.** Restart loses base accounts → root
   diverges immediately on cold start vs hot. State is non-deterministic
   across nodes that restart at different heights.
2. **No Merkle proof support.** Light clients, bridges, and rollups all
   need `eth_getProof`-style Patricia proofs. The current scheme cannot
   produce them.
3. **Not Ethereum-compatible.** Any external verifier (geth `--engine.state-root`,
   reth, erigon, EIP-1186 proof verifier, Solidity light-client contracts on
   bridge counter-parties) will reject every block.

Fix: real MPT over `BTreeMap<Address, AccountState>` with per-account
storage subtries.

---

## 3. Recon discoveries (this turn)

Beyond the AUDIT M-02 entry, **`zbx-trie` itself has CRITICAL functional gaps**
that must be closed before W2:

| Site | Defect | Severity |
|------|--------|----------|
| `crates/zbx-trie/src/trie.rs:189-194` | `Extension { partial, child }` insert path: when the new key diverges mid-extension, returns `Err(TrieError::Inconsistent) // simplified` — **extension splitting is unimplemented**. Any second insert that shares a prefix shorter than the existing extension will fail. | CRITICAL |
| `crates/zbx-trie/src/trie.rs:113` | After a leaf-split into a branch, the surrounding extension's `partial` is built as `key.slice(depth).slice(0).slice(0)` — slicing by 0 is a no-op. The extension carries the FULL remaining key instead of the common-prefix portion. Wrong root. | CRITICAL |
| `crates/zbx-trie/src/trie.rs:*` | **No `delete()` method exists** on `MutableTrie`. Account self-destruct, storage clear (SSTORE → 0), and code prune all need delete. | HIGH |
| `crates/zbx-trie/src/trie.rs:122-128` | `insert()` re-hashes `NodeRef::Inline(n)` and stores it as a hash root. Per Yellow Paper §D, the root is always `keccak256(rlp(root_node))` even for inline-sized roots — current code is correct in spirit but stores the inline body in `cache` under its hash, which is fine; the issue is the surrounding logic in `store_node` returns `Inline` for <32-byte nodes, which then SHOULDN'T appear at root. Cosmetic, but confusing. | LOW |
| `crates/zbx-trie/src/trie.rs:*` | `MutableTrie` cache uses `HashMap` with `std::collections::DefaultHasher` (HashDoS-vulnerable). Should use `hashbrown` (already in Cargo.toml dev-dep, but not used in trie.rs) or `BTreeMap`. | MED |
| `crates/zbx-trie/src/proof.rs:*` | `verify_proof` exists but no `MerkleProof::generate(trie, key)` method. Bridges and light clients can't produce proofs without it. | HIGH |
| `crates/zbx-trie/tests/` | **Directory does not exist; ZERO tests.** Cannot regression-protect the above before fixes land. | CRITICAL (process) |

**Conclusion:** `zbx-trie` is *not* the "almost-ready library, just wire it up"
that the AUDIT M-02 entry implies. It's a **partially-implemented prototype**
that must be hardened first.

---

## 4. Workstream breakdown (revised)

### W1 — zbx-trie test backfill (NEW: prove the gaps)

**Files:** `crates/zbx-trie/tests/trie_basic.rs` (new)

**Tests:**
1. `empty_trie_root_matches_ethereum_constant` — `MutableTrie::new(MemoryTrieDB).root() == EMPTY_ROOT == keccak256(rlp(""))`
2. `single_insert_then_get_roundtrips`
3. `single_insert_then_get_wrong_key_returns_none`
4. `update_existing_key_changes_root`
5. `update_to_same_value_root_unchanged`
6. `two_keys_distinct_prefixes_inserts_succeed` — keys `[0x10, ...]` and `[0x20, ...]`
7. `two_keys_short_common_prefix_inserts_succeed` — exercises branch creation
8. `two_keys_long_common_prefix_inserts_succeed` (`#[ignore = "blocked on W1.5: extension splitting"]`) — proves the W1.5 gap
9. `insert_order_independence_of_root` — inserting `(a,b,c)` vs `(c,b,a)` yields same root (Patricia property)
10. `commit_then_reopen_preserves_root`
11. `proof_for_present_key_verifies` — generate via reading nodes from cache, then `verify_proof` round-trips
12. `proof_for_absent_key_with_correct_exclusion_verifies` (`#[ignore = "blocked on W1.5: proof generator API"]`)
13. `proof_against_wrong_root_fails`
14. `delete_existing_key_removes_it` (`#[ignore = "blocked on W1.5: delete() unimplemented"]`)

**Acceptance:** all non-`#[ignore]` tests pass under `cargo test -p zbx-trie`
(architect-validated; sandbox cannot compile RocksDB-deps but `zbx-trie` itself
has no rocksdb dep — local validation may be possible).
**Effort:** 1 turn.

---

### W1.5 — zbx-trie production-harden (INSERTED — blocking W2)

**Files:** `crates/zbx-trie/src/trie.rs`, `crates/zbx-trie/src/proof.rs`

**Tasks:**
- Implement `insert_node` Extension-split case (replace `Err(Inconsistent)`)
  - Common prefix → keep as Extension to a new branch, branch hosts (old child suffix) and (new key suffix as leaf)
- Fix `key.slice(depth).slice(0).slice(0)` placeholder → introduce
  `Nibbles::sub(start, len)` helper and use it correctly
- Add `MutableTrie::delete(&mut self, key: &[u8]) -> Result<bool, TrieError>` —
  returns `true` if key existed
  - Branch-collapse logic: if branch ends with 0 or 1 children + no value, collapse
  - Leaf-with-extension-parent collapse case
- Add `MerkleProof::generate(trie, key) -> MerkleProof` — walks from root
  collecting RLP-encoded nodes along the path
- Switch `MutableTrie::cache` from `HashMap` to `hashbrown::HashMap` (dep already present)
- Un-`#[ignore]` tests 8, 12, 14 from W1; all pass

**Reference:** Yellow Paper Appendix D, EIP-1186 (proof format), `go-ethereum/trie/trie.go`

**Acceptance:** all 14 W1 tests pass; node.rs Extension/Branch encoding
unchanged (M-02 closed by adding test vectors against geth `state.root` for
known account sets — at least 3 hand-derived vectors).
**Effort:** 1-2 turns.

---

### W2 — zbx-state ↔ zbx-trie integration

**Files:** `crates/zbx-state/Cargo.toml`, `crates/zbx-state/src/state_db.rs`,
`crates/zbx-state/src/lib.rs`

**Tasks:**
- Add `zbx-trie = { path = "../zbx-trie" }` to `[dependencies]`
- Replace the simplified `crates/zbx-state/src/trie.rs` (BTreeMap+flat-hash)
  with re-exports from `zbx-trie` — leave a `pub use zbx_trie::*;` shim or
  delete entirely (caller search needed first)
- Refactor `StateDB`:
  - Add `account_trie: MutableTrie<MemoryTrieDB>` field
  - Add `storage_tries: HashMap<Address, MutableTrie<MemoryTrieDB>>` field
  - On `set_account` / `set_storage`: update the trie
  - On `state_root`: walk dirty addresses, finalize each storage_trie root,
    write the updated AccountState (with the new storage_root) into account_trie,
    return `account_trie.root()`
- Account encoding: RLP-list of (nonce, balance, storage_root, code_hash) per
  Ethereum spec (so external verifiers can decode)
- Storage encoding: RLP-encoded H256 value (32 bytes) keyed by `keccak256(slot)` per Yellow Paper §4.1
- `StateDB::commit() -> Result<H256, StateError>` — flush both account trie and all storage tries to backing storage; returns the new account_trie root

**Acceptance:**
- `StateDB::state_root` returns canonical MPT root
- 4 new integration tests in `crates/zbx-state/tests/state_root.rs`:
  1. Empty StateDB → `EMPTY_ROOT`
  2. Single EOA with balance → root matches hand-computed RLP-leaf hash
  3. EOA + contract w/ 1 storage slot → root differs from EOA-only
  4. Order-independence over `set_account` calls
**Effort:** 1 turn.

---

### W3 — Executor + producer migration

**Files:** `crates/zbx-execution/src/executor.rs`, `node/src/block_producer.rs`

**Tasks:**
- `StateView::state_root()` (executor.rs:109-124) — replace placeholder body with delegation to a `StateDB` instance OR mirror the same MPT construction over `(self.base + self.diffs.accounts)`
  - Decision point for architect: should `StateView` own a `StateDB`, or should the executor accept a `&mut StateDB` directly? Cleaner if executor uses `StateDB` end-to-end; that's a larger refactor — gate on architect verdict at W3 start
- `ExecutionResult::new_state_root` is already populated (line 190) — no producer change needed once `StateView::state_root` is real
- Producer (`node/src/block_producer.rs`) — verify line 307 patch from S33 still wires `block.header.state_root = exec.new_state_root` — if it doesn't (old code), add it

**Acceptance:**
- `BlockExecutor::execute` returns non-zero canonical state_root for any non-empty block
- Re-execution by an independent verifier produces the same root (covered by N-04 deferral exit-criteria — re-enable that test)
**Effort:** 1 turn.

---

### W4 — Genesis migration + parity test

**Files:** `crates/zbx-genesis/src/builder.rs`, `crates/zbx-types/src/pinned_genesis.rs`

**Tasks:**
- `GenesisBuilder::state_root_bytes` — replace the injective hand-rolled hash
  (lines 102-145) with the same MPT construction used by `StateDB::state_root`
- This **WILL** produce a different `genesis_block_hash` than the previous
  placeholder
- Update `MAINNET_GENESIS_HASH`, `TESTNET_GENESIS_HASH`, `DEVNET_GENESIS_HASH` constants in `pinned_genesis.rs` (since chain has not yet launched, this is a config update, not a hard fork)
- Migration story document (in this proposal's Appendix A): pre-launch chain → no live state → no migration tooling required; document the regen procedure for ops to recompute the pinned hash post-S33
- Parity test: `crates/zbx-genesis/tests/parity.rs` — same `GenesisSpec` produces same root across (W4-trie path) ↔ (manual RLP construction) — proves no encoding drift

**Acceptance:**
- `GenesisBuilder::genesis_block_hash` returns Patricia-trie-derived value
- 3 mainnet/testnet/devnet hashes pinned in source match the new computation
- N-07 closes (3 parallel impls collapse to 1: builder.rs is canonical)
**Effort:** 1 turn.

---

### W5 — Architect review + close-out

**Tasks:**
- `architect({task: "Review S33-state-root MPT migration end-to-end",
    relevantFiles: [zbx-trie/src/trie.rs, zbx-trie/tests/, zbx-state/src/state_db.rs,
    zbx-execution/src/executor.rs, zbx-genesis/src/builder.rs, AUDIT_2026-04-30.md],
    includeGitDiff: true})`
- Address every High/Critical finding before close-out
- AUDIT Session 15 close-out:
  - Flip C-09 → ✅ CLOSED
  - Flip M-02 → ✅ CLOSED (extension encoding now under test vectors)
  - Open new AUDIT entries for any zbx-trie defects discovered in W1.5 that did NOT make this sprint (deferred items)
  - Update launch-blocker count: 3 CRIT → **2 CRIT** (only C-11 HotStuff + S11-BRIDGE-SOL-OUT1 remain)
- Refresh `artifacts/sui-fork-dashboard/public/zbx-chain-full.zip`
- Auto-commit via platform end-of-turn

**Acceptance:** architect PASS; AUDIT updated; zip refreshed.
**Effort:** 1 turn.

---

## 5. Out of scope (explicitly deferred to follow-up sprints)

- **S33-zvm-mirror** (W4+W5 of S7-EVM3) — next sprint S34, originally
  planned for S33; deferred per user choice
- **C-11 HotStuff cross-epoch safety** — Sprint **S35-hotstuff-safety**
  (see §8 below)
- **S11-BRIDGE-SOL-OUT1 BSC nonce collision** — Sprint
  **S36-bridge-out-nonce** (see §9 below)
- **C-10 ref-counted pruner** — separate sprint S37 (after S35 + S36)
- **Live-state migration tooling** — N/A pre-launch; chain has no live state
- **Eth-spec test vector ingestion** (`tests/StateTests/...`) — deferred
  to S38 cross-impl conformance sprint
- **Snapshot sync rebuild** — depends on C-10 pruner
- **W1.6 verify_proof inline-children** — see §10 below

## 8. Sprint S35-hotstuff-safety — C-11 close

**Closes:** C-11 (CRITICAL launch blocker, currently 1 of 3 remaining)
**Effort:** 1-2 turns

**Target site:** `crates/zbx-consensus/src/safety_rules.rs:113-119`

```rust
pub fn advance_epoch(&mut self, new_epoch: u64) {
    if new_epoch > self.state.epoch {
        self.state.epoch = new_epoch;
        self.state.locked_round = 0;        // ⚠ DROPS SAFETY LOCK
        self.state.locked_qc = None;        // ⚠ DROPS SAFETY LOCK
    }
}
```

**Why this is a launch blocker:** HotStuff's safety property relies on
the `locked_qc` invariant — a validator must NOT vote on any block at a
round less than `locked_round` unless there is a QC at a higher round
that supersedes it. Resetting `locked_round = 0` and `locked_qc = None`
on every epoch transition gives a Byzantine adversary that controls the
epoch boundary the ability to revert finalised blocks: they propose a
new-epoch block at round 1, validators have no lock, they vote, finality
of the previous epoch's last block is reversed.

**Fix design (architect-gated at sprint start):**

Option A — *preserve across epochs:*
```rust
pub fn advance_epoch(&mut self, new_epoch: u64) {
    if new_epoch > self.state.epoch {
        self.state.epoch = new_epoch;
        // locked_round / locked_qc PRESERVED — votes at new-epoch round
        // are still gated on superseding the old lock.
    }
}
```

Option B — *epoch-end finality marker:*
- Add `state.epoch_finality: Option<QuorumCertificate>` — the last
  committed QC of the previous epoch
- Cross-epoch QCs require this marker as an explicit ancestor reference
- `advance_epoch` requires a witness QC proving the previous epoch's
  finality before clearing the lock

Option A is simpler and safer; Option B better matches the original
HotStuff paper's "rotating consensus" formulation. Architect call.

**Tests:**
- `crates/zbx-consensus/tests/safety_cross_epoch.rs` — attempt to vote
  on a conflicting block in a new epoch at a round ≤ old `locked_round`,
  must be rejected by `safety_rules.vote()`

**Acceptance:**
- Test above passes
- Existing safety tests still pass (no regression of within-epoch
  finality)
- Architect PASS

## 9. Sprint S36-bridge-out-nonce — S11-BRIDGE-SOL-OUT1 close

**Closes:** S11-BRIDGE-SOL-OUT1 (CRITICAL launch blocker, currently 1
of 3 remaining)
**Effort:** 1-2 turns

**Target site:** `crates/zbx-bridge/contracts/ZbxBridge.sol::bridgeOut()`
on production BSC

**Defect:** Current nonce scheme allows two distinct user requests to
share a nonce when minted across (chainId × sender) tuples that collide
in the simplified scheme. This enables double-spend or replay across
the bridge.

**Fix design:**

```solidity
// Composite-key nonce: (chainId, sender) → monotonic counter
mapping(uint256 => mapping(address => uint256)) public bridgeOutNonce;

function bridgeOut(uint256 destChainId, address recipient, uint256 amount) external {
    uint256 n = bridgeOutNonce[destChainId][msg.sender]++;
    bytes32 requestId = keccak256(abi.encode(
        block.chainid,    // source chain binding (closes -OUT2 too)
        destChainId,
        msg.sender,
        recipient,
        amount,
        n
    ));
    // ... rest of bridgeOut logic ...
}
```

**Pre-requisite check:** Confirm whether `zbx-bridge` is wired into any
current deploy. AUDIT entry **S11-BRIDGE-DEAD1** flags it as
"zero workspace consumers." If still orphan, this fix is
protective-only and S35 takes priority.

**Tests:** Hardhat — `crates/zbx-bridge/test/bridgeOutNonce.spec.ts`
- Two simultaneous bridgeOut calls from different senders to same dest must succeed with distinct requestIds
- Same-sender same-dest calls must increment nonce monotonically
- Replay of an executed requestId must revert
- Cross-chain isolation: same (sender, recipient, amount) on chainA vs chainB must not produce same requestId

## 10. W1.6 follow-up — verify_proof inline children

**Status:** Known limitation, NOT a launch blocker.

W1.5 added `verify_proof` non-inclusion handling at Leaf/Extension/Branch
divergence points. However, when a proof's path traverses an inline
child (`NodeRef::Inline`), the verifier returns `false`. This is safe
(rejects valid proofs of inclusion through inline children) but
incomplete.

**Why it's not a launch blocker:** Production state tries never produce
inline children on a proof path. RLP-encoded `AccountState` is always
> 32 bytes (storage_root [32B] + code_hash [32B] alone exceed the
inline threshold). The limitation only affects test scenarios with
small string keys/values, where it's been worked around in
`tests/trie_basic.rs` by using 32-byte keys + 32-byte values.

**Future fix:** Rework `verify_proof` to recurse into inline children
without consuming a `nodes` slot. ~30 LoC change in `proof.rs`.

---

## 6. Migration story (operator-facing)

**Pre-S33:** `MAINNET_GENESIS_HASH` is computed from injective-but-non-canonical
`keccak256(allocations || validators)` blob.

**Post-S33:** `MAINNET_GENESIS_HASH` is computed from
`keccak256(rlp(MPT_root_over_AccountState_RLP || other_header_fields))`.

**Operator action required (one-time, pre-launch):**

```bash
cargo run --bin zbx-tools -- compute-genesis-hash \
    --spec config/mainnet-genesis.toml > /tmp/new_pinned_hashes.txt
# Diff against current zbx-types/src/pinned_genesis.rs
# Open PR to update the 3 constants
```

Because the chain has not yet launched, no fork coordination, no
testnet hard-fork-block, no validator vote required. Pure config update.

---

## 7. EIP / spec references

- **Yellow Paper, Appendix D** — Modified Merkle Patricia Trie definition
- **EIP-1186** — `eth_getProof` proof format (used by W1.5 proof generator)
- **go-ethereum `core/types/hashing.go`** — reference RLP encoding of leaves
- **go-ethereum `trie/trie.go`** — reference insert/delete extension-split logic
- **revm `db.rs::CacheDB`** — reference for snapshot/revert semantics over MPT

---

## Appendix A — Why genesis hash CAN change

The Zebvix Chain has not yet launched mainnet (per
`docs/proposals/DEVNET-LAUNCH-PLAN-2026-05-01.md` — devnet only).
No live state exists. Updating the pinned constants is a source-tree
config change, not a chain reorg. The chain IDs (8989/8990/7878) remain
LOCKED per project goal — only the genesis state-commit format changes.

---

## 11. S37-governor-timelock-wiring — Close C-19 (HALF-OPEN)

### Defect (recon turn 3, post-S22a)

S22a closed the **votes-machinery half** of C-19 (`_getVotes` +
`_totalSupplyAt` wired to ZBXGov checkpoints). However the
**execution half** is still open at `contracts/ZbxGovernor.sol:156-167`:

```solidity
function queue(uint256 proposalId) external {
    require(state(proposalId) == ProposalState.Succeeded, "Governor: not succeeded");
    // Real impl: IZbxTimelock(timelock).scheduleBatch(targets, values, calldatas, delay)
    emit ProposalQueued(proposalId, block.timestamp + 172800); // 48h timelock
}

function execute(uint256 proposalId) external payable {
    require(state(proposalId) == ProposalState.Queued, "Governor: not queued");
    proposals[proposalId].executed = true;
    // Real impl: IZbxTimelock(timelock).executeBatch(targets, values, calldatas)
    emit ProposalExecuted(proposalId);
}
```

**Net effect**: A proposal that wins quorum (after S22a, this is now
possible) flips state to Succeeded → Queued → Executed but produces
**zero on-chain action**. The `targets[]/values[]/calldatas[]` stored
in the Proposal struct are never invoked. ZbxTimelock has the wiring
(`queueTransaction`, `executeTransaction`) but Governor never calls it.

This is a CRITICAL governance liveness defect — the Governor is the
designated admin of `ZbxBridge`, `ZbxLendingPool`, `BridgeVault`, and
`BridgeMultisig` (post-`setGovernor` cutover from S3 T103), so a passed
proposal to (e.g.) rotate a relayer key is silently dropped on-chain.

### Implementation (this sprint, ~1-2 turns)

| Workstream | Detail |
|---|---|
| W1 | Add `IZbxTimelock` interface to `contracts/interfaces/IZbxTimelock.sol` matching `queueTransaction(target, value, signature, data, eta)` and `executeTransaction(...)` and `delay()` view |
| W2 | Add `mapping(uint256 => uint256) public proposalEta;` to ZbxGovernor; queue() computes `eta = block.timestamp + IZbxTimelock(timelock).delay()` and writes it once |
| W3 | Replace `queue()` body: loop over `p.targets[i]/values[i]/calldatas[i]` calling `IZbxTimelock(timelock).queueTransaction(target, value, "", calldata, eta)` for each (signature is empty since calldata is pre-encoded) |
| W4 | Replace `execute()` body: loop over the same arrays calling `IZbxTimelock(timelock).executeTransaction(target, value, "", calldata, proposalEta[id])` for each. Forward `msg.value` proportionally — for v1, require `msg.value == sum(values)` and pre-fund timelock from this contract's receive(), or use Governor as the value-bearer |
| W5 | Add `cancel()` extension: if proposal in Queued state, also call timelock.cancelTransaction for each action |
| W6 | HEVM tests: `Governor_Queue_CallsTimelock` (txHash deterministic from inputs), `Governor_Execute_RevertsBeforeEta`, `Governor_Execute_SucceedsAfterDelay`, `Governor_Execute_BypassedByDirectCallReverts` (Timelock onlyAdmin), `Governor_Execute_AfterGracePeriodReverts`, `Governor_Cancel_RevokesQueuedTxs` |
| W7 | Architect re-verify; flip C-19 to ✅ CLOSED in AUDIT |

### Pre-req (deployment-side, NOT this sprint)

The Governor must be set as `admin` on `ZbxTimelock` for `queueTransaction`
to pass the `onlyAdmin` modifier. This is a one-time post-deploy ops step
and is independent of the contract code change. Tracked as deployment-checklist.

### Architect-gated design choice (msg.value handling)

ZbxTimelock.executeTransaction is `payable` and forwards via
`target.call{value: value}(callData)`. Two design options for batched
execute:

- **Option A (caller-funded)**: Governor.execute() requires
  `msg.value == sum(p.values)` and forwards exactly each tx's value to
  timelock per-call. Simpler accounting, gas-efficient, but
  user-facing UX requires the proposal-executor to pre-compute total ETH.

- **Option B (Governor-funded)**: ETH escrowed at queue() via separate
  fund() call. More complex but allows proposal-executor to be a
  zero-balance EOA. Mirrors OZ Governor's TimelockController pattern.

**Recommend Option A** for v1 — matches the existing per-action
`uint256[] values` pattern and avoids a new escrow surface area. Architect
review at S37 W7 will lock the choice.

---

## 12. C-20 ZbxRouter — RECON-DISCOVERED CLOSURE

### Finding (recon turn 3)

The original AUDIT entry C-20 (line 203) reads:

> `contracts/ZbxRouter.sol:91,105` | `addLiquidity`/`removeLiquidity` are
> placeholders → users lose deposits | 📋 DEFERRED — needs Uni V2 router impl

This entry is **STALE**. Direct read of `contracts/ZbxRouter.sol`
(turn-3 recon) shows fully-implemented Uni-V2-style router:

| Function | Status | Implementation |
|---|---|---|
| `addLiquidity` | ✅ Real | createPair if missing → `_computeLiquidityAmounts` (handles both empty-pair and existing-pair branches with min-slippage checks) → `transferFrom` both tokens directly to pair → `IZbxPair(pair).mint(to)` → require liquidity > 0 |
| `removeLiquidity` | ✅ Real | `getPair` (require non-zero) → LP transfer to pair → `IZbxPair(pair).burn(to)` → token0/token1 re-orient to (A,B) → min-slippage checks |
| `swapExactTokensForTokens` | ✅ Present at L53 | (verify in S37 W7) |
| `swapTokensForExactTokens` | ✅ Present at L66 | (verify in S37 W7) |
| `_getAmountOut` | ✅ Real | Canonical Uni-V2 0.3% fee math: `(in*997*rOut)/(rIn*1000+in*997)` |
| `_getAmountIn` | ✅ Real | Reverse: `((rIn*out*1000)/((rOut-out)*997))+1` |
| `_swap` / `_pairFor` / `_sortTokens` / `_getReserves` / `_computeLiquidityAmounts` | ✅ Real | Standard Uni-V2 internal helpers |

ZERO TODO/placeholder/stub markers across the 223-LoC file. Likely
silently closed by an unrecorded prior sprint (the AMM/Pair sprint
that introduced `ZbxAMM.sol` + `ZbxAMMFactory.sol` + `ZbxPair`
interfaces).

### Action

C-20 closure must be **architect-verified** before flipping the AUDIT
entry. Verification scope:

- Re-read full `contracts/ZbxRouter.sol`
- Re-read `contracts/ZbxAMM.sol` (the pair contract being delegated to)
- Confirm reentrancy posture (`nonReentrant` on add/remove, deadline `ensure` modifier)
- Confirm slippage protection (min-out checks) on all four entry points
- Confirm token-ordering bug-free between `(tokenA, tokenB)` user-facing and `(token0, token1)` pair-internal
- Hardhat / HEVM test surface check (does any test exercise the round-trip?)

If architect confirms, AUDIT line 203 flips to ✅ CLOSED, and
launch-blocker count drops one further. Tracked as **S37-followup-c20-architect-verify**
(can be bundled into S37 W7 for efficiency).

---

## 13. S33-state-root W2 — landed (turn 4)

### Files

| File | Change |
|---|---|
| `crates/zbx-state/Cargo.toml` | +zbx-trie, +zbx-rlp deps; +hex dev-dep |
| `crates/zbx-state/src/state_db.rs` | state_root() full rewrite + module docs + RLP helpers + compute_storage_root() helper (~150 LoC net) |
| `crates/zbx-state/tests/state_root_mpt.rs` | NEW — 18 tests |

### Architectural choice — Option B (lazy build) over Option A (resident tries)

The original W2 spec called for `account_trie` + `storage_tries` as
resident fields on `StateDB`. After reading the StateDB structure in
detail (snapshot/revert pattern, base/dirty separation, per-tx
mutation density), Option B was selected:

- **Option A (resident tries)**: snapshot/revert would need trie undo
  semantics, which `MutableTrie::commit()` does not currently support.
  Implementing it would require either a journaling layer or trie
  cloning per snapshot — both expensive and out of W2 scope.
- **Option B (lazy build)**: `state_root()` rebuilds the trie from the
  visible account set on demand. Since `state_root()` is called once
  per block (executor.rs:190), the cost is amortised. Snapshot/revert
  continues to work unchanged because the trie holds no persistent
  state across calls.

Option B is the correct architectural choice for W2. Option A may
become viable in W3 when the persistent TrieDB lands and trie state
naturally persists across state_root calls anyway.

### Yellow Paper §4.1 conformance checklist

- [x] Account leaf = RLP-list[nonce, balance, storage_root, code_hash]
- [x] Integer fields use minimal-byte big-endian encoding (stripped zeros)
- [x] Hash fields are 32 bytes verbatim
- [x] Account key in trie = keccak256(addr) (20→32 byte hash expansion)
- [x] Storage key in trie = keccak256(slot) (32→32 byte hash)
- [x] Storage value = RLP of big-endian-int with leading zeros stripped
- [x] Empty accounts (nonce=0,balance=0,code=EMPTY,storage=EMPTY) suppressed
- [x] Zero-value storage slots suppressed
- [x] Self-destructed addresses excluded from trie
- [x] Empty trie → EMPTY_ROOT (`56e81f17...3b421`)
- [x] Empty storage trie → EMPTY_STORAGE_ROOT (= same constant)

### Honest limitation scoped to W3

W3 will plumb a persistent TrieDB wrapper over ZbxDb. Until then,
`compute_storage_root()` only produces canonical roots when the
storage_cache holds either:
1. all of an account's storage (greenfield/genesis), OR
2. a complete overwrite of every pre-existing slot.

For partial-overwrite blocks against an account with un-cached
pre-existing slots, the rebuilt storage_root diverges from the true
on-disk root. State_db.rs module-level doc spells this out explicitly.

### W2 → W3 handoff requirements

W3 ("Executor + producer migration") will need to:
1. Add a `TrieDB` impl wrapping `ZbxDb` (persistent backend)
2. Add `StateDB::storage_db: Arc<dyn TrieDB>` field for storage tries
   to read pre-existing slots transparently
3. Modify `compute_storage_root()` to start from the persistent root
   stored on `AccountState.storage_root` and apply only the dirty
   slot changes (incremental update, not full rebuild)
4. Migrate executor.rs:109-122 (`StateView::state_root()`) to call
   into the new StateDB pathway instead of its current flat keccak
5. Wire genesis.rs:319 (`compute_genesis_state_root`) similarly,
   with a parity test that the genesis hash on the existing devnet
   spec produces a deterministic (but new) value
6. Hard-fail on chain-mismatch policy is preserved — the genesis
   hash WILL change and that is documented in §Appendix A above

---

## 14. S33-state-root W3a — landed (turn 5)

### Files

| File | Change |
|---|---|
| `crates/zbx-state/src/mpt.rs` | NEW — shared MPT module (~190 LoC) |
| `crates/zbx-state/src/lib.rs` | +`pub mod mpt;` |
| `crates/zbx-state/src/state_db.rs` | state_root() refactored to delegate; W2 helpers/imports moved to mpt.rs (~80 LoC removed) |
| `crates/zbx-execution/Cargo.toml` | +`zbx-state` dep |
| `crates/zbx-execution/src/executor.rs` | StateView::state_root() rewritten — was flat-keccak placeholder, now MPT |
| `crates/zbx-execution/tests/state_root_mpt.rs` | NEW — 17 tests including 5 cross-impl parity tests |

### W3a invariant

The most important deliverable is **byte-for-byte parity between
`StateView::state_root()` and `StateDB::state_root()`** for identical
logical inputs. Tests 9-13 in the new executor test file enforce this
explicitly:

| Test | Setup | Asserts |
|---|---|---|
| 9 | empty | `view.state_root() == db.state_root().0` |
| 10 | single account | parity holds |
| 11 | multi-account + multi-storage | parity holds for non-trivial input |
| 12 | empty-account suppression | both yield EMPTY_ROOT |
| 13 | balance-only edge case | parity holds |

This invariant guarantees the executor and the on-disk state DB will
never disagree on the canonical state root for the same block, which
is foundational for fraud proofs, snap-sync, and light-client trust.

### Architectural rationale

Two paths considered for sharing MPT logic between StateDB and StateView:

| Option | Description | Verdict |
|---|---|---|
| A | Make StateView delegate to StateDB | Rejected — would couple zbx-execution to StateDB lifecycle (snapshot/revert), and StateView has no concept of base/dirty separation |
| **B** | **Extract MPT helpers to shared `zbx-state::mpt` module; both call into it** | **Selected** — minimal coupling, single source of truth, no lifecycle entanglement |

### Storage type-bridge ([u8; 32] → H256)

`StateView::diffs.storage` uses `HashMap<Address, HashMap<[u8; 32], [u8; 32]>>`
whereas the shared helper expects `HashMap<Address, HashMap<H256, H256>>`.
The conversion happens inside `StateView::state_root()` — single allocation
per call, runs once per block. Cost: O(slots-touched), negligible.

A future cleanup could change StateView's storage type to use `H256`
directly, eliminating the conversion. Out of W3a scope; tracked as
optional follow-up.

### What W3a does NOT close

The W2 "honest limitation" still applies: for accounts with un-cached
pre-existing storage slots, the recomputed `storage_root` diverges
from canonical. Both `StateDB` and `StateView` exhibit this behaviour
identically (which is why the W3a parity invariant still holds — both
are wrong in the same way).

W3b will close this by adding `ZbxDbTrieAdapter` (an impl of
`zbx_trie::TrieDB` over the persistent ZbxDb) and a new
`compute_state_root_with_db()` variant that uses
`MutableTrie::from_root(account.storage_root, db)` to reload the
existing storage trie before applying dirty slot deltas.

### W3b scope (next turn)

| Task | Detail |
|---|---|
| W3b.1 | Add `TrieNodes` column to `crates/zbx-storage/src/schema.rs` |
| W3b.2 | Create `crates/zbx-state/src/trie_adapter.rs` with `ZbxDbTrieAdapter` |
| W3b.3 | Add `compute_state_root_with_db()` to `mpt.rs` |
| W3b.4 | Add `Option<Arc<ZbxDbTrieAdapter>>` to StateDB and StateView |
| W3b.5 | Tests for partial-overwrite parity vs full-rebuild |

### W4 preview (after W3b)

| Task | Detail |
|---|---|
| W4.1 | Migrate `node/src/genesis.rs:319` `compute_genesis_state_root` to call `mpt::compute_state_root` instead of its current flat keccak |
| W4.2 | Document the genesis-hash change (devnet/testnet hash WILL change — chain_mismatch policy still hard-fails by default per S33-W3 handoff §6) |
| W4.3 | Cross-reference S30 genesis-hash test (`s30_genesis_hash_distinguishes_extra_data_from_state_root`) — that test asserts inequality, will continue to pass under new MPT roots |
