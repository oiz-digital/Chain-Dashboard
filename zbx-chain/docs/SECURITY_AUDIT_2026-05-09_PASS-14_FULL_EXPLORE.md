# SEC-2026-05-09 Pass-14 — FULL Architect-Grade Explore Audit

Three parallel architect-grade audits across the entire ZBX Chain surface
(Rust L1 + cryptography/networking/RPC + Solidity contracts), filtered
against everything closed in Pass-1 through Pass-13. This is a fresh
deep exploration to catalogue what STILL needs to ship before mainnet.

**Verdict: NOT MAINNET-READY.**
- **5 CRITICAL** + **15 HIGH** + 8 MEDIUM + 3 LOW newly catalogued (or
  re-confirmed still-open).
- Engineering estimate to mainnet-ready: **5–6 weeks** (unchanged from
  Pass-12; Pass-13 chipped 7 items off but did not close any of the
  deep blockers).

---

## CRITICAL findings (5)

### CRIT-01 — ZVM uses u128 not U256 for EVM arithmetic
**Surface:** ZVM | **File:** `crates/zbx-zvm/src/interpreter.rs:154-168` (ADD/MUL/SUB)
**Root cause:** Stack pops to `u128`, `wrapping_add/mul/sub` over u128.
EVM spec mandates U256 modular arithmetic.
**Exploit:** Any DeFi math that uses the high 128 bits (Uniswap V3 sqrtPriceX96,
large bonding curves, Merkle proofs of large trees) will silently diverge from
Ethereum mainnet. AMM/lending pools drainable via crafted inputs that overflow
u128 but are valid U256.
**Fix:** Migrate `stack.rs`, `memory.rs`, all arithmetic in `interpreter.rs`
to `primitive-types::U256` or `ethnum::U256`. Multi-day refactor.

### CRIT-02 — BLS Proof-of-Possession absent at validator registration
**Surface:** Consensus/Staking | **File:** `crates/zbx-staking/src/validator.rs:93-123`
**Root cause:** `ValidatorSet::register` accepts a `BlsPubKey` without
verifying the registrant owns the matching secret.
**Exploit:** Rogue-key attack — a Byzantine validator registers `pk_attacker - Σ pk_honest`,
then aggregate signatures across the set can be forged for arbitrary blocks.
Combined with the still-open `bls_aggregate.rs` XOR stub (Pass-12 known),
this is total consensus bypass on mainnet.
**Fix:** `register(addr, bls_pk, pop_sig)` where `pop_sig = bls_sign(sk, keccak256("ZBX-POP" || addr))`.
Verify before insertion.

### CRIT-03 — RPC WebSocket subscription DoS
**Surface:** RPC | **File:** `crates/zbx-rpc/src/ws_server.rs:121`
**Root cause:** Per-connection `subs: HashMap<id, SubType>` has no size
cap. One client can send thousands of `eth_subscribe` calls.
**Exploit:** Single anonymous WS opens 100k subscriptions → unbounded
memory + O(N) push latency on every block → node OOM or stall.
**Fix:** Cap `subs.len()` at 1024 per connection; reject with
`SUBSCRIPTION_LIMIT_EXCEEDED` once full.

