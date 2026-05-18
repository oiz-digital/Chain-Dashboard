# SECURITY AUDIT — Pass-12 (2026-05-09)

**Scope:** Full deep audit of the entire ZBX Chain repository — 74 Rust crates
(~118k LOC), 129 Solidity contracts (~29k LOC), 3 JS/TS SDKs (~3.7k LOC).

**Method:** Six parallel architect-grade subagents, each owning a distinct
surface, instructed to bias toward false-positives and cite line numbers. None
were allowed to assume prior passes were correct.

**Verdict:** **NOT READY FOR MAINNET.** All six surfaces returned a FAIL with
ranked findings. Approximately **20 CRITICAL** and **40+ HIGH** severity items
across consensus crypto, mempool, EVM/ZVM, storage atomicity, oracle/bridge/AA
account abstraction, and 129 Solidity contracts.

This document is the **honest** triage. Pass-12 closes the cheap and most
catastrophic items today; the remainder is sized realistically for follow-up.

---

## Surfaces audited

| # | Surface | Architect verdict | Critical | High |
|---|---------|-------------------|----------|------|
| S1 | 100+ Solidity contracts (untouched in prior passes) | FAIL | 2 | 9 |
| S2 | EVM / ZVM / precompiles / executor | FAIL | 4 | 6 |
| S3 | Mempool / fee market / cross-chain codec | FAIL | 5 | 4 |
| S4 | Storage / snapshot / pruner / DA | FAIL | 3 | 7 |
| S5 | Crypto / threshold / keystore / wallet | FAIL | 4 | 6 |
| S6 | Oracle / bridge / account-abstraction (AA) | FAIL | 2 | 7 |

Combined raw findings: `.local/full-audit-2026-05-09.md` (in-context, also
captured here in §Findings).

---

## Pass-12 fixes APPLIED today

| # | ID | Severity | File | Status |
|---|----|----------|------|--------|
| 1 | S3-codec/H7 | CRITICAL | `crates/zbx-codec/src/ssz.rs` | ✅ Real `sha2::Sha256` replaces XOR-fold "hash". Forgeable Merkle root in Eth-L1 bridge proofs is closed. |
| 2 | S6-oracle/C-2 | CRITICAL | `crates/zbx-oracle-zk/src/verifier.rs` | ✅ Stub `Ok(price > 0)` removed; verifier now returns `VerifierError::NotImplemented` (fail-closed) until real Groth16 BN254 pairing wires through precompile. |
| 3 | S4-DA | HIGH | `crates/zbx-da/src/sampling.rs` | ✅ Stub "always available" sampler returns `DaError::NotImplemented`. Light clients can no longer be fooled by a withholding peer. |
| 4 | S3-mempool/C1 | CRITICAL | `crates/zbx-mempool/src/{pool,error}.rs` | ✅ Replacement gas-price floor (≥12.5%, geth/erigon parity) added. Free-replacement pool churn DoS closed. |
| 5 | S3-mempool/H1 | HIGH | `crates/zbx-mempool/src/{pool,error}.rs` | ✅ Intrinsic gas precheck (21k base / 53k create + calldata + access-list) added at admission. Free-DoS via `gas_limit < 21000` closed. |
| 6 | S5/C3 | HIGH | `crates/zbx-wallet/src/keystore.rs` | ✅ `subtle::ConstantTimeEq` MAC compare (timing-oracle eliminated). Scrypt N floor `2^15` + power-of-two + dklen/salt sanity gate enforced on decrypt. |
| 7 | S5/C1 | CRITICAL (loud-fail guard) | `crates/zbx-threshold/src/bls_aggregate.rs` | ⚠️ The entire BLS module is XOR-aggregation pseudorandom stub — **forgeable**. Today: added `assert_not_mainnet_bls()` panic on `ZBX_NET=mainnet` to refuse mainnet boot, plus loud `MANDATORY follow-up` comment. **Real fix (PASS-12-BLS) requires `blst`/`bls12_381` integration — sized at 2-3 engineering days.** |

`cargo check -p zbx-codec -p zbx-da -p zbx-oracle-zk -p zbx-mempool -p zbx-wallet -p zbx-threshold` clean.

---

## Findings still OPEN — prioritised mainnet-blocker queue

### TIER-0 (CONSENSUS-BREAKING — must be fixed before any mainnet bring-up)

