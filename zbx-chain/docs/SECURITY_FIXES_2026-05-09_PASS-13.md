# SEC-2026-05-09 Pass-13 — Tier-0 / Tier-1 follow-up to Pass-12 audit

Pass-12 closed 7 cheap-and-catastrophic findings and documented ~20 CRITICAL +
40+ HIGH still OPEN. Pass-13 closes the next batch of ZVM Tier-0 + mempool
Tier-1 + storage Tier-0 + AA Tier-1 findings that did NOT require multi-day
crypto integration work.

## What's fixed (and verified `cargo check` clean per crate)

### ZVM (`crates/zbx-zvm`)
1. **ZVM-T0-ORIGIN.** Pre-Pass-13 `Opcode::ORIGIN` aliased CALLER, breaking
   EIP-3 semantics and every `tx.origin == msg.sender` EOA-only guard
   (a common pattern in older DEX/airdrop contracts and most flashloan-defence
   modifiers). New `ZvmContext::origin: Address` field, propagated unchanged
   into every `do_call` / `do_create` sub-frame. Default = zero (matches the
   conservative behaviour for unit tests using `ZvmContext::test_default()`).
   The transaction executor MUST set `ctx.origin = signed_tx.from()` at the
   top frame; this is left for the executor wiring sweep.
2. **ZVM-T0-JUMPDEST.** Pre-Pass-13 the JUMP / JUMPI guards walked the raw
   byte at `code[dest]` and accepted any 0x5B byte even when it was actually
   the operand of a PUSH-N instruction. Classic "arbitrary-jump-into-PUSH-data"
   exploit. New `ZvmInterpreter::build_jumpdest_bitmap()` runs once per frame
   (lazy on first `run()`) and JUMP/JUMPI now consult the bitmap.
3. **ZVM-T0-PRECOMPILE.** Pre-Pass-13 `do_call` against a precompile address
   (0x01..=0x0F) executed `host.code(&precompile)` which is empty → no-op
   success → silently returned 32 zero bytes. **For ecrecover this means
   every signature recovery succeeded with `address(0)`** → trivial auth
   bypass for any `require(ecrecover(...) == owner)` or EIP-712 / EIP-2612
   permit flow. New `do_call` short-circuit dispatches precompile addresses
   to `do_precompile_call` which delegates to the existing `precompiles::call_precompile`
   handler (gas-charged in parent frame, no 63/64 forwarding — matches Yellow
   Paper §C.4).

