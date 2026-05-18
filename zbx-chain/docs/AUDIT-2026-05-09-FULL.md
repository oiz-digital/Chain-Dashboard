# ZBX Chain — Full Codebase Security Audit (2026-05-09)

**Scope:** consensus, EVM/ZVM, execution, storage/trie, cryptography, P2P,
RPC/WS, mempool, Solidity contracts (excl. trading layer covered in Pass-3),
cross-chain bridge, JS/TS SDKs.
**Method:** 8 parallel layer-specific audit sweeps.
**Status:** **READ-ONLY findings.** Nothing is fixed in this report — Pass-5
work item.

---

## TL;DR severity tally

| Severity | Count |
|----------|-------|
| CRITICAL | 9     |
| HIGH     | 11    |
| MEDIUM   | 14    |
| LOW      | 6     |
| **Total**| **40**|

The two largest concentrations of risk are:

1. **EVM gas accounting** (memory expansion + EIP-150 63/64) — direct
   consensus-divergence + DoS vectors.
2. **HotStuff2 timeout-certificate path** — TC signatures never verified,
   aggregation is a stub. A single Byzantine validator can force view
   changes at will.

Both are CRITICAL and should land before any further mainnet work.

---

## CRITICAL findings

### C1. EVM: missing memory-expansion gas on most opcodes
- **File**: `crates/zbx-evm/src/interpreter.rs:389` (and ZVM mirror at `crates/zbx-zvm/src/interpreter.rs:164`)
- **Bug**: Only `SHA3` and `CALLDATACOPY` call `memory.ensure()`. `MLOAD`/`MSTORE`/`MSTORE8`/`CALLDATALOAD`/`CODECOPY`/`RETURN`/`REVERT`/`LOG*` etc. touch memory without charging expansion cost.
- **Impact**: A contract calling `MSTORE(2^32, val)` triggers a multi-GiB allocation in `memory.rs:58` and either OOM-crashes the validator or charges essentially zero gas — full DoS, plus trivial consensus divergence vs Ethereum.
- **Fix**: insert `self.consume_gas(self.memory.ensure(off, size)?)` in front of every memory access.

### C2. EVM: missing EIP-150 "all-but-1/64" gas forwarding
- **File**: `crates/zbx-evm/src/interpreter.rs:772` (`do_call`)
- **Bug**: User-requested gas is forwarded directly. The helper `forward_gas_eip150` exists in `gas.rs` but is not used.
- **Impact**: Sub-calls can consume more than `remaining - remaining/64` gas, opening stack-exhaustion attacks and Ethereum-incompat divergence.
- **Fix**: route `do_call`/`do_callcode`/`do_delegatecall`/`do_staticcall` through `forward_gas_eip150`.

### C3. Executor: tx value not refunded on revert
- **File**: `crates/zbx-execution/src/executor.rs:541`, value debit at `:406`.
- **Bug**: Value is debited from sender at top of `execute_tx`. On `ExitStatus::Reverted/Failed`, the snapshot path must roll the debit back. Spot-check shows the rollback may not cover the top-level value transfer (only inner-call snapshots).
- **Impact**: If confirmed, every reverted tx silently burns the sent value.
- **Fix**: confirm the snapshot wraps the outer value transfer — if not, manually credit `value` back to `sender` on revert.

### C4. State: mutation paths that bypass the MPT
- **File**: `crates/zbx-storage/src/db.rs:257` (`put_account`) and friends
- **Bug**: `ZbxDb::put_account` writes directly to the `State` column family. Any code that uses this without going through `StateView`/`StateDB` will silently desync the on-chain state root from on-disk state.
- **Impact**: silent state-root divergence ≡ chain split.
- **Fix**: make the direct `put_*` paths `pub(crate)` and audit every call site to ensure they only run during snapshot import / cold start, never on consensus path.