| ID | Surface | Summary |
|----|---------|---------|
| **PASS-12-BLS** | S5/C1 | Replace `bls_aggregate.rs` stub with real `blst` (or `bls12_381` + `bls-signatures`) — full hash-to-curve BLS_SIG_BLS12381G2_XMD:SHA-256, PoP-based rogue-key defence, FastAggregateVerify. ~2-3 days. |
| **PASS-12-PRECOMPILES** | S2/C-08 | `zbx-zvm` CALL never dispatches precompiles (1=ecrecover, 2=sha256, 3=ripemd, 4=identity, 5=modexp, 6-8=bn128, 9=blake2f, 0xA=kzg). ecrecover-by-default returning `address(0)` = silent auth bypass for every `OnlyOwner` modifier called via DELEGATECALL precompile pattern. |
| **PASS-12-ZVM-U256** | S2/C-01 | `zbx-zvm` arithmetic uses `u128` not `U256`. Every value > 2^128 truncates → consensus break vs Ethereum mainnet semantics. Migrate stack + memory + arithmetic ops to `primitive_types::U256`. |
| **PASS-12-JUMPDEST** | S2/C-04 | JUMPDEST validity scanner walks raw bytecode without skipping PUSHn data, so a PUSH operand that happens to equal `0x5B` is treated as a valid JUMPDEST → arbitrary-jump attack. Need a JUMPDEST analysis pass per code-deploy. |
| **PASS-12-STORAGE-ATOM** | S4/C1 | Block commit writes across CFs are NOT atomic. Crash between CF writes leaves DB in a half-applied state where `latest_block` advances but trie/receipts don't. Use `WriteBatch` + `write_with_wal_sync` for all per-block CF mutations. |
| **PASS-12-STATE-FSYNC** | S4/C2 | State writes use default sync mode. Power-loss between commit+ack and OS flush silently rolls back finalised blocks. `WriteOptions::set_sync(true)` on every block-commit batch. |
| **PASS-12-LATEST-ORDER** | S4/C3 | `latest_block` updated BEFORE state durability is confirmed. Reader can observe `latest_block=N` while state is still at `N-1` → RPC reads garbage. Reorder commits: state → receipts → headers → latest_block, all in one synced batch. |

### TIER-1 (HIGH — operational risk on testnet, mandatory before mainnet)

| ID | Surface | Summary |
|----|---------|---------|
| MEM-SIG-RECOVERY | S3/C2 | Mempool admission does NOT re-verify ECDSA signature → attacker can spam syntactically-valid garbage that wastes block-builder cycles. Add `tx.recover_signer() == tx.from` gate in `add_transaction`. |
| MEM-NONCE-GAP | S3/C3 | No max nonce-gap cap. A sender can submit nonce=on_chain+10000 → pool memory blowup. Cap at `MAX_NONCE_GAP=128`. |
| MEM-FEE-EVICT | S3/C4 | No fee-based eviction policy. When pending pool full, lowest-tip txs sit forever. Implement min-heap by effective tip + evict on insert. |
| ZVM-SSTORE | S2/H | SSTORE flat 100 gas, no warm/cold dirty-clean accounting → fails EIP-2200 + EIP-2929. State-write underpricing → DoS economics. |
| ZVM-MEM-GAS | S2/H | No memory expansion gas (Yellow Paper §H.1 quadratic). MLOAD on offset 2^32 = 0 gas in this VM. Gas accounting trivially bypassed. |
| ZVM-ORIGIN-CALLER | S2/H | ORIGIN == CALLER unconditionally — Ethereum semantics violated, breaks every "tx.origin != msg.sender" auth pattern. |
| ZVM-PREVRANDAO | S2/H | PREVRANDAO returns predictable counter (block number), not committed RANDAO. Lottery / VRF / NameService commit-reveal all manipulable. |
| ZVM-SELFDESTRUCT | S2/H | EIP-6780 not honoured — SELFDESTRUCT in same-tx-as-CREATE deletes code; in any other tx must be no-op-but-balance-transfer. Currently always deletes → Cancun divergence. |
| EXEC-BATCH-FAKE | S2/H-13 | `zbx-executor::batch` is a stub that always returns success regardless of receipts. Block proposal pretends every tx succeeded. |
| EXEC-MOCKHOST-PROD | S2/H-14 | `MockZvmHost` is reachable from production code paths (no `#[cfg(test)]`). Any builder using it gets test-only behaviours in prod. |
| SNAP-CHUNK-BIND | S4/H1 | Snapshot WRITER never binds `chunk_root` to manifest; reader (Pass-11) does. Honest writer + malicious manifest = crafted chunks accepted. Symmetric fix on writer side. |
| TRIE-NO-GC | S4/H7 | Patricia trie has no refcount / no GC. Database grows unbounded across reorgs and pruned ranges — old branch nodes never released. Implement refcount per-node + sweep on prune. |
| TRIE-INLINE-PROOF | S4/H9 | `verify_proof` rejects valid inline-child storage proofs (Yellow Paper §D inline rule for nodes < 32 bytes). Light clients fail to verify ~30% of small-account storage proofs. |
| BLS-POP-MISSING | S5/C2 | `register_validator_pubkey` accepts any pubkey without PoP check → rogue-key attack: attacker registers `pk_attacker = pk_honest + ε·G1` and forges aggregate sigs. PoP gate exists (`BlsPubKey::verify_pop`) but is never called by the registry. |
| KEYSTORE-PERMS | S5/C4 | Keystore files written without `0o600` mode. Other local users + worldreadable backups → key theft. Audit every `fs::write` of `KeystoreFile`. |
| AA-USEROP-HASH | S6/C-1 | Rust bundler `UserOp::hash` uses SHA-256 of a packed encoding; Solidity EntryPoint uses `keccak256` of an EIP-712-style `abi.encode` typed hash. **Off-chain bundler signs a hash that on-chain EntryPoint will never recompute** → every UserOp ought to revert in production. |
| BRIDGE-CHAINID | S6/H-9 | Cross-chain `msg_hash` omits `chain_id` from the digest → cross-network signature replay between testnet and mainnet bridges sharing validator keys. |
| TWAP-MIN-WINDOW | S6/H-3 | TWAP oracle has no minimum window check; a single block of attack-controlled price can dominate the average if requested with `window=1`. Enforce `window ≥ MIN_TWAP_WINDOW=300s`. |
| OPT-ORACLE-WINDOW | S6/H-4 | `OptimisticOracle.set_challenge_window(0)` is allowed — proposer can self-finalise with no dispute period. Enforce floor of e.g. 30 minutes. |
| AA-VALIDUNTIL | S6/H-6 | Account-abstraction `validUntil` field decoded but never enforced. Long-expired UserOps replayable forever. |