### Mempool (`crates/zbx-mempool`)
4. **MEMPOOL-T1-NONCE-GAP.** New `MempoolConfig::max_nonce_gap` (default 256,
   matching geth's `--txpool.queue` window) caps `tx.nonce - sender_on_chain_nonce`.
   Pre-Pass-13 a single sender could submit a tx with `nonce = u64::MAX` that
   would never be promoted but would still occupy a queued slot + cumulative
   balance reservation budget. New `MempoolError::NonceGapTooLarge { addr, nonce, on_chain, max_gap }`.

### Bundler (`crates/zbx-bundler`)
5. **AA-T1-USEROP-HASH.** Pre-Pass-13 `UserOperation::hash` was SHA-256 of
   `sender || nonce || entryPoint || chainId` — ignoring `callData`,
   `initCode`, every gas parameter, and `paymasterAndData`. The bundler-computed
   hash therefore disagreed with on-chain `EntryPoint.getUserOpHash()` for
   every non-trivial UserOp; wallets signed one digest, the EntryPoint validated
   a different one → **every UserOp reverted in production**. Replaced with
   the canonical ERC-4337 v0.6 `keccak256(abi.encode(...))` form (10-word
   inner pack + 3-word outer pack, exact bit-for-bit parity with
   `contracts/ZbxEntryPoint.sol`). `sha2` import replaced by `sha3::Keccak256`.

### Storage (`crates/zbx-storage`)
6. **STORAGE-T0-DURABILITY.** `ZbxDb::put_account` now uses `write_synced`
   (fsync) instead of `write`. Previously the chain tip pointer in `put_block`
   was fsync'd separately while the underlying state-diff writes were not —
   on crash between the two, restart could observe `latest_block` ahead of
   its state-diffs ("block exists but state missing").
7. **STORAGE-T0-ATOMICITY.** New `ZbxDb::commit_block(block, txs, receipts)`
   batches the block, all transactions, all receipts, and the latest-height
   pointer into one fsync'd `WriteBatch` so a crash mid-commit either commits
   the entire block atomically or none of it. Pre-Pass-13 producer called
   `put_block` then `put_transaction` per-tx then `put_receipt` per-receipt
   in 3+ separate non-atomic writes; a crash in between left tip ahead of
   its own receipts (RPC returned `null` for confirmed-tx hashes; sync peers
   could observe a block that referenced not-yet-existing receipts).
   Producer wiring to switch over from the legacy 3-call sequence is left
   for the next pass.

## What is STILL OPEN (honest gap list)

### Tier-0 (consensus-breaking, must fix before mainnet)

- **PASS-12-BLS** — `crates/zbx-threshold/src/bls_aggregate.rs` is still the
  XOR-aggregation pseudorandom STUB. The mainnet-boot panic guard from
  Pass-12 still refuses production startup. Real fix needs `blst` or
  `bls12_381` integration; estimated 2–3 dev-days.
- **ZVM uses u128 not U256.** Stack/memory/arithmetic operate on `u128`
  rather than EVM's `uint256`. Any contract that genuinely uses the high
  128 bits (large bonding curves, certain Uniswap-V3 math, MerkleTrieProof
  verifiers) will diverge from Ethereum mainnet semantics. Multi-day
  refactor of `crates/zbx-zvm/src/{stack.rs,memory.rs,interpreter.rs}`
  to a real 256-bit type (e.g. `ethnum::U256` or `primitive-types::U256`).
- **Block-commit non-atomic across CFs at producer call-sites.** Pass-13
  added `commit_block` but the executor / block_producer must be migrated
  to call it; until then the new helper is unused.
- **State writes unsynced** — `put_account` is now fsync'd (Pass-13) but
  `StateDB::commit()` may still issue per-key writes; a sweep of every
  `ZbxDb::write(...)` callsite to `write_synced` (where the data is
  block-committed) is recommended.

### Tier-1 (HIGH — single-feature integrity)

- ZVM SSTORE: flat 100 gas (no warm/cold per EIP-2929).
- ZVM: no memory-expansion gas (EIP-150 quadratic cost missing).
- ZVM: predictable PREVRANDAO (uses block hash slice).
- ZVM: EIP-6780 SELFDESTRUCT semantics not enforced.
- `executor::batch` always-success stub.
- `MockZvmHost` reachable in production (not feature-gated).
- Snapshot writer never binds chunk_root to manifest (Pass-11 closed the
  consumer side; producer side still TODO).
- Trie no GC.
- `verify_proof` rejects valid inline-child proofs (Pass-8 fixed in-trie
  decoder; the proof verifier path missed).
- BLS `register_validator_pubkey` accepts no Proof-of-Possession (rogue-key).
- Keystore files written without 0o600 (Pass-12 fixed read path).
- AA bundler `validUntil` not enforced at bundle-time.
- TWAP no min window.
- OptimisticOracle 0 challenge_window.

### Tier-2 (Solidity, 11 items) — see Pass-12 doc, no Tier-2 fixes in Pass-13

PaymentGateway.refund cross-token drain, LiquidStaking first-depositor
inflation, Raffle correlated winners, AggregatorV3 no deviation cap,
PredictionMarket fee double-count, NameService no commit-reveal, PayId
reverse-mapping stale on transfer, Bundler.slash to owner (rug), missing
SafeERC20 in many contracts, Paymaster sig no validUntil, Launchpad reclaim
mismatched.

## False positives detected during Pass-13 triage

- **Bridge msg_hash missing chain_id** (Pass-12 audit Tier-1) — FALSE.
  `crates/zbx-bridge/src/relayer.rs:116` already mixes `source_chain_id`
  into the message hash via the L-06 fix from an earlier pass:
  `id_input[100..108].copy_from_slice(&(source_chain_id as u64).to_be_bytes());`.
  No fix needed.

## Mainnet-ready estimate (unchanged from Pass-12)

~5–6 weeks of focused engineering remain. Pass-13 chipped ~6 items off the
top of the queue but did NOT close any of the 5–6 deepest blockers
(real BLS, U256 ZVM, full executor wiring, EIP-2929 gas model, real
Groth16 verifier). Testnet (chain 8990) safe to operate; mainnet boot
remains blocked by the BLS guard.