### C5. P2P: ECIES/RLPx is a placeholder XOR loop
- **File**: `crates/zbx-p2p/src/ecies.rs:87-99`, `crates/zbx-p2p/src/rlpx.rs:91-109`
- **Bug**: "AES-CTR" is `key ^ iv ^ counter` byte XOR. RLPx framing is unencrypted and has no MAC.
- **Impact**: If `zbx-p2p` is ever wired into the actual node transport (today the node uses the new Noise XX path from Pass-4, but `zbx-p2p` ships in the workspace and may be pulled in by tooling), every "encrypted" handshake byte is in the clear.
- **Fix**: either (a) delete `zbx-p2p` since the node is now on Noise XX, or (b) replace the XOR with `aes` + `ctr` crates and implement the devp2p frame MAC. **Recommend (a)**.

### C6. HotStuff2: TC signature never verified
- **File**: `crates/zbx-consensus/src/hotstuff2.rs:378-393` (`on_timeout_share`)
- **Bug**: `tc_accum.add_share()` returns a `TimeoutCertificate`; the certificate is then *acted on* (view change / new proposal) without verifying its aggregate BLS signature.
- **Impact**: a single Byzantine validator that broadcasts forged timeout shares can force every honest validator to keep changing views — full liveness break, possible safety break if combined with proposal injection.
- **Fix**: implement `TimeoutCertificate::verify()` (aggregate BLS check against contributor pubkeys) and call it in `on_timeout_share` AND in `on_proposal` whenever a proposal is justified by a TC.

### C7. HotStuff2: broken TC BLS aggregation (stub)
- **File**: `crates/zbx-consensus/src/hotstuff2.rs:171-174` (`TcAccumulator::build_tc`)
- **Bug**: aggregate signature is built by `flat_map(...).take(96)` — i.e. concatenating the first 96 raw signature bytes from collected shares.
- **Impact**: even if C6 is fixed, the produced TC is structurally invalid and would fail any honest verifier — chain stalls instead of equivocates.
- **Fix**: use `zbx_crypto::bls::aggregate_signatures(&shares)`.

### C8. RPC: unbounded `eth_call` / `eth_estimateGas`
- **File**: `crates/zbx-rpc/src/eth_api.rs:356`, `:445`
- **Bug**: gas limit defaults to the 30M block cap. No global RPC gas cap, no wall-clock timeout. An attacker can keep a node CPU-pinned with a single connection by submitting tight loops.
- **Impact**: trivial single-source DoS of any public RPC.
- **Fix**: hard cap (e.g. `RPC_GAS_CAP = 50_000_000`) plus a `tokio::time::timeout` (e.g. 5s) wrapping the EVM execution.

### C9. Trie: leaf-split / extension nibble correctness
- **File**: `crates/zbx-trie/src/trie.rs:191-256`
- **Bug**: leaf-split path was patched in W1.5 but the extension recursion at `:256` performs hand-coded nibble slicing with several edge cases (`cp + 1 == partial.len()`, empty remainder, branch-of-extension collapse). Property-based fuzzing is absent.
- **Impact**: any nibble bug here = wrong state root = chain split.
- **Fix**: add a `proptest` battery comparing `ZbxTrie` to a reference (e.g. `eth-trie` crate) on random insert/delete sequences.

---

## HIGH findings

### H1. Consensus: timeout shares not individually verified
- **File**: `crates/zbx-consensus/src/hotstuff2.rs:155-162`
- **Bug**: `add_share` inserts unverified shares. Quorum can be reached with garbage signatures.
- **Fix**: verify each share's BLS signature against the validator's pubkey before insertion.

### H2. Consensus: BFT quorum formula inconsistency
- **File**: `crates/zbx-consensus/src/epoch_manager.rs:74-78` vs `hotstuff.rs` / `hotstuff2.rs`
- **Bug**: `EpochState::quorum() = (n*2/3) + 1` differs from `2*((n-1)/3) + 1` used elsewhere. For n=4 both give 3, but for n=7 they give 5 vs 5 ✓; n=10 → 7 vs 7 ✓; n=3 → 3 vs 1 ✗. Inconsistency around small/transitional epoch sizes.
- **Fix**: standardise on `2*((n-1)/3) + 1` everywhere; add a `BftMath` test crate.

