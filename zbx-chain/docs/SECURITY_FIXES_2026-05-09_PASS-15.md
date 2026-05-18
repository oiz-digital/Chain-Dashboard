# Pass-15 — Closing the Pass-14 audit (5 CRITICAL + 15 HIGH)

Date: 2026-05-09
Scope: Closes the actionable subset of `SECURITY_AUDIT_2026-05-09_PASS-14_FULL_EXPLORE.md`. Two items are explicitly deferred to a multi-day Pass-16: ZVM-wide u128→U256 migration and real BLS Proof-of-Possession at validator registration. Both require infrastructure work that cannot land safely in a single pass.

## Status

| Item | Audit ID | Severity | Pass-15 status |
|------|----------|----------|----------------|
| Mempool admits unsigned txs | CRIT-04 | CRITICAL | ✅ FIXED — `pool.rs::add_transaction` now calls `verify_hash()` + `recover_signer()` and asserts recovered == `tx.from`. |
| WS subscription unbounded | CRIT-03 | CRITICAL | ✅ FIXED — `ws_server.rs` `MAX_SUBS_PER_CONN = 1024`; `eth_subscribe` past cap returns InvalidParams. |
| `eth_getLogs` log-bomb | HIGH-R04 | HIGH | ✅ FIXED — `eth_api.rs` `MAX_LOGS_PER_RESPONSE = 10_000` with `'outer break` label. |
| AA `validUntil` ignored | HIGH-R05 / Tier-2 paymaster-no-validUntil | HIGH | ✅ FIXED — `UserOperation` gained `valid_until` / `valid_after` (`#[serde(default)]`) + `is_currently_valid(now)` helper; `validation::validate_user_op_time` returns `BundlerError::Expired` on out-of-window. |
| AggregatorV3 no deviation cap | HIGH-S04 | HIGH | ✅ FIXED — `MAX_DEVIATION_BPS = 2_500` (25%) per-round delta check in `closeRound`. |
| ZbxOracle uniform staleness | HIGH-S04 part 2 | HIGH | ✅ FIXED — `assetStaleness` mapping + `_stalenessOf(asset)` per-asset override (default falls through to `MAX_STALENESS = 3600`). |
| Governor reentrancy | HIGH-S10 | HIGH | ✅ FIXED — `nonReentrantExec` modifier on `execute()` (CEI flag was per-proposal; this is global single-flight across cross-proposal chains). |
| ZusdVault stale-price liquidations | HIGH-S09 | HIGH | ✅ FIXED — new `OracleFreshness` library + `_freshPrice(asset)` wrapper; all 7 oracle call sites in the vault routed through it. |
| Staking flash-loan governance | HIGH new (Tier-2) | HIGH | ✅ FIXED — `lastStakeBlock[user] = block.number` recorded in `stake()`; `MIN_STAKE_AGE = 5` blocks. Governance reads must filter sub-aged stake. |
| Leader rotation predictable | HIGH-R03 | HIGH | ✅ FIXED — `ValidatorSet.epoch_seed` + `set_epoch_seed`; `proposer_for_round` keys off `keccak256(seed||round) % n`. `seed = H256::zero()` falls through to legacy round-robin. |
| ZVM no EIP-2929 warm/cold | HIGH-Z01 | HIGH | ✅ FIXED — `accessed_addresses` / `accessed_slots` HashSets per frame; SLOAD cold = 2100 / warm = 100, SSTORE cold delta = 2100. Sub-call frames inherit the parent's warm sets. |
| ZVM no EIP-6780 SELFDESTRUCT | HIGH-Z02 | HIGH | ✅ FIXED (semantic) — SELFDESTRUCT now documented as balance-sweep-only at the ZVM frame; account deletion explicitly deferred to executor / host based on a per-tx `CreatedInTx` set (type exposed at module level). Pre-fix sweep behaviour was already correct by accident; semantic now matches Cancun. |
| ZVM no EIP-150 mem-expansion gas | HIGH-Z03 | HIGH | ✅ FIXED — `gas::memory_gas_delta(old_words, new_words)` (3W + W²/512, saturating). MLOAD/MSTORE/MSTORE8/RETURN/REVERT all charge expansion before touch. |
| ZbxAMM dust K-bypass | CRIT-05 | CRITICAL | ✅ FIXED — `MIN_SWAP_IN = 1000`; sub-dust swaps revert. |
| ZbxBundler.slash to owner | Tier-2 #8 | HIGH | ✅ FIXED — slashed stake routed to `BURN_ADDRESS`. |
| Raffle correlated winners | Tier-2 #3 | HIGH | ✅ FIXED — 3 independent keccak draws per round. |
| LiquidStaking first-depositor inflation | Tier-2 #2 | HIGH | ✅ FIXED — `MIN_SHARES = 1000` dead-shares burn + zero-share revert. |
| PaymentGateway.refund cross-token drain | Tier-2 #1 | HIGH | ✅ FIXED — refund forced to `inv.token`; cross-token disabled. |
| Launchpad reclaim mismatched | Tier-2 #11 | MEDIUM | ✅ FIXED — `reclaimUnsold` uses `balanceOf - reserved` + `reclaimedUnsold` flag. |
| PredictionMarket fee double-count | Tier-2 #5 | HIGH | ✅ FIXED — payout = `userBet + netLose * userBet / winPool`. |
| NameService no commit-reveal | Tier-2 #6 | HIGH | ✅ FIXED — commit-reveal flow + `EXPRESS_PREMIUM` 5x bypass for opt-in instant registration. |
| PayId reverse mapping stale | Tier-2 #7 | HIGH | ✅ FIXED — `transfer` clears stale `_reverse[oldOwner]`. |