### CRIT-04 — Mempool admits transactions without signature verification
**Surface:** Mempool | **File:** `crates/zbx-mempool/src/pool.rs:134`
**Root cause:** `add_transaction` checks balance, nonce, fee, intrinsic
gas — but never calls `tx.verify_signature()`.
**Exploit:** Network flooding with forged transactions for any
high-balance address (Vitalik's account, exchange hot wallets).
Forged txs propagate via gossip, occupy slots, burn CPU on every peer
until they fail at execution.
**Fix:** Add `tx.verify()?` as the FIRST check in `add_transaction` before
any mutation.

### CRIT-05 — ZbxAMM K-invariant bypass via fee-rounding precision loss
**Surface:** Solidity | **File:** `contracts/ZbxAMM.sol:408`
**Root cause:** K-invariant check uses `uint256` mul-then-div, fee
calculation rounds DOWN. Many small swaps where `amountIn * 0.003`
truncates to 0 bypass the fee entirely.
**Exploit:** Attacker scripts thousands of dust-sized swaps; each pays
0 fee but moves K. Pool drains over hours/days.
**Fix:** Use `Math.mulDiv(..., Rounding.Up)` for the fee-side of the
K invariant; reject swaps where computed fee < 1 wei.

---

## HIGH findings (15)

### Pass-12 Tier-2 Solidity items — re-confirmed STILL OPEN

| ID | Contract:Line | Issue |
|----|---------------|-------|
| HIGH-S01 | `ZbxPaymentGateway.sol:347-364` | `refund()` pays out in `lastInputToken` but debits `inv.token` — cross-token drain |
| HIGH-S02 | `ZbxLiquidStaking.sol:82-90` | First-depositor inflation; share rounds to 0 after `transfer()` gift |
| HIGH-S03 | `ZbxRaffle.sol:204-210` | Three winners derived from one VRF seed via modulo chain — correlated/predictable |
| HIGH-S04 | `ZbxAggregatorV3.sol:126` | No deviation cap on `_closeRound()` median; 51% reporters → price=0 → mass liq |
| HIGH-S05 | `ZbxPredictionMarket.sol:208` | `claim()` uses full `totalPot`; user betting both sides claims twice |
| HIGH-S06 | `ZbxNameService.sol:158` | No commit-reveal; mempool front-running steals registrations |
| HIGH-S07 | `ZbxPayId.sol:191` | `transfer()` doesn't clear `_reverse[oldWallet]` — stale reverse-lookup |
| HIGH-S08 | `ZbxBundler.sol:138` | `slash()` sends to `payable(owner)` — owner can rug bundler stakes |
| HIGH-S09 | `ZbxStaking.sol:366`, `ZbxAMM.sol:463`, `ZbxLaunchpad.sol:341` | Manual ERC20 `call`/`transfer` without SafeERC20 — USDT incompatible |
| HIGH-S10 | `ZbxPaymaster.sol:82` | Sig validation lacks `validUntil` in returned `validationData` |
| HIGH-S11 | `ZbxLaunchpad.sol:293` | `reclaimUnsold` assumes hardCap funded — drains other sales |

### NEW Solidity findings (4)

| ID | Contract:Line | Issue |
|----|---------------|-------|
| HIGH-S12 | `ZbxOracle.sol:99` | `MAX_STALENESS = 1 hour` hardcoded; ZBX 20% drop in 1h → ZUSD mint at stale $1.00 |
| HIGH-S13 | `ZbxStaking.sol:186` | No snapshot voting — flash-loan ZBX → stake → vote → unstake atomically; governance takeover |
| HIGH-S14 | `ZusdVault.sol:215` | `oracle.getPrice(zbx)` ignores `updatedAt` return; stale-feed liquidations |
| HIGH-S15 | `ZbxGovernor.sol` | `execute()` missing `nonReentrant` |

### NEW Rust HIGH findings

**HIGH-R01 — EIP-2929 warm/cold gas missing**
**File:** `crates/zbx-zvm/src/gas.rs:32-33`
SLOAD/SSTORE/CALL hardcoded at 100 gas. Cold-access spam costs node disk
I/O at 21x lower than gas budgets allow → state-access DoS.

**HIGH-R02 — EIP-6780 SELFDESTRUCT not enforced**
**File:** `crates/zbx-zvm/src/interpreter.rs:308-316`
Unconditional value transfer + assumed account deletion. Cancun-spec
contracts will misbehave; "deleted" accounts persist in state.

**HIGH-R03 — Leader selection bias (round-robin)**
**File:** `crates/zbx-consensus/src/hotstuff.rs:318-324`
`proposer_for_round = round % n`. Predictable schedule → targeted DoS
on next N leaders halts chain or enables censorship.

**HIGH-R04 — `eth_getLogs` log-bomb (unbounded result count)**
**File:** `crates/zbx-rpc/src/eth_api.rs:228-236`
Range capped at 2000 blocks but no per-response log-count cap. 10 blocks
× 100k tiny logs each = 1M JSON objects → OOM.

**HIGH-R05 — AA validUntil/validAfter unenforced at bundler-time**
**File:** `crates/zbx-bundler/src/validation.rs`
Bundler accepts UserOps already expired by sealing time → gas burn,
wasted bundle slots, reverting transactions on-chain.

---

## MEDIUM findings (8)

| ID | File:Line | Issue |
|----|-----------|-------|
| MED-01 | `crates/zbx-zvm/src/memory.rs:16-22` | Memory expansion gas (EIP-150 quadratic cost) not charged → linear-cost OOM DoS |
| MED-02 | `crates/zbx-pruner/src/lib.rs` | No trie-node GC → infinite disk growth from abandoned MPT branches |
| MED-03 | `crates/zbx-storage/src/db.rs:52-59` | All RocksDB CFs use `Options::default()`; no per-CF tuning → write-amplification |
| MED-04 | `crates/zbx-threshold/src/dkg.rs:29` | DKG protocol is `KeyShare::new_stub()` — non-functional |
| MED-05 | `crates/zbx-network/src/discovery.rs:38` | Kademlia `KBucket::add` lacks ping-oldest-before-evict → bucket-filling eclipse prerequisite |
| MED-06 | `crates/zbx-xcl/src/handler.rs:265` | Replay-protection check before Merkle proof → timing-oracle on sequence-used probe |
| MED-07 | `crates/zbx-xcl/src/packet.rs:110` | `commitment_key` lacks `src_chain_id` → cross-chain MPT-key collision |
| MED-08 | `contracts/ZbxPayId.sol:152` | `DOMAIN_SEPARATOR` immutable; post-fork chain_id change → cross-fork sig replay |

---

## LOW findings (3)

| ID | File | Issue |
|----|------|-------|
| LOW-01 | `crates/zbx-network/src/transport.rs:10` | Global 16MB `MAX_MESSAGE_SIZE`; should be per-message-type |
| LOW-02 | `Cargo.toml` (workspace) | Caret-requirements on serde/tokio/tracing; pin core crypto deps with `=` |
| LOW-03 | `crates/zbx-types/src/hardfork.rs` + `zbx-executor` wiring | HardforkConfig framework exists but per-opcode activation rules not wired into executor's gas calc |

---

## Already-known OPEN items (not re-investigated this pass; carried forward)

- **PASS-12-BLS** — `crates/zbx-threshold/src/bls_aggregate.rs` is XOR-stub.
  Mainnet-boot panic guard active. Real `blst` / `bls12_381` integration:
  ~2-3 dev-days.
- **Snapshot chunk_root manifest binding (producer side)** — Pass-11 fixed
  consumer; producer never writes the binding root. Light clients trust
  withholding peers until fixed.
- **Real Groth16 verifier** — `crates/zbx-oracle-zk/src/verifier.rs` is
  fail-closed `NotImplemented` (Pass-12). Real BN254 pairing integration
  needed.
- **Executor wiring of Pass-13 helpers** — `ZbxDb::commit_block(...)` and
  `ZvmContext::origin` are present but call-sites (`block_producer`,
  `executor::transact`) still use the legacy non-atomic + zero-origin path.

---

## Recommended sequencing (5–6 weeks)

**Week 1 — quick wins (parallel):**
- CRIT-04 mempool sig-verify (1 day)
- CRIT-03 WS subscription cap (½ day)
- HIGH-R04 log-bomb cap (½ day)
- HIGH-S07/S08/S15 (3 days, contract changes + foundry tests)
- HIGH-R03 VRF leader selection (1 day, wire existing `zbx-crypto` VRF)

**Week 2 — Solidity fixes pass:**
- HIGH-S01..S06, S09..S14 (5 days, 11 contract patches + test sweeps)
- CRIT-05 AMM K-invariant (1 day)
- MED-08 dynamic DOMAIN_SEPARATOR (½ day)

**Week 3 — BLS + crypto:**
- PASS-12-BLS real `blst` integration + benchmarks (3 days)
- CRIT-02 BLS PoP at registration (1 day, depends on real BLS)
- MED-04 real DKG (2 days, FROST round-1/2)

**Weeks 4–5 — ZVM U256 migration:**
- CRIT-01 U256 migration across stack/memory/all opcodes (5 days)
- HIGH-R01 EIP-2929 warm/cold sets (2 days)
- HIGH-R02 EIP-6780 SELFDESTRUCT (1 day)
- MED-01 memory-expansion gas (1 day)
- HIGH-R05 AA validUntil enforcement (1 day)

**Week 6 — Storage + observability + re-audit:**
- MED-02 trie GC (3 days)
- Snapshot chunk_root producer binding (2 days)
- Executor wiring of Pass-13 helpers (1 day)
- Full re-audit + runtime fuzz pass.

**Do NOT bring up mainnet until every CRITICAL is closed AND a
fresh independent re-audit confirms the closures.**

Testnet (chain 8990) remains safe to operate (mainnet-boot guard
still refuses production startup until BLS is real).