### H3. Consensus: missing equivocation guard in HotStuff2
- **File**: `crates/zbx-consensus/src/hotstuff2.rs` (no `SafetyRules` integration)
- **Bug**: The 3-phase implementation has `SafetyRules` tracking voted phases. HotStuff2 does not — a buggy or compromised local key can sign two votes at the same round.
- **Fix**: lift `SafetyRules` (or write a slim `voted_at: HashMap<Round, BlockHash>`) into HotStuff2 and gate every outbound vote.

### H4. Bridge: replay-protection set lives only in RAM
- **File**: `crates/zbx-bridge/src/multisig.rs:37, 140`
- **Bug**: `MultisigAuth.spent_operations: HashSet` is never persisted. Process restart wipes the set; old `msg_hash` values can be replayed.
- **Fix**: back it with a RocksDB column family (`bridge_spent_ops`), keyed by `msg_hash`.

### H5. Webhook: keccak256 misused as HMAC
- **File**: `crates/zbx-payment/src/webhook.rs:116-122`
- **Bug**: `signature = keccak256(secret || body)`. Documentation says "HMAC-SHA256" but the implementation is a naive concat-then-hash — wrong primitive AND wrong hash.
- **Fix**: use the `hmac = "0.12"` crate with `Hmac<Sha256>`. Document that signature header changes (clients will need to migrate).

### H6. Storage: hot-path writes are async (no fsync)
- **File**: `crates/zbx-storage/src/db.rs:202-352` (every `put_*` helper)
- **Bug**: every per-block write (transactions, receipts, accounts, storage, code, trie nodes) goes through `write_inner(sync=false)`. WAL flush only — power-loss can lose acknowledged blocks.
- **Fix**: a single `write_synced` at the end of `commit_block`, atomically wrapping all column families for that block.

### H7. State adapter: O(N) lookup of pending nodes
- **File**: `crates/zbx-state/src/trie_adapter.rs:79-114`
- **Bug**: `pending: Mutex<Vec<(H256, Vec<u8>)>>` — `get()` linear-scans. Every trie traversal during block execution pays O(N).
- **Fix**: change to `Mutex<HashMap<H256, Vec<u8>>>`.

### H8. RPC: no input-size limit on calldata params
- **File**: `crates/zbx-rpc/src/eth_api.rs:379, 460`
- **Bug**: only the global HTTP body cap (~1 MB) bounds calldata. A batch of 50 requests × 1 MB each = 50 MB of hex-decoding + EVM setup.
- **Fix**: per-call `MAX_CALLDATA = 128 * 1024`.

### H9. WS: no rate limit, no origin check
- **File**: `crates/zbx-rpc/src/ws_server.rs:86`
- **Bug**: HTTP server has both, WebSocket has neither. Browser drive-by attacks + flood DoS both work.
- **Fix**: port `RateLimiter` and origin allowlist from `server.rs`.

### H10. SDK: hardcoded chain id in `ZbxContract.send`
- **File**: `sdk/zebvix-js/src/contract.ts:110`
- **Bug**: Pass-4 fixed `ZbxWallet` but `ZbxContract.send` still bakes `DEFAULT_CHAIN_ID`. A wallet pointed at testnet, calling a contract method, signs mainnet-replayable txs.
- **Fix**: same pattern as Pass-4 S1 — `await wallet.resolveChainId()` (expose it as `public` or a `getChainId()` method on the wallet).

### H11. Solidity: ZbxYieldOptimizer sets fee without bounds
- **File**: `contracts/ZbxYieldOptimizer.sol:240`
- **Bug**: performance fee can be set up to **20%**. No timelock, no cap, manual `msg.sender == owner` check (no `Ownable2Step`).
- **Fix**: hardcode `MAX_PERF_FEE_BPS = 500` (5%), add `Ownable2Step`, add 48h timelock for fee changes.

---

## MEDIUM findings

### M1. EVM: SSTORE refund logic incomplete (EIP-2200/2929/3529)
- **File**: `crates/zbx-evm/src/interpreter.rs:605`
- **Bug**: warm/cold pricing OK, but the `(original, current, new)` tuple needed for refunds is not tracked.
- **Fix**: snapshot `original_value` per (addr, slot) at tx start; apply refund table.