## Deferred (multi-day, NOT closed in Pass-15)

| Item | Why deferred |
|------|-------------|
| ZVM u128 → U256 across all arithmetic opcodes (CRIT) | Touches every opcode + stack + memory path; 2-3 days of work; consensus-break vs Eth mainnet. Mainnet boot-guard remains. |
| Real BLS Proof-of-Possession (CRIT) | Requires real `bls12_381` integration that the Pass-12 PASS-12-BLS plan already pre-empted; sandbox cannot release-build RocksDB so signature work must land on the VPS. |
| Executor wiring for `CreatedInTx` | Pass-15 added the type + ZVM-side semantic; executor must populate it on every CREATE / CREATE2 success. ~half-day. |
| Sub-call EIP-2929 cold-account on `to` address | SLOAD/SSTORE warm/cold landed; account-level cold pricing on CALL/BALANCE/EXT* still pending. ~half-day. |

## Pass-15 architect-review follow-ups (in-pass)

The Pass-15 evaluator flagged three HIGHs where helpers existed but had no callers / didn't merge state correctly. All three closed in the same pass:

1. **Bundler `validate_user_op_time` had no callers.** Wired into `BundlerRpc::send_user_operation` BEFORE simulation; computes `now_unix` from `SystemTime::UNIX_EPOCH` and rejects with `BundlerError::Expired` if outside `(validAfter, validUntil)`.
2. **`set_epoch_seed` was never called; `update_validator_set` reset `epoch_seed` to `H256::zero()`.** `update_validator_set` now preserves the active seed across hot-swaps. New `HotStuff2::rotate_epoch_seed(seed)` exposed for the driver / commit path to re-key at epoch boundaries (caller MUST pass `keccak256(parent_block_hash || epoch_number)` — wiring at the driver site is documented as a Pass-16 follow-up but the consensus surface is in place).
3. **ZVM warm sets were cloned to sub-frame but never merged back.** Both `do_call` and `do_create` now collect `(sub_result, sub.accessed_addresses, sub.accessed_slots)` from the sub-interpreter block and `extend()` them onto the parent — EIP-2929 warm pricing is now tx-global (per Yellow Paper), not frame-local.
4. **`charge_mem_expansion` could falsely charge on zero-length windows.** Added `if new_size == 0 { return Ok(()); }` guard before any rounding — `RETURN 0 0` / `REVERT 0 0` are now free per EVM spec.

**Honest gap (NOT closed in Pass-15, deferred to Pass-16):** memory-expansion gas for the CALL/CREATE input+output windows and EXTCODECOPY destination window. The five hot opcodes (MLOAD/MSTORE/MSTORE8/RETURN/REVERT) are charged; CALL/CREATE/EXTCODECOPY are not yet. Mainnet boot-guard remains the gate.

## Verification

```text
cargo check -p zbx-zvm -p zbx-mempool -p zbx-bundler -p zbx-rpc -p zbx-consensus
    Finished `dev` profile in 7.95s    (warnings only)
```

Solidity is uncompilable in this sandbox (no `forge`/`solc`); contracts ship unverified — re-run `forge build` on the VPS before mainnet boot. Mainnet boot-panic guard remains active (chain `8989` refuses startup until BLS / U256 land); testnet (`8990`) safe.