### TIER-2 (Solidity layer — 129 contracts, 9 HIGH + 2 CRITICAL)

| ID | Contract | Summary |
|----|----------|---------|
| SOL-PG-REFUND | C-1 / `ZbxPaymentGateway.refund` | Cross-token drain — `refund(orderId, anyToken)` lets payer pull back the original payment in a different token, draining whichever token has higher inventory. Bind `refund` to the original `paymentToken`. |
| SOL-LST-INFLATION | C-2 / `ZbxLiquidStaking` | Classic first-depositor share-inflation attack on `mint`. Pre-mint dead shares (1e3) on construction. |
| SOL-RAFFLE | H1 / `ZbxRaffle` | Single block.timestamp seed → all winners in one round are correlated; redrawing on revert lets the operator cherry-pick. Use Pyth Entropy / RANDAO-VDF and split entropy per winner-slot. |
| SOL-AGGV3 | H2 / `ZbxAggregatorV3` | No deviation cap on price updates; one rogue reporter can post `2^256-1`. Enforce ±10% max change vs trailing median. |
| SOL-PRED-DOUBLE | H3 / `ZbxPredictionMarket` | Fee accounting double-counts on `claim` of a position split across YES+NO sides → drainable by repeated splits. |
| SOL-NS-FRONTRUN | H4 / `ZbxNameService` | No commit-reveal on `register` → mempool front-runnable. |
| SOL-PAYID-STALE | H5 / `ZbxPayId` | Reverse-mapping `addr → payId` not cleared on `transfer/sell` → resolves to previous owner, payments mis-routed. |
| SOL-BUNDLER-SLASH | H6 / `Bundler.slash` | Slash proceeds go to `owner()` (rug-pull). Send to a public BurnAddress + governance-controlled InsuranceFund. |
| SOL-SAFEERC20-MISS | H7 / many | USDT/BNB-style non-standard ERC-20 returns silently ignored across multiple contracts. Migrate all `IERC20.transfer/From` to `SafeERC20`. |
| SOL-PAYM-EXP | H8 / `ZbxPaymaster` | Paymaster signature has no `validUntil` — a leaked sponsor sig is replayable forever. |
| SOL-LAUNCHPAD | H9 / `ZbxLaunchpad.reclaim` | Reclaim amount uses pledged commitment, not actually-deposited balance → over-refund when commitment was partially deposited. |

---

## Engineering effort estimate (honest)

| Tier | Items | Est. engineering days |
|------|-------|------------------------|
| Pass-12 (today) | 7 | 0.5 |
| Tier-0 remaining | 7 | 12-15 |
| Tier-1 remaining | ~17 | 18-22 |
| Tier-2 (Solidity) | ~11 | 6-8 |
| Re-audit (architects) | — | 2 |
| **Total to mainnet-ready** | ~42 | **~5-6 weeks** |

---

## Recommendation to project owner

1. **Do NOT bring up mainnet** until at least Tier-0 (especially BLS, precompiles, storage atomicity) is closed and re-audited.
2. **Testnet (chain 8990) can continue** — the loud-fail guard refuses mainnet boot but allows testnet.
3. **Sequence the work as PASS-12-BLS first** (single biggest mainnet blocker), then PASS-12-PRECOMPILES + PASS-12-ZVM-U256 in parallel (separate crates), then storage trio.
4. **Re-run all 6 architect audits** after each Tier-0 close, do NOT trust prior passes.