### M2. ZVM: missing Cancun opcodes (MCOPY/TLOAD/TSTORE)
- **File**: `crates/zbx-zvm/src/interpreter.rs`
- **Bug**: opcodes are in the enum but execution falls through to `INVALID`.
- **Fix**: implement, or document them as deliberately disabled.

### M3. Solidity: `ZbxRaffle.cancelRaffle` loops over all tickets
- **File**: `contracts/ZbxRaffle.sol:231`
- **Bug**: gas-DoS once a raffle has thousands of tickets — refunds can never be issued.
- **Fix**: switch to pull-payment (`pendingRefunds[user] += stake` then `claimRefund`).

### M4. Solidity: `ZbxPaymentGateway.payWithConvert` uses user-supplied router
- **File**: `contracts/ZbxPaymentGateway.sol:311`
- **Bug**: arbitrary `router` address means a malicious caller can use a fake router that "swaps" worthless tokens into the merchant's account.
- **Fix**: whitelist routers; enforce slippage against an oracle, not just `maxAmountIn`.

### M5. Solidity: `ZbxYieldOptimizer` shares math can overflow
- **File**: `contracts/ZbxYieldOptimizer.sol:135`
- **Bug**: `amount * totalShares` can overflow uint256 in 18-decimal regimes.
- **Fix**: `FullMath.mulDiv(amount, totalShares, poolBefore)`.

### M6. Solidity: multisig hashes need `block.chainid` + `address(this)`
- **File**: `contracts/ZbxMultisig.sol`, `contracts/BridgeMultisig.sol`
- **Bug**: signature hash includes `nonce` but spot-check did not show `chainid` + contract address binding. Fork-replay risk.
- **Fix**: switch to EIP-712 typed-data hashing with `EIP712Domain { name, version, chainId, verifyingContract }`.

### M7. Bridge: `targetAddress` not bound in nonce or event
- **File**: `contracts/ZbxBridge.sol:201`
- **Bug**: `targetAddress` parameter is ignored on-chain (`targetAddress;`). Relayers must reconstruct intent from tx-traces. Mis-routed funds have no on-chain audit trail.
- **Fix**: include `targetAddress` and `targetChainId` in both `BridgeOutInitiated` event and the `nonce` preimage.

### M8. Bridge: no `whenNotPaused` on relayer-management admin fns
- **File**: `contracts/ZbxBridge.sol:289, 296, 344`
- **Bug**: a stolen `relayAdmin` key can lower threshold / add malicious relayers even while the bridge is paused.
- **Fix**: add `whenNotPaused` (or a separate `emergencyOnly` modifier) to `addRelayer`/`removeRelayer`/`setThreshold`.

### M9. Consensus: predictable leader at genesis
- **File**: `crates/zbx-consensus/src/hotstuff2.rs:438-442`
- **Bug**: VRF seed = `highest_qc.vote_data.block_hash`. At genesis this is zero → first epoch's leader sequence is fully predictable.
- **Fix**: mix in `current_epoch` and a genesis-supplied seed.

### M10. RPC: error messages leak internal paths
- **File**: `crates/zbx-rpc/src/eth_api.rs:304, 317, 334, 352`
- **Bug**: `format!("storage: {e}")` etc. surface raw RocksDB errors (paths, CF names) to public callers.
- **Fix**: log full error server-side, return generic `"internal database error"` to client.

### M11. WS: per-connection subscription map unbounded
- **File**: `crates/zbx-rpc/src/ws_server.rs:122`
- **Bug**: an open connection can register thousands of subscription IDs without cleanup.
- **Fix**: cap `MAX_SUBS_PER_CONN = 32`.

### M12. SDK: pervasive `\${...}` template-literal escape bug
- **Files**: `sdk/zebvix-js/src/{client,contract,subscribe,middleware,aa,fee}.ts` — 25+ sites
- **Bug**: `\${x}` inside backticks is a literal backslash-dollar-brace, not an interpolation. Error messages, log lines, and one RPC method-name parameter print literal `${var}` instead of the value.
- **Fix**: codebase-wide regex `\\\$\{` → `\${` ; add an ESLint rule (`no-useless-escape` covers it) and re-run.

### M13. SDK: `parseZbx` does not validate input shape
- **File**: `sdk/zebvix-js/src/client.ts:146`
- **Bug**: `BigInt(whole)` throws on non-numeric input ("100n", "100_000", "1e2", etc.) → unhelpful `SyntaxError` for the dapp.
- **Fix**: same pattern as the Pass-4 `parseWei` — regex-validate, then `BigInt()`.

### M14. P2P (legacy): `thread_rng` for ECIES IV
- **File**: `crates/zbx-p2p/src/ecies.rs:38`
- **Bug**: project policy is `OsRng`. `thread_rng` is CSPRNG-grade in modern `rand` but inconsistent with the rest of the codebase.
- **Fix**: switch to `OsRng` (moot if C5's "delete `zbx-p2p`" path is taken).

---

## LOW findings

### L1. EVM: `EXP` byte_len uses non-saturating arithmetic
- **File**: `crates/zbx-evm/src/interpreter.rs:313`
- **Fix**: `10.saturating_add(50.saturating_mul(byte_len))`.

### L2. Bridge: fees accumulate but have no `claimFees`
- **File**: `crates/zbx-bridge/src/relayer.rs:99`, `contracts/ZbxBridge.sol`
- **Fix**: explicit `claimFees(treasury)` admin function.

### L3. Storage: RocksDB iterators load entire ranges into memory
- **File**: `crates/zbx-storage/src/_archive/iterator.rs:43-52`
- **Fix**: streaming iterator (proper `DBIterator` consumer).

### L4. Solidity: `ZbxMemeFactory._graduate` creator payout can brick
- **File**: `contracts/ZbxMemeFactory.sol:411`
- **Bug**: contract-creator that reverts on receive blocks graduation forever.
- **Fix**: `try`/`catch` around the `.call`, or pull-payment.

### L5. SDK: `subscribe.ts` swallows JSON parse errors silently
- **File**: `sdk/zebvix-js/src/subscribe.ts:62-74`
- **Fix**: surface via an `onError` callback.

### L6. SDK: middleware `logger` prints raw signed-tx params
- **File**: `sdk/zebvix-js/src/middleware.ts:17-19, 31-43`
- **Fix**: redact `zbx_sendRawTransaction` / `eth_sendRawTransaction` params.

---

## What was checked and is OK

- `zbx-crypto` — secp256k1 low-S rejection ✓, BLS pairing math ✓,
  keccak personal-sign prefix ✓.
- `zbx-rlp` — leading-zero canonicality + bounds checks ✓ (hardened
  recently).
- `zbx-keystore` — PBKDF2 floor 100k ✓ (Pass-4 N1), `Zeroizing` private
  keys ✓, encrypt-then-MAC ordering ✓, constant-time MAC compare ✓.
- `zbx-rpc` HTTP server — CORS, bearer auth, batch cap, log range cap ✓.
- `eth_sendRawTransaction` chain_id strict equality ✓ (Pass-4 R4).
- Mempool slot/cost reservation ✓ (Pass-4 R1+R2).
- Trading layer (Perpetuals / Options / OrderBook / Futures) ✓ (Pass-3).
- Bridge nonce monotonicity within a single process ✓ (Sprint S36) —
  H4 is specifically about *cross-restart* persistence.

---

## Suggested priority order for Pass-5

1. **C1, C2, C9** — EVM gas + trie correctness (consensus-critical).
2. **C6, C7, H1, H3** — HotStuff2 TC + equivocation (safety-critical).
3. **C3** — value refund on revert (verify-then-fix).
4. **C8, H8, H9, M11** — RPC/WS DoS surface.
5. **C5 + M14** — delete or rebuild `zbx-p2p`.
6. **H4, M7, M8, L2** — bridge persistence + intent binding.
7. **H10, M12, M13** — SDK chain id + escape bug + validation.
8. Everything else (medium/low).

---

*Auditor*: 8 parallel layer-specialist sweeps, consolidated 2026-05-09.
*Out of scope this pass*: ZK circuits (`zbx-zkp`), account-abstraction
EntryPoint internals (4337 verification gas), cross-domain governance,
LSP/IDE-level static analysis. Earmarked for Pass-6.
