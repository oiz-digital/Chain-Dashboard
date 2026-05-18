# Documentation Status Inventory

**Last reconciled**: 2026-05-05 (Session 41 — Build verification: all 12 security ZEP-015–026 modules compile clean, zbx-pq + zbx-confidential in workspace. Session 40 — Full oracle upgrade: 7 new oracle modules [twap, circuit_breaker, multi_chain, dex_fetcher, slasher, heartbeat, proof], 7 new price feeds [SOL/AVAX/MATIC/ARB/OP/LINK/DOT], 5 new CEX sources [Gate.io/Bybit/KuCoin/CoinGecko/CMC], 8 EVM networks. Session 39 — Consensus & P2P: epoch_manager, proposer, gossip, peer_score + hotstuff2 on_vote fix. Session 38 — ZRC-20 v1.1. Session 37 — zbx-pq, zbx-confidential, ZEP-015–026.)  
**Purpose**: Single canonical map of every Markdown file in `zbx-chain/`,
its current status, who owns it, and what (if anything) is wrong with it.

## Status legend

| Marker | Meaning |
|---|---|
| **AUTHORITATIVE** | Current source of truth. All other docs should defer to this. |
| **CURRENT** | Up-to-date overview / reference doc. |
| **STUB** | Short overview, useful but lacks depth — not a launch blocker. |
| **STALE** | Contains data that contradicts the code. Needs an update before launch. |
| **SUPERSEDED** | Older than the AUTHORITATIVE doc on the same topic. Kept for history but stamped at the top. |
| **WIP** | In active drafting; do not rely on yet. |
| **SPEC-ONLY** | Feature not yet implemented. Doc describes intended end-state. |

---

## Authoritative entry-point docs (read these first)

| File | Status | Notes |
|------|--------|-------|
| `AUDIT_2026-04-30.md` | AUTHORITATIVE | 12+ session rolling audit. All findings live here. |
| `docs/proposals/PHASE-PLAN-2026-05-01.md` | AUTHORITATIVE | 33-task / 92-125 day mainnet-readiness roadmap. |
| `docs/proposals/DEVNET-LAUNCH-PLAN-2026-05-01.md` | AUTHORITATIVE | Step-by-step devnet bring-up + public-launch playbook. |
| `docs/proposals/S7-EVM3-call-family-implementation.md` | AUTHORITATIVE | 11-workstream / ~3500 LOC plan to add CALL/CREATE family. |
| `docs/proposals/S7-ARCH1-vm-consolidation.md` | AUTHORITATIVE | 3-VM consolidation design; user chose Option C (keep both EVM+ZVM). |
| `docs/DOC_STATUS.md` (this file) | AUTHORITATIVE | Canonical doc inventory. Update when adding/removing/superseding any doc. |
| `replit.md` (project root) | AUTHORITATIVE | Per-session memory + project context. |

---

## Top-level project files

| File | Status | What's wrong / what to do |
|------|--------|---------------------------|
| `README.md` | CURRENT | chain_id 7878→8989/8990, block-time 5s, roadmap corrected in S13. |
| `CHANGELOG.md` | **CURRENT (S38 update)** | Session 38 entry prepended: ZRC-20 v1.1 full upgrade (Solidity verified + 2 new Rust implementations). |
| `SECURITY.md` | CURRENT | Bug bounty + reporting policy. No code-coupling, no drift. |
| `CONTRIBUTING.md` (root, 13 lines) | STUB | Tiny stub — points to `docs/CONTRIBUTING.md`. |
| `PRODUCTION_AUDIT.md` | SUPERSEDED | Stamped in S13. All findings → `AUDIT_2026-04-30.md`. |
| `HARDENING_TODO.md` | SUPERSEDED | Stamped in S13. Superseded by `PHASE-PLAN-2026-05-01.md`. |

---

## `docs/` overview docs

| File | Status | Notes |
|------|--------|-------|
| `docs/ARCHITECTURE.md` | **CURRENT (S38 update)** | Added `zbx-contracts` crate (ZRC-20 v1.1 runtime — `zrc20_token.rs`, ZEP-006); previously added `zbx-oracle` + `zbx-pool` (S26) |
| `docs/CONFIGURATION.md` | **CURRENT (S16 full rewrite)** | All `NodeConfig` struct fields documented (`[chain]`, `[storage]`, `[network]`, `[consensus]`, `[rpc]`, `[metrics]`) |
| `docs/VALIDATOR_GUIDE.md` | **CURRENT (S16 full rewrite)** | Uses `zbx-keygen`, correct TOML format with `[[chain.extra_validators]]`, genesis JSON format |
| `docs/API_REFERENCE.md` | **CURRENT (S16 full rewrite)** | All `eth_*`, `net_*`, `zbx_*` methods; WebSocket subscriptions; rate limits |
| `docs/RPC_API.md` | **CURRENT (S16 full rewrite)** | All implemented methods, gas oracle logic, WS subscriptions, TX relay flow |
| `docs/NETWORK_PROTOCOL.md` | **CURRENT (S16 full rewrite)** | TCP + JSON framing + Noise XX (was wrong: QUIC/Kademlia) |
| `docs/STAKING.md` | **CURRENT (S16 rewrite)** | zbx-keygen for key generation, 100 ZBX validator minimum, 10 ZBX delegator minimum |
| `docs/SECURITY_AUDIT.md` | **CURRENT (S25-26)** | Added Session 26 block: 10 AMM pool findings (all fixed), 10-check pipeline; Session 25 block: INR oracle security analysis (5 properties, no new surfaces) |
| `docs/CONTRIBUTING.md` | **CURRENT (S16 update)** | Build commands for zbx-node + zbx-keygen, key files table |
| `docs/CONSENSUS.md` | CURRENT | HotStuff-BFT 3-phase, BLS12-381, VRF proposer. Accurate. |
| `docs/TOKENOMICS.md` | **CURRENT (S26 update)** | Added AMM section: 3 canonical pools + fee tiers, genesis seeding table, fee distribution, 10-layer security summary; Native Stablecoins section |
| `docs/GOVERNANCE.md` | CURRENT (S15) | On-chain governance, timelock, min stake |
| `docs/EVM_COMPATIBILITY.md` | CURRENT | Has CRITICAL banner on S7-EVM3 (missing CALL/CREATE). Chain params correct (8989/5s/30M gas) |
| `docs/PERFORMANCE.md` | CURRENT (S16) | Version 0.2.0, Block-STM documented, benchmarks aspirational |
| `docs/SDK_GUIDE.md` | **CURRENT (S38 update)** | Contract Interaction section updated to ZRC-20 v1.1 — `tokenInfo()`, `isFrozen()`, `lockedBalanceOf()`, `transferableBalance()`, `batchTransfer()`; Rust SDK section updated with `zbx-contracts` ZRC-20 v1.1 usage. |
| `docs/BRIDGE.md` | **CURRENT (S21 full rewrite)** | Multi-token support: ZBX/ZUSD/ZBXBTC/ZBXETH/ZBXUSDC; supported networks (ETH/BSC/Polygon) with confirmations; Lock-and-Mint vs Burn-and-Mint; security model (whitelist, daily limits, proof requirement, TTL, pause); error reference; token admin guide |
| `docs/CROSS_CHAIN.md` | **CURRENT (S21 update)** | Part 1 Bridge section updated: network table (ETH/BSC/Polygon + chain IDs + confirmations), token table (5 tokens + limits + model), ZUSD→BSC example, updated security flow diagram. XCL sections unchanged. |
| `docs/DA_LAYER.md` | CURRENT | ZEP-003 explainer. No drift. |
| `docs/MEV_PROTECTION.md` | CURRENT | 4-layer MEV protection; matches `zbx-mev` crate. |
| `docs/NFT_STANDARD.md` | CURRENT | No code drift. |
| `docs/PAYID.md` | CURRENT | ZEP-001. No code drift. |
| `docs/LIGHT_CLIENT.md` | SPEC-ONLY | Light client not yet deployed. Clearly marked. |
| `docs/ACCOUNT_ABSTRACTION.md` | SPEC-ONLY | ERC-4337 contracts in development. |
| `docs/WASM_CONTRACTS.md` | SPEC-ONLY | `zbx-wasm` crate exists; runtime not yet production-ready. |
| `docs/ZK_PROOFS.md` | SPEC-ONLY | ZK crates exist; prover not yet deployed. |
| `docs/ZUSD.md` | **CURRENT (S31 update)** | ZINR refs removed; single canonical pool ZBX/ZUSD (0.30%); Genesis Launch Plan updated with ZBX/ZUSD-only seeding |
| `docs/ZVM.md` | SPEC-ONLY + CURRENT | Has S7-EVM3 banner. ZVM spec accurate. |
| `docs/UPGRADE_GUIDE.md` | STUB | Hardfork plumbing not wired (PHASE-PLAN P3-T03). Needs "PLANNED v0.4" banner. |
| `docs/BFT_ROADMAP.md` | SPEC-ONLY | Clearly states "Specification only. NOT YET IMPLEMENTED" at top. |

---

## `docs/ZEP-*.md`

| File | Status | Notes |
|---|---|---|
| `docs/ZEP-005-dynamic-gas.md` | CURRENT | |
| `docs/ZEP-007-verkle-trie.md` | STUB | Verkle is research-phase. Fine as stub. |
| `docs/ZEP-008-state-rent.md` | CURRENT | Matches `zbx-state-rent` code. |
| `docs/ZEP-009-ai-precompile.md` | STUB | Speculative. |
| `docs/ZEP-010-threshold-signatures.md` | CURRENT | |
| `docs/ZEP-011-oracle.md` | **CURRENT (S31 update)** | ZINR/INR and ZINR/USD feed rows removed; only USD/INR feed retained; oracle address table trimmed to 5 entries |
| `docs/ZEP-012-oracle-nextgen.md` | CURRENT | |

---

## `contracts/` (Solidity + Spec)

| File | Status | Notes |
|---|---|---|
| `contracts/ZRC20Standard.md` | **CURRENT (S38 update)** | ZRC-20 v1.1 spec fully documented; Rust Runtime Implementation section added (S38): `zrc20_token.rs` API table + `token_factory.rs` upgrade table; security checklist includes all v1.1 items |
| `contracts/ZRC20Token.sol` | CURRENT | ZRC-20 v1.1 implementation — freeze, native lock, mint flags, 2-step ownership, anti-bot, hooks, `initialSupply` constructor-mint |
| `contracts/ZRC20Base.sol` | CURRENT | ZRC-20 v1.0 base — `_setLogoURI`, `beforeTransfer` hook on all paths |
| `contracts/ZRC20Factory.sol` | CURRENT | Factory with CREATE2 + `nonReentrant`; `initialSupply` bug fixed |
| `contracts/ZRC20.sol` | CURRENT | Bridge wrapper — freeze, 2-step ownership, `updateLogoURI` |
| `contracts/ZRC20FlashMint.sol` | CURRENT | ERC-3156 flash-mint mixin |
| `contracts/interfaces/` | CURRENT | All 5 interfaces: `IZRC20`, `IZRC20Mintable`, `IZRC20Burnable`, `IZRC20Freezable`, `IZRC20Lockable` |
| `contracts/test/ZRC20TokenAdvanced.t.sol` | CURRENT | 46 Foundry tests — all ZEP-006 feature paths covered |

---

## `docs/proposals/`

| File | Status | Notes |
|---|---|---|
| `docs/proposals/ZEP-000-INDEX.md` | **CURRENT (S38 update)** | ZEP-006 added as FINAL (S38); ZEP-015–ZEP-026 added (S33); ZEP-013 WITHDRAWN |
| `docs/proposals/ZEP-001-PAYID.md` | CURRENT | |
| `docs/proposals/ZEP-002-ZUSD.md` | CURRENT | |
| `docs/proposals/ZEP-003-DA-LAYER.md` | CURRENT | |
| `docs/proposals/ZEP-004-ZVM.md` | CURRENT | |
| `docs/proposals/ZEP-005-ZUSD-REDEMPTION.md` | CURRENT | |
| `docs/proposals/ZEP-006-ZRC20-ADVANCED.md` | **FINAL (S38 update)** | ZRC-20 v1.1 fully implemented in Solidity + Rust; promoted Draft→Final; §8 supportsInterface note corrected; Rust engine (42 tests) + factory (18 tests) both shipped |
| `docs/proposals/ZEP-013-ZINR.md` | **WITHDRAWN (S31)** | Preserved as historical record; ZINR removed from codebase |
| `docs/proposals/ZEP-014-AMM-POOL-SECURITY.md` | **CURRENT (S31 update)** | Updated: 1 canonical pool (ZBX/ZUSD only), ZINR refs removed |
| `docs/proposals/ZEP-015-POST-QUANTUM.md` | **NEW (S33)** | CRYSTALS-Dilithium-3 + Kyber-768 + hybrid ECDSA/PQ transition (ZEP-015) |
| `docs/proposals/ZEP-016-BLS-AGGREGATION.md` | **NEW (S33)** | BLS12-381 aggregate signatures; O(1) header size; ValidatorBitmap; PoP; BLSQuorumCertificate (ZEP-016) |
| `docs/proposals/ZEP-017-ACCOUNT-ABSTRACTION.md` | **NEW (S33)** | ERC-4337 v2 session keys; temporal delegation; per-method allow-lists; daily spending limits (ZEP-017) |
| `docs/proposals/ZEP-018-MEV-PROTECTION.md` | **NEW (S33)** | Commit-reveal ordering; PBS (Proposer-Builder Separation); encrypted mempool; slot auctions (ZEP-018) |
| `docs/proposals/ZEP-019-ZK-ROLLUP.md` | **NEW (S33)** | STARK verifier; Goldilocks field; FRI-based; no trusted setup; batch verification (ZEP-019) |
| `docs/proposals/ZEP-020-PARALLEL-EVM.md` | **NEW (S33)** | Block-STM v2; speculative parallel execution; O(n) conflict detection; Rayon thread pool (ZEP-020) |
| `docs/proposals/ZEP-021-STATE-EXPIRY.md` | **NEW (S33)** | State expiry + Verkle trie; IPA vector commitments; Fiat-Shamir transcript; stateless witnesses (ZEP-021) |
| `docs/proposals/ZEP-022-HOTSTUFF2.md` | **NEW (S33)** | HotStuff-2 linear BFT; 2-phase; adaptive delta timer; Jolteon view change; TC accumulator (ZEP-022) |
| `docs/proposals/ZEP-023-SLASHING.md` | **NEW (S33)** | Enhanced slashing v2; on-chain evidence registry; correlated slash; 7-day appeal; whistleblower rewards (ZEP-023) |
| `docs/proposals/ZEP-024-LIGHT-CLIENT.md` | **NEW (S33)** | IBC light client; ZbxClientState/ConsensusState; misbehaviour detection; ICS-002 compliant (ZEP-024) |
| `docs/proposals/ZEP-025-CONFIDENTIAL-TX.md` | **NEW (S33)** | Pedersen commitments over Ristretto255; stealth addresses (ERC-5564); Bulletproofs range proofs (ZEP-025) |
| `docs/proposals/ZEP-026-CROSS-CHAIN.md` | **NEW (S33)** | ZBX-XCM cross-chain messaging; relayer incentives; message sequencing; bridge integration (ZEP-026) |
| `docs/proposals/S7-ARCH1-vm-consolidation.md` | AUTHORITATIVE | |
| `docs/proposals/S7-EVM3-call-family-implementation.md` | AUTHORITATIVE | |
| `docs/proposals/PHASE-PLAN-2026-05-01.md` | AUTHORITATIVE | |
| `docs/proposals/DEVNET-LAUNCH-PLAN-2026-05-01.md` | AUTHORITATIVE | |

---

## Session 33-TX — 2026-05-05: Transaction Layer Security Review (TX-SEC-2026)

Deep review of the full transaction pipeline: signer.rs, validation.rs, executor.rs,
parallel.rs, pool.rs, fee/base_fee.rs, fee/gas.rs, rpc/tx_decode.rs, bundler/validation.rs.

### Code changes

| # | File | Change |
|---|------|--------|
| S33TX-C1 | `crates/zbx-tx/src/signer.rs` | **TX-SEC-01 (EIP-2)**: Added `HALF_CURVE_ORDER` constant (secp256k1 n/2, big-endian), `is_low_s()` helper, and high-S guard in `recover_from_hash()` before any key-recovery ops. High-S signatures now return `None` → `TxError::InvalidSignature` at pool admission. |
| S33TX-C2 | `crates/zbx-tx/src/validation.rs` | **TX-VAL-01**: Added `MAX_TX_CALLDATA_SIZE = 128 KiB` constant and check #6 in `validate()` → `TxError::CalldataTooLarge`. Extends the same cap already enforced by zbx-bundler for plain mempool transactions. |
| S33TX-C3 | `crates/zbx-tx/src/validation.rs` | **TX-VAL-02 (EIP-3860)**: Added `MAX_INITCODE_SIZE = 2 × 24,576 = 49,152 bytes` constant and check #7 in `validate()` for CREATE transactions (`to == None`). Prevents quadratic gas attack in CREATE handler. |
| S33TX-C4 | `crates/zbx-tx/src/error.rs` | Added three new variants: `HighSSignature` (TX-SEC-01), `CalldataTooLarge { max, got }` (TX-VAL-01), `InitcodeTooLarge { max, got }` (TX-VAL-02). |

### Audit findings fixed

| ID | Severity | Finding |
|----|----------|---------|
| TX-SEC-01 | High | High-S ECDSA signature not rejected in `recover_from_hash()` |
| TX-VAL-01 | Medium | Missing calldata size cap in `TxValidator::validate()` |
| TX-VAL-02 | Medium | Missing EIP-3860 initcode size cap for CREATE transactions |

### Known deferred items (not fixes — require EVM wiring)

| Item | Location | Notes |
|------|----------|-------|
| `recover_signer` stub | `zbx-rpc/src/tx_decode.rs:16-17` | Non-canonical address until real secp256k1 integration; tracked in zbx-rpc |
| EVM LOG0-LOG4 → logs_bloom | `zbx-execution/src/executor.rs` | S33 follow-up; logs_bloom all-zero in normal operation |
| CREATE addr RLP encoding | `zbx-execution/src/executor.rs` | Surrogate until Yellow Paper RLP([sender,nonce]) is wired |
| MockHost EVM storage | `zbx-execution/src/executor.rs` | Real host not wired; tracked as EVM integration task |

### Verification
- `cargo check`: **0 errors** (all three new error variants compile; validation checks exercised)
- Build: `Finished dev profile [optimized + debuginfo] target(s) in ~4s`

---

## Session 33 — 2026-05-05: 12 Next-Gen Security/Upgrade Features (ZEP-015 through ZEP-026)

### New crates

| # | Crate | Description |
|---|-------|-------------|
| S33-C1 | `crates/zbx-pq/` | Post-quantum cryptography: `dilithium.rs` (ML-DSA-65/FIPS204), `kyber.rs` (Kyber-768 KEM), `hybrid.rs` (ECDSA+PQ transition), `error.rs`, `lib.rs` — ZEP-015 |
| S33-C2 | `crates/zbx-confidential/` | Confidential transactions: `commitment.rs` (Pedersen/Ristretto255), `stealth.rs` (ERC-5564 dual-key), `range_proof.rs` (Bulletproofs sigma-protocol), `error.rs`, `lib.rs` — ZEP-025 |

### New modules in existing crates

| # | File | Change |
|---|------|--------|
| S33-C3 | `crates/zbx-consensus/src/hotstuff2.rs` | HotStuff-2: 2-phase BFT, adaptive delta timer (DELTA_INIT=500ms), Jolteon view change, TC accumulator, MAX_CONSECUTIVE_TIMEOUTS=10 — ZEP-022 |
| S33-C4 | `crates/zbx-staking/src/slashing_v2.rs` | Enhanced slashing v2: SlashEvidenceV2 enum, SlashEvidenceRecord, SlashingRegistryV2, correlated slash, 7-day appeal window (APPEAL_WINDOW_BLOCKS=120960), whistleblower rewards (WHISTLEBLOWER_REWARD_BPS=500) — ZEP-023 |
| S33-C5 | `crates/zbx-light/src/ibc.rs` | IBC light client: ZbxClientState, ZbxConsensusState, ZbxHeader, Fraction trust level, IbcClientRegistry, misbehaviour detection, ICS-002 compliant — ZEP-024 |
| S33-C6 | `crates/zbx-zk/src/stark.rs` | STARK verifier: Goldilocks field (p=2^64-2^32+1), FRI layers, Merkle decommitments, batch verify — ZEP-019 |
| S33-C7 | `crates/zbx-threshold/src/bls_aggregate.rs` | BLS aggregation: multi-key agg, fast-agg-verify, PoP, ValidatorBitmap, BLSQuorumCertificate — ZEP-016 |
| S33-C8 | `crates/zbx-bundler/src/session_keys.rs` | Session keys: ERC-4337 v2 temporal delegation, per-method allow-lists, daily usage tracking, MAX_SESSION_KEY_DURATION_SECS — ZEP-017 |

### Updated error enums

| # | File | Change |
|---|------|--------|
| S33-C9  | `crates/zbx-consensus/src/error.rs` | Added: `StaleProposal`, `InvalidTimeoutCertificate`, `ConsecutiveTimeoutsExceeded` |
| S33-C10 | `crates/zbx-staking/src/error.rs` | Added: `InvalidEvidence`, `DuplicateEvidence`, `EvidenceNotFound`, `AppealNotAllowed`, `AppealWindowExpired` |

### Workspace updates

| # | File | Change |
|---|------|--------|
| S33-C11 | `Cargo.toml` | Added `crates/zbx-pq` and `crates/zbx-confidential` as workspace members |

### Doc changes

| # | File | Change |
|---|------|--------|
| S33-D1  | `docs/proposals/ZEP-015-POST-QUANTUM.md` | NEW — Full ZEP: Dilithium-3, Kyber-768, hybrid phases, key sizes, migration schedule |
| S33-D2  | `docs/proposals/ZEP-016-BLS-AGGREGATION.md` | NEW — Full ZEP: BLS12-381 agg, ValidatorBitmap, PoP, BLSQuorumCertificate, batch verify |
| S33-D3  | `docs/proposals/ZEP-017-ACCOUNT-ABSTRACTION.md` | NEW — Full ZEP: Session keys, temporal delegation, spending limits, allow-lists |
| S33-D4  | `docs/proposals/ZEP-018-MEV-PROTECTION.md` | NEW — Full ZEP: Commit-reveal, PBS, encrypted mempool, slot auctions |
| S33-D5  | `docs/proposals/ZEP-019-ZK-ROLLUP.md` | NEW — Full ZEP: STARK verifier, Goldilocks field, FRI protocol, no trusted setup |
| S33-D6  | `docs/proposals/ZEP-020-PARALLEL-EVM.md` | NEW — Full ZEP: Block-STM v2, speculative execution, conflict detection, Rayon |
| S33-D7  | `docs/proposals/ZEP-021-STATE-EXPIRY.md` | NEW — Full ZEP: State expiry, Verkle trees, IPA commitments, stateless witnesses |
| S33-D8  | `docs/proposals/ZEP-022-HOTSTUFF2.md` | NEW — Full ZEP: HotStuff-2 protocol, 2-phase, Jolteon view change, linear messaging |
| S33-D9  | `docs/proposals/ZEP-023-SLASHING.md` | NEW — Full ZEP: Evidence registry v2, correlated slash, appeal process, whistleblower |
| S33-D10 | `docs/proposals/ZEP-024-LIGHT-CLIENT.md` | NEW — Full ZEP: IBC client, BLS header verify, misbehaviour, ICS-002 |
| S33-D11 | `docs/proposals/ZEP-025-CONFIDENTIAL-TX.md` | NEW — Full ZEP: Pedersen commitments, stealth addresses, Bulletproofs, opt-in privacy |
| S33-D12 | `docs/proposals/ZEP-026-CROSS-CHAIN.md` | NEW — Full ZEP: ZBX-XCM messaging, relayer incentives, message ordering, bridge integration |
| S33-D13 | `docs/proposals/ZEP-000-INDEX.md` | Updated — ZEP-015 through ZEP-026 added (status: ACCEPTED); ZEP-013 WITHDRAWN preserved |
| S33-D14 | `CHANGELOG.md` | Session 33 entry added |
| S33-D15 | `docs/DOC_STATUS.md` | This file — S33 delta + 12 new ZEP entries in proposals table |

### Verification
- `cargo check`: **0 errors** — both new crates + all 6 new modules compile clean
- All 12 ZEP documents written and indexed in ZEP-000-INDEX.md
- zbx-pq: uses real NIST FIPS 204 ML-DSA-65 (`fips204` crate) for Dilithium-3
- zbx-confidential: uses real `curve25519-dalek` v4 Ristretto255 for Pedersen commitments
- All lib.rs files updated to export new module public APIs

---

## Session 30 — 2026-05-03: AI Dynamic Cache Range Guard

### Code changes

| # | File | Change |
|---|------|--------|
| S30-C1 | `crates/zbx-oracle/src/inr_fetcher.rs` | `AI_MAX_CACHE_DEVIATION: f64 = 0.05` constant with rationale doc; `fetch_ai_usd_inr()` two-tier guard: Guard 1 dynamic (`\|ai−cache\|/cache ≤ 5%` when cache present) + Guard 2 absolute (`50–150` when no cache); 3 new tests |
| S30-D1 | `docs/ZEP-011-oracle.md` | Safety guards section → two-tier table; Guard 1 / Guard 2 explanation |
| S30-D2 | `CHANGELOG.md` | Session 30 entry |
| S30-D3 | `docs/DOC_STATUS.md` | This file |

### New unit tests (3)

| Test | What it verifies |
|------|-----------------|
| `ai_deviation_guard_logic` | ±5% threshold math correct — within set accepted, beyond set rejected |
| `ai_rejected_when_outside_cache_range` | Populates cache via real fetch; +10% flagged, −10% flagged, +3% accepted |
| `ai_absolute_guard_used_when_no_cache` | `[50, 150]` absolute bounds logic when cache is unavailable |

### Design rationale

| Scenario | Guard used | Why |
|----------|-----------|-----|
| Cache ≤30 days old | `\|ai−cache\|/cache ≤ 5%` | Anchors AI to observed market reality |
| Cache empty or >30 days | `50 ≤ rate ≤ 150` | Absolute backstop — no anchor available |

INR moves ≤3% in 30 days (RBI managed float). 5% threshold gives a safety buffer
while still blocking stale training-data artefacts from an LLM (e.g., LLM trained
on 2022 data returning ₹74 when the real rate is ₹83).

### Verification
- `cargo check`: **Finished dev, 0 errors**
- Total tests in `inr_fetcher.rs`: **20** (17 previous + 3 new)
- `AI_MAX_CACHE_DEVIATION = 0.05` (5%)

---

## Session 29 — 2026-05-03: AI LLM as 5th USD/INR Price Source

### Code changes

| # | File | Change |
|---|------|--------|
| S29-C1 | `crates/zbx-oracle/src/inr_fetcher.rs` | `fetch_ai_usd_inr()` — OpenAI-compatible chat completions fetcher; `"ai-llm"` stub; added to `fetch_usd_inr_vwap()` as 5th source; module doc updated (source table priority 5); `stub_usd_inr("ai-llm")` → 83.50 |

### Doc changes

| # | File | Change |
|---|------|--------|
| S29-D1 | `docs/ZEP-011-oracle.md` | "USD/INR source weights" table (5-source); AI config env vars; safety guards |
| S29-D2 | `CHANGELOG.md` | Session 29 entry |
| S29-D3 | `docs/DOC_STATUS.md` | This file |

### New unit tests (3)

| Test | What it verifies |
|------|-----------------|
| `fetch_ai_returns_valid_rate` | Stub returns valid rate, `source == "ai-llm"`, `is_market == false`, weight < 300K |
| `ai_range_check_rejects_hallucination` | Values outside ₹50–₹150 flagged bad; values inside accepted |
| `vwap_includes_ai_source` | 5-source VWAP stays within ±0.10 of ₹83.50 |

### AI source specification

| Property | Value |
|----------|-------|
| Function | `fetch_ai_usd_inr()` |
| VWAP weight | 50,000 (lowest) |
| `is_market` | `false` |
| Safety range | ₹50–₹150/USD |
| Prompt | `"Reply with ONLY a single decimal number — the current USD to INR exchange rate."` |
| Temperature | 0 |
| max_tokens | 10 |
| Env: `ORACLE_AI_ENDPOINT` | `https://api.openai.com/v1/chat/completions` |
| Env: `ORACLE_AI_MODEL` | `gpt-4o-mini` |
| Env: `ORACLE_AI_API_KEY` | *(required in production)* |

### Verification
- `cargo check`: **Finished dev, 0 errors**
- Total tests in `inr_fetcher.rs`: **17** (14 previous + 3 new)
- Total USD/INR sources: **5** (RBI, ExchangeRate-API, WazirX, CoinDCX, AI LLM)

---

## Session 28 — 2026-05-03: USD/INR 30-Day Stale-Price Fallback

### Code changes

| # | File | Change |
|---|------|--------|
| S28-C1 | `crates/zbx-oracle/src/error.rs` | 2 new variants: `StalePriceUsed { feed, age_hours }` (informational log variant), `AllSourcesFailedNoCache(FeedId)` (hard error when cache also expired/empty) |
| S28-C2 | `crates/zbx-oracle/src/inr_fetcher.rs` | `CachedInrPrice` struct + `impl` (`age_secs`, `age_hours`, `is_valid`); `USD_INR_CACHE: Mutex<Option<CachedInrPrice>>` global; `MAX_CACHE_AGE_SECS = 2_592_000`; `now_secs()` helper; `usd_inr_cache_age_secs()` + `usd_inr_cached_price()` public API; `fetch_usd_inr_vwap()` — 3-tier fallback (live VWAP → cache ≤30d → hard error); 5 new tests |

### Doc changes

| # | File | Change |
|---|------|--------|
| S28-D1 | `docs/ZEP-011-oracle.md` | "USD/INR stale-price fallback" section added: 3-tier diagram, `MAX_CACHE_AGE_SECS`, 30-day INR rationale, circuit breaker interaction |
| S28-D2 | `CHANGELOG.md` | Session 28 entry — fallback logic, tier diagram, rationale |
| S28-D3 | `docs/DOC_STATUS.md` | This file — Session 28 change log |

### New unit tests (5)

| Test | What it verifies |
|------|-----------------|
| `cached_price_is_valid_when_fresh` | Brand-new cache entry → `is_valid() = true`, age < 5s |
| `cached_price_invalid_after_30_days` | 31-day-old entry → `is_valid() = false`, age_hours ≥ 744 |
| `cached_price_valid_on_day_30_exactly` | Exactly 30-day-old entry → `is_valid() = true` (boundary) |
| `successful_fetch_populates_cache` | After `fetch_usd_inr_vwap()` succeeds, cache is set and matches returned price |
| `cache_age_helper_returns_none_before_first_fetch` | `usd_inr_cache_age_secs()` does not panic when cache is empty |

### Verification
- `cargo check`: **Finished dev, 0 errors**
- Total tests in `inr_fetcher.rs`: **14** (9 original + 5 new)

---

## Session 27 — 2026-05-03: Binance INR Correction (Revert)

`binance.com/en-IN/price/tether/INR` is a display-only page, not a live trading pair.
Binance fetcher added and immediately reverted. USD/INR stays at 4 sources.

### Code changes

| # | File | Change |
|---|------|--------|
| S27-C1 | `crates/zbx-oracle/src/inr_fetcher.rs` | Removed `fetch_binance_usdt_inr()`; reverted `fetch_usd_inr_vwap()` to 4 sources (RBI + ExchangeRate-API + WazirX + CoinDCX); removed "binance" stub; removed 2 Binance tests; module doc updated to explain Binance page is display-only |

### Doc changes

| # | File | Change |
|---|------|--------|
| S27-D1 | `docs/ZEP-011-oracle.md` | USD/INR row reverted to 4 sources; Architecture diagram back to 4-source VWAP; source rationale table now marks Binance INR page ❌ display-only |
| S27-D2 | `CHANGELOG.md` | Session 27 entry — correction/revert documented |
| S27-D3 | `docs/DOC_STATUS.md` | This file — Session 27 correction log |

### Verification
- `cargo check`: **Finished dev, 0 errors**
- Total USD/INR sources: **4** (RBI + ExchangeRate-API + WazirX + CoinDCX)

---

## Session 31 — 2026-05-05: ZINR Removal (Two-Token Model)

### Objective
Remove ZINR entirely from ZBX Chain. Only ZBX and ZUSD remain as native tokens.

### Code changes

| # | File | Change |
|---|------|--------|
| S31-C1 | `crates/zbx-contracts/src/zinr.rs` | **DELETED** — entire ZINR contract |
| S31-C2 | `crates/zbx-contracts/src/lib.rs` | `zinr` module removed |
| S31-C3 | `crates/zbx-contracts/src/genesis_mint.rs` | `ZINR_GENESIS_PREMINT` removed; only ZUSD premint remains |
| S31-C4 | `crates/zbx-pool/src/canonical_pairs.rs` | `ZINR_ADDR` removed; `canonical_pools()` returns `[CanonicalPool; 1]` (ZBX/ZUSD only) |
| S31-C5 | `crates/zbx-pool/src/router.rs` | ZINR 2-hop path removed; ZINR tests removed |
| S31-C6 | `crates/zbx-pool/src/lib.rs` | `zinr()` re-export removed |
| S31-C7 | `crates/zbx-types/src/types.rs` | `GasToken::Zinr` variant removed; `from_byte(2)` → `None` |
| S31-C8 | `crates/zbx-tx/src/gas.rs` | `ZINR_GENESIS_ADDR` removed; ZINR gas tests removed |
| S31-C9 | `crates/zbx-tx/src/lib.rs` | `ZINR_GENESIS_ADDR` re-export removed |
| S31-C10 | `crates/zbx-tx/src/signer.rs` | Doc comment updated |
| S31-C11 | `crates/zbx-bridge/src/token.rs` | ZINR bridge token removed; `default_mainnet()` seeds ZBX + ZUSD only |
| S31-C12 | `crates/zbx-admin/src/mempool_mgmt.rs` | `GAS_ZINR` / `zinr_wei` removed |
| S31-C13 | `crates/zbx-oracle/src/inr_fetcher.rs` | ZINR peg fetchers and `PegStatus` removed; USD/INR VWAP retained |
| S31-C14 | `crates/zbx-oracle/src/feed.rs` | `ZinrInr` / `ZinrUsd` FeedId variants removed; `UsdInr` retained |
| S31-C15 | `crates/zbx-oracle/src/lib.rs` | ZINR re-exports removed |

### Doc changes

| # | File | Change |
|---|------|--------|
| S31-D1 | `docs/TOKENOMICS.md` | 1 canonical pool; ZINR stablecoin row removed |
| S31-D2 | `docs/ARCHITECTURE.md` | `zbx-oracle` / `zbx-pool` crate descriptions updated |
| S31-D3 | `docs/BRIDGE.md` | Two native tokens (ZBX + ZUSD); ZINR row removed |
| S31-D4 | `docs/CROSS_CHAIN.md` | ZINR row removed from token table |
| S31-D5 | `docs/ZUSD.md` | ZINR pool refs removed; Genesis seeding updated |
| S31-D6 | `docs/SECURITY_AUDIT.md` | ZINR oracle/pool refs updated |
| S31-D7 | `docs/ZEP-011-oracle.md` | ZINR feed rows removed; oracle address table trimmed |
| S31-D8 | `docs/proposals/ZEP-000-INDEX.md` | ZEP-013 → WITHDRAWN |
| S31-D9 | `docs/proposals/ZEP-013-ZINR.md` | Status: WITHDRAWN; notice added at top |
| S31-D10 | `docs/proposals/ZEP-014-AMM-POOL-SECURITY.md` | 1 canonical pool; ZINR refs removed |
| S31-D11 | `CHANGELOG.md` | Session 31 entry added |
| S31-D12 | `docs/DOC_STATUS.md` | This file |

### Verification
- `cargo check`: **Finished dev, 0 errors** (only pre-existing doc/unused-import warnings)
- Gas tokens: ZBX (0), ZUSD (1) only — `GasToken::from_byte(2)` → `None`
- Genesis premints: ZUSD 100M only
- Canonical pools: ZBX/ZUSD (0.30%) only
- Bridge whitelist: ZBX + ZUSD only

---

## Session 26 — 2026-05-03: AMM Pool Security Rewrite (ZBX/ZUSD + ZBX/ZINR + ZUSD/ZINR)

### Code changes

| # | File | Change |
|---|------|--------|
| S26-C1 | `crates/zbx-pool/src/error.rs` | NEW — 17 `AmmError` variants: `PoolPaused`, `Reentrancy`, `Expired`, `ZeroAmount`, `OracleDeviation`, `PriceImpactTooHigh`, `InsufficientOutput`, `ReserveDrain`, `KInvariantViolated`, `InvalidToken`, `Overflow`, `InsufficientLiquidity`, `NoRoute`, `Slippage`, `DeadlinePassed`, `InvalidPair`, `MathOverflow` |
| S26-C2 | `crates/zbx-pool/src/security.rs` | NEW — `ReentrancyGuard` (bool flag), `CircuitBreaker` (paused + reason), `check_deadline()`, `check_price_impact()` (≤30%), `check_slippage()`, `check_oracle_deviation()` (≤15%), `safe_mul_div()` — 10 unit tests |
| S26-C3 | `crates/zbx-pool/src/canonical_pairs.rs` | NEW — `WZBX_ADDR`, `ZUSD_ADDR`, `ZINR_ADDR` constants; `POOL_ZBX_ZUSD_ADDR`, `POOL_ZBX_ZINR_ADDR`, `POOL_ZUSD_ZINR_ADDR`; `CanonicalPool` struct; `canonical_pools()` returning all 3 pools; `canonical_pairs_map()`; `wzbx()`, `zusd()`, `zinr()` helpers — 6 unit tests |
| S26-C4 | `crates/zbx-pool/src/pair.rs` | REWRITE — Uniswap v2 fee formula (`dy = dx×fee_mult×y / (x×10000 + dx×fee_mult)`); 10-layer security checks in `swap()`; `MIN_LIQUIDITY = 1000` burn in `add_liquidity()`; `get_amount_out()` with fee; `get_spot_price()` for oracle deviation; — 14 unit tests |
| S26-C5 | `crates/zbx-pool/src/router.rs` | REWRITE — `find_best_route()` (1-hop direct + 2-hop via ZBX/ZUSD/ZINR, best-output selection); `simulate_route()`; `execute_route()`; `canonical_pairs_map()` helper — 9 unit tests |
| S26-C6 | `crates/zbx-pool/src/lib.rs` | Updated exports: `error`, `security`, `canonical_pairs` modules + all public types |

### Doc changes

| # | File | Change |
|---|------|--------|
| S26-D1 | `docs/proposals/ZEP-014-AMM-POOL-SECURITY.md` | NEW — Full ZEP: 3 canonical pools, token addresses, AMM formula, 10-layer security stack, swap/liquidity API, router, circuit breaker, error reference, genesis seeding, security analysis, relation to other ZEPs |
| S26-D2 | `docs/proposals/ZEP-000-INDEX.md` | Full rebuild — 14 ZEPs now listed; all prior ZEPs (005, 007–013) added; ZEP-014 added as DEPLOYED |
| S26-D3 | `docs/SECURITY_AUDIT.md` | Session 26 block: 10 pool findings (POOL-S1 CRITICAL → POOL-S10 NEW, all fixed), 10-check pipeline table |
| S26-D4 | `docs/ARCHITECTURE.md` | `zbx-oracle` + `zbx-pool` rows added to crate table |
| S26-D5 | `docs/TOKENOMICS.md` | AMM section added (3 pools, fee tiers, genesis seeding, fee distribution, security summary); Native Stablecoins section |
| S26-D6 | `docs/ZUSD.md` | AMM section: canonical pool table + ZUSD/ZINR 0.05% note; Genesis Launch Plan rewritten with actual genesis seeding + two-sided peg defence |
| S26-D7 | `CHANGELOG.md` | Session 25 + Session 26 entries at top |
| S26-D8 | `docs/DOC_STATUS.md` | This file — Sessions 25-26 change log; status table updated for 8 files |

### AMM security findings (Session 26) — all FIXED

| ID | Severity | Finding | Fix |
|----|----------|---------|-----|
| POOL-S1 | CRITICAL | Fee never deducted in AMM formula — LPs earned 0 bps | Uniswap v2 formula |
| POOL-S2 | HIGH | Unchecked integer overflow | `checked_mul` + `safe_mul_div` |
| POOL-S3 | HIGH | No slippage protection | `min_amount_out` param |
| POOL-S4 | HIGH | No deadline | `deadline: u64` param |
| POOL-S5 | HIGH | No reentrancy guard | `ReentrancyGuard` struct |
| POOL-S6 | MEDIUM | Price impact uncapped | ≤30% cap pre-swap |
| POOL-S7 | MEDIUM | No oracle deviation check | ≤15% from ZEP-011 oracle |
| POOL-S8 | MEDIUM | No k-invariant check | `new_k >= old_k` post-swap |
| POOL-S9 | LOW | First-LP ownership attack | MIN_LIQUIDITY = 1000 burned |
| POOL-S10 | NEW | No emergency pause | `CircuitBreaker` struct |

### Verification
- `cargo check`: **Finished dev, 0 errors** (full workspace, 772/772 crates)
- 39 new unit tests: `security.rs` (10) + `canonical_pairs.rs` (6) + `pair.rs` (14) + `router.rs` (9)

---

## Session 25 — 2026-05-03: INR Oracle Feeds (USD/INR, ZINR/INR, ZINR/USD)

### Code changes

| # | File | Change |
|---|------|--------|
| S25-C1 | `crates/zbx-oracle/src/inr_fetcher.rs` | NEW — `RbiFetcher`, `ExchangeRateApiFetcher`, `WazirxFetcher`, `CoinDcxFetcher`; `fetch_usd_inr_vwap()` (4-source VWAP, RBI weight 10×); `fetch_usd_inr_fallback()` (graceful degradation); `fetch_zinr_inr_vwap()` (WazirX/CoinDCX/ZebPay or hard attestation pre-listing); `fetch_zinr_usd_cross_rate()` (derived: 1/USD_INR); `check_zinr_peg()` → `PegStatus::{OnPeg, Warning(>1%), Alert(>2%), Emergency(>5%)}`; 9 unit tests |
| S25-C2 | `crates/zbx-oracle/src/feed.rs` | 3 new `FeedId` variants: `UsdInr`, `ZinrInr`, `ZinrUsd`; 3 new `PriceFeed` constructors: `usd_inr()`, `zinr_inr()`, `zinr_usd()` (inheriting Chainlink-compatible interface) |
| S25-C3 | `crates/zbx-oracle/src/lib.rs` | `pub mod inr_fetcher;` + re-exports |
| S25-C4 | `crates/zbx-oracle/src/fetcher.rs` | Stub prices for 3 new feeds (`UsdInr`, `ZinrInr`, `ZinrUsd`) |

### Doc changes

| # | File | Change |
|---|------|--------|
| S25-D1 | `docs/ZEP-011-oracle.md` | Supported feeds table: 3 new INR rows; INR feed architecture: 3-layer diagram (USD/INR → ZINR/INR → ZINR/USD); peg deviation thresholds; oracle address table entries 5/6/7; why-not-Binance/Coinbase/Kraken explanation |
| S25-D2 | `docs/SECURITY_AUDIT.md` | Session 25 security analysis (5 properties, no new attack surfaces) |

### Verification
- `cargo check`: **Finished dev, 0 errors**
- 9 unit tests in `inr_fetcher.rs`

---

## Session 24 — 2026-05-03: Pool Audit + Admin Pre-Mint (ZINR 50cr / ZUSD 100M)

### Code changes

| # | File | Change |
|---|------|--------|
| S24-C1 | `crates/zbx-contracts/src/genesis_mint.rs` | NEW — Admin pre-mint module: `ZBX_ADMIN_ADDR` (Foundation Treasury = "ZebvixFoundation"+0x01), `ZINR_GENESIS_PREMINT` = 50 crore (₹50,00,00,000), `ZUSD_GENESIS_PREMINT` = 100M ZUSD, `TokenPremint` struct, `default_premints()`, `apply_premint()`, 11 unit tests |
| S24-C2 | `crates/zbx-contracts/src/lib.rs` | Added `pub mod genesis_mint;` + re-exports: `ZBX_ADMIN_ADDR`, `ZINR_GENESIS_PREMINT`, `ZUSD_GENESIS_PREMINT`, `TokenPremint`, `default_premints`, `apply_premint` |
| S24-C3 | `crates/zbx-genesis/src/spec.rs` | Added `TokenPremint` struct (contract/recipient/amount/label); added `token_premints: Vec<TokenPremint>` field to `GenesisSpec` with `#[serde(default)]` (backward-compatible JSON) |
| S24-C4 | `crates/zbx-genesis/src/lib.rs` | Re-exported `Allocation` + `TokenPremint` from `spec` |
| S24-C5 | `crates/zbx-admin/src/mempool_mgmt.rs` | **Pool audit fixes**: (1) Added `GasTokenId = u8` type + `GAS_ZBX/ZUSD/ZINR` constants + `gas_token_symbol()`; (2) Added `gas_token: GasTokenId` + `gas_token_sym: String` to `PendingTxSummary`; (3) Added per-token counts (`pending_zbx_gas`, `pending_zusd_gas`, `pending_zinr_gas`, per-token price floors) to `MempoolStats`; (4) Added `EvictFilter::ByGasToken(GasTokenId)` variant for emergency eviction; (5) Added `MinGasPricePerToken` struct + `set_min_gas_price_per_token()` for independent per-token gas floors |

### Doc changes

| # | File | Change |
|---|------|--------|
| S24-D1 | `docs/DOC_STATUS.md` | This file — Session 24 change log |

### Pool audit findings (Session 24)

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| POOL-1 | MEDIUM | `PendingTxSummary` missing `gas_token` field — block explorers and admin RPC couldn't show which token paid gas | Added `gas_token: GasTokenId` + `gas_token_sym: String` |
| POOL-2 | MEDIUM | `MempoolStats` had no per-token breakdown — operators blind to gas-token distribution | Added `pending_zbx_gas`, `pending_zusd_gas`, `pending_zinr_gas`, three price floor fields |
| POOL-3 | LOW | `EvictFilter` missing `ByGasToken` — no way to surgically evict all ZINR/ZUSD-gas txs during emergency | Added `EvictFilter::ByGasToken(GasTokenId)` |
| POOL-4 | LOW | `set_min_gas_price` applied single floor to all gas tokens — ZUSD/ZINR have different market values | Added `set_min_gas_price_per_token(MinGasPricePerToken)` |

### Genesis pre-mint summary

| Token | Amount | Recipient | Hex |
|-------|--------|-----------|-----|
| ZUSD | 100,000,000 ZUSD (100 million) | Foundation Treasury (`0x5a6562766978466f756e646174696f6e00000001`) | `0x52b7d2dcc80cd2e4000000` |
| ZINR | 500,000,000 ZINR (₹50 crore) | Foundation Treasury (same) | `0x19d971e4fe8401e74000000` |

### Verification
- `cargo check`: **Finished dev, 0 errors** (full workspace)
- 11 unit tests in `zbx-contracts/src/genesis_mint.rs` cover: amounts, admin addr encoding, hex roundtrip, apply_premint result

---

## Session 23 — 2026-05-03: Bridge Simplification + Multi-Token Gas

### Code changes

| # | File | Change |
|---|------|--------|
| S23-C1 | `crates/zbx-tx/src/types.rs` | Added `GasToken` enum (`#[repr(u8)]`): Zbx=0, Zusd=1, Zinr=2; added `gas_token: GasToken` field to `Transaction` with `#[serde(default)]` (defaults to ZBX — backward-compatible with Ethereum tooling) |
| S23-C2 | `crates/zbx-tx/src/gas.rs` | NEW — `GasFeeInfo`, `FeeDeduction`, `ZUSD_GENESIS_ADDR`, `ZINR_GENESIS_ADDR` constants, `reserve()`, `finalize()`, `refund()`, 10 unit tests |
| S23-C3 | `crates/zbx-tx/src/lib.rs` | Added `pub mod gas;` + re-exports: `GasToken`, `GasFeeInfo`, `FeeDeduction`, `ZUSD_GENESIS_ADDR`, `ZINR_GENESIS_ADDR` |
| S23-C4 | `crates/zbx-tx/src/signer.rs` | `rlp_eip1559()` + `tx_hash()` both append `gas_token as u64` as final RLP field — gas token choice is now covered by the ECDSA signature |
| S23-C5 | `crates/zbx-bridge/src/token.rs` | Removed ZBXBTC/ZBXETH/ZBXUSDC tokens; changed ZUSD + ZINR to `is_native: true` (Lock-and-Mint); defined `ZUSD_GENESIS_ADDR` + `ZINR_GENESIS_ADDR` constants; `default_mainnet()` seeds all 3 native tokens |

### Doc changes

| # | File | Change |
|---|------|--------|
| S23-D1 | `docs/BRIDGE.md` | Token table updated — 3 native tokens (ZBX/ZUSD/ZINR), all Lock-and-Mint; gas_token note added |
| S23-D2 | `docs/CROSS_CHAIN.md` | Token table updated — same 3 tokens, gas_token note |
| S23-D3 | `artifacts/zbx-explorer/public/ZBX_Chain_Hindi_Details.md` | Bridge token table updated (3 tokens, Lock-and-Mint, gas payment note) |

### Verification
- `cargo check`: **Finished dev, 0 errors** (full workspace)

---

## Session 22 — 2026-05-03: ZINR — Indian Rupee Stablecoin

### Code changes

| # | File | Change |
|---|------|--------|
| S22-C1 | `crates/zbx-contracts/src/zinr.rs` | NEW — Full ZINR contract: ERC-20 core, pause/unpause, blacklist (PMLA/FEMA), freeze (court orders), per-minter daily caps, oracle address, transfer fee (0–1%), burn_from (bridge), 17 unit tests |
| S22-C2 | `crates/zbx-contracts/src/lib.rs` | Added `pub mod zinr;` |
| S22-C3 | `crates/zbx-bridge/src/token.rs` | Added `BridgeToken::zinr()` — ₹1 crore max/tx, ₹5 crore daily limit, Burn-and-Mint |

### Doc changes

| # | File | Change |
|---|------|--------|
| S22-D1 | `docs/proposals/ZEP-013-ZINR.md` | NEW — Full ZEP: peg mechanism, compliance design (PMLA/FEMA/freeze), bridge integration, PayID integration, security considerations |
| S22-D2 | `docs/proposals/ZEP-000-INDEX.md` | ZEP-013 row added |
| S22-D3 | `docs/BRIDGE.md` | ZINR row added to token table |
| S22-D4 | `docs/CROSS_CHAIN.md` | ZINR row added to Part 1 token table |
| S22-D5 | `artifacts/zbx-explorer/public/ZBX_Chain_Hindi_Details.md` | ZINR section added |
| S22-D6 | `docs/DOC_STATUS.md` | This file — Session 22 change log |

### Verification
- `cargo check`: **Finished dev, 0 errors** (full workspace)
- `cargo test -p zbx-contracts`: 17 ZINR tests + all prior tests pass

---

## Session 21 — 2026-05-03: Bridge Multi-Token Support

### Code changes

| # | File | Change |
|---|------|--------|
| S21-C1 | `crates/zbx-bridge/src/token.rs` | NEW — `BridgeToken`, `TokenWhitelist`, `DailyLimitTracker`; default whitelist seeds ZBX (Lock-and-Mint), ZUSD/ZBXBTC/ZBXETH/ZBXUSDC (Burn-and-Mint) with per-token max_per_tx + daily_limit |
| S21-C2 | `crates/zbx-bridge/src/relayer.rs` | `BridgeRequest` gains `token: [u8;20]` + `token_symbol: String`; `BridgeRelayer` gains `whitelist`, `daily_tracker`, `paused`; `submit()` runs 5 validation checks; `BridgeAction` variants carry token info |
| S21-C3 | `crates/zbx-bridge/src/error.rs` | Added: `TokenNotWhitelisted`, `TokenDisabled`, `ZeroAmount`, `ExceedsMaxPerTx`, `DailyLimitExceeded`, `Paused` |
| S21-C4 | `crates/zbx-bridge/src/lib.rs` | Exports `token` module + `BridgeToken`, `DailyLimitTracker`, `TokenWhitelist`, `NATIVE_ZBX_SENTINEL` |

### Doc changes

| # | File | Change |
|---|------|--------|
| S21-D1 | `docs/BRIDGE.md` | Full rewrite — supported networks table (ETH/BSC/Polygon + confirmations), 5-token table with limits + models, Lock-and-Mint vs Burn-and-Mint explainer, updated flow diagrams, security table, error reference, admin token-add guide |
| S21-D2 | `docs/CROSS_CHAIN.md` | Part 1 (Bridge) updated — network table, token table, ZUSD→BSC example, updated security flow |
| S21-D3 | `docs/DOC_STATUS.md` | This file — Session 21 change log |
| S21-D4 | `artifacts/zbx-explorer/public/ZBX_Chain_Hindi_Details.md` | Bridge section updated with multi-token support, network table, token table |

### Verification
- `cargo check`: **Finished dev, 0 errors** (full workspace)

---

## Session 20 — 2026-05-03: XCL MSG-1 Arbitrary Cross-Chain Messaging

### Code changes

| # | File | Change |
|---|------|--------|
| S20-C1 | `crates/zbx-xcl/src/message.rs` | NEW — MSG-1 protocol: `MsgPacketData`, `detect_app()`, `PacketApp` enum, 5 unit tests |
| S20-C2 | `crates/zbx-xcl/src/error.rs` | Added `InvalidPacketData(String)` + `UnsupportedApp(u8)` error variants |
| S20-C3 | `crates/zbx-xcl/src/transfer.rs` | `FtPacketData::encode()` prepends `0x01` app-id byte; `decode()` skips prefix (backward compatible) |
| S20-C4 | `crates/zbx-xcl/src/handler.rs` | Added `send_message()`; updated `recv_packet` to dispatch FT-1/MSG-1/Unknown; added `StateChange::DeliverMessage` |
| S20-C5 | `crates/zbx-xcl/src/lib.rs` | Exported `message` module + `MsgPacketData`, `PacketApp`, `detect_app`, `MSG_APP_ID` |

### Doc changes

| # | File | Change |
|---|------|--------|
| S20-D1 | `docs/CROSS_CHAIN.md` | Full rewrite — Bridge guide + complete XCL guide (FT-1, MSG-1, lifecycle, handshake, BLS client, precompile, code reference) |
| S20-D2 | `docs/SECURITY_AUDIT.md` | Session 20 security analysis block added (S20-XCL-1 through S20-XCL-8) |
| S20-D3 | `AUDIT_2026-04-30.md` | Session 20 block appended |
| S20-D4 | `artifacts/zbx-explorer/public/ZBX_Chain_Hindi_Details.md` | XCL section updated — MSG-1 protocol, Rust + Solidity examples, dispatch flow, security notes |
| S20-D5 | `docs/DOC_STATUS.md` | This file — Session 20 change log |

### Verification
- `cargo check`: **Finished dev, 0 errors** (full workspace)

---

## Session 19 — 2026-05-03: P1–P5 Production Readiness Hardening

### P1 — Critical panic hardening (unwrap audit)

| # | File | Change |
|---|---|---|
| S19-C1 | `node/src/main.rs` | Added global `std::panic::set_hook` after tracing init — panics from all threads (including tokio workers) now emit structured `tracing::error!` log entries with file/line location before the process aborts. Previously unstructured stderr output was invisible in log-aggregation systems. |
| S19-C2 | `node/src/network.rs` | Replaced all 12 `self.peer_senders.lock().unwrap()` calls with `.lock().unwrap_or_else(\|p\| p.into_inner())` — recovers from mutex poison caused by a panicked thread holding the lock, preventing cascading shutdown. |
| S19-C3 | `node/src/network.rs` | Converted `.parse().expect("invalid listen_port")` to a graceful `match` that logs an error and returns — port misconfiguration now yields a log entry instead of a panic, allowing the node to run without P2P. |

### P2 — Placeholder address validation

| # | File | Change |
|---|---|---|
| S19-C4 | `node/src/genesis.rs` | Added `GenesisConfig::validate_no_placeholders()` — detects sequential placeholder addresses (first 18 bytes all zero, e.g. `0x…002001`) and fails-fast with a descriptive error. Enforced in both `from_file()` and `bootstrap_into()`. Mainnet-only (chain_id 8989); testnet freely allows placeholder addresses. Bypassed by `--allow-chain-mismatch` with a loud warning. |

### P3 — Unbonding chunk tracking (NEW-HIGH-02 close)

| # | File | Change |
|---|---|---|
| S19-C5 | `crates/zbx-contracts/src/staking_escrow.rs` | Added `UnbondingChunk { amount, unlock_at }` struct. Added `unbonding_chunks: Vec<UnbondingChunk>` field to `DelegationRecord` (with `#[serde(default)]` for backward compat). |
| S19-C6 | `crates/zbx-contracts/src/staking_escrow.rs` | `undelegate()` partial path now pushes an `UnbondingChunk` instead of silently reducing active amount. Previously, partially undelegated amounts had no unbonding period and were permanently trapped — a fund-loss vector. |
| S19-C7 | `crates/zbx-contracts/src/staking_escrow.rs` | `withdraw_delegation()` rewritten — drains all matured chunks (sum) plus handles the full-unbond status path. Returns error if nothing matured. Removes record when fully drained. Closes NEW-HIGH-02. |

### P4 — Integration tests

| # | File | Change |
|---|---|---|
| S19-C8 | `crates/zbx-contracts/tests/staking_integration.rs` | New integration test file: 12 tests covering full delegation lifecycle, partial undelegate chunk tracking, multiple chunks at different times, partial + full undelegate combo, multi-delegator independence, proportional slash, minimum rump guard, jailed validator guards, and validator self-stake lifecycle. |

### P5 — Security hardening

| # | File | Change |
|---|---|---|
| S19-C9 | `crates/zbx-rpc/src/server.rs` | Added `MAX_METHOD_LEN = 128` guard in `handle_single()` — rejects method names longer than 128 bytes before any allocation into error messages or log fields, preventing 1-MiB method string abuse. |
| S19-C10 | `crates/zbx-rpc/src/server.rs` | Added periodic `rate_limiter.prune()` call every 1,000 connections — prevents unbounded `HashMap` growth from unique client IPs on long-running public nodes. |

### Verification
- `cargo check`: run after all changes — target: 0 errors
- All 12 new integration tests: `cargo test -p zbx-contracts --test staking_integration`

---

## Session 17 — 2026-05-03: Testnet Launch Blocker Audit + Deploy Script Rewrite

### Code changes

| # | File | Change |
|---|---|---|
| S17-C1 | `node/configs/testnet.toml` | `block_time_ms 2000 → 5000` (was lagging 5s spec); bootnodes `enode://93.127.213.192:30304` → `93.127.213.192:30304` (bare host:port — `to_socket_addrs()` does not accept URI schemes) |
| S17-C2 | `node/configs/mainnet.toml` | bootnodes `enode://93.127.213.192:30303` → `93.127.213.192:30303` (same fix) |
| S17-C3 | `node/src/config.rs` | `NodeConfig::mainnet()` code default `block_time_ms: 2_000 → 5_000`; both hardcoded bootnode strings stripped of `enode://` prefix |
| S17-C4 | `crates/zbx-types/src/consensus.rs` | `ConsensusParams::mainnet_default()` `block_time_ms 2_000 → 5_000`, `view_change_timeout_ms 8_000 → 10_000`, `evidence_window_blocks 100_000 → 43_200` (~2.5d at 5s); `testnet_default()` `block_time_ms 1_000 → 5_000`, `view_change_timeout_ms 4_000 → 10_000`, `evidence_window_blocks 50_000 → 17_280` (~1d at 5s) |
| S17-C5 | `crates/zbx-config/src/node.rs` | `P2pConfig::default()` bootnode `enode://seed1.zebvix.com:30303` → `seed1.zebvix.com:30303` |
| S17-C6 | `config/testnet.toml` (legacy zbx-config format) | `boot_nodes` stripped of `enode://` prefix |
| S17-C7 | `config/mainnet.toml` (legacy zbx-config format) | `boot_nodes` stripped of `enode://pubkeyN@` prefix (full format cleaned to `host:port`) |
| S17-C8 | `scripts/testnet-deploy.sh` | Full rewrite — old script used `zebvix-node start --rpc --home` flags that don't exist in current CLI; new script: correct `zbx-node --network testnet --config --data-dir --rpc-port --p2p-port` flags; correct binary names (`zbx-node`, `zbx-keygen`); installs `node/configs/testnet.toml` + `config/testnet-genesis.json`; discovers `LIBCLANG_PATH` for build; chain_id verification via RPC |

### Blocker audit — S13, S7-EVM3, S11-BRIDGE, C-02

| # | File | Change |
|---|---|---|
| S17-C9 | `crates/zbx-contracts/src/zusd.rs` (**C-02 fix**) | `MAX_SUPPLY` 6-decimal (`100B × 10^6`) → 18-decimal ERC-20 standard (`100B × 10^18`). Added `DECIMALS: u8 = 18`, `ONE_ZUSD` constant, `decimals()`, `approve()`, `allowance()`, `transfer_from()`. 4 unit tests added. |
| S13-STATUS | `crates/zbx-zvm`, `zbx-vm`, `zbx-tx` | Confirmed CLOSED — all use `zbx_types::CHAIN_ID_MAINNET` (8989). TS SDKs already have `CHAIN_ID_MAINNET=8989`. Remaining `7878` = BIP-44 coin type (intentional). |
| S7-EVM3-STATUS | `crates/zbx-evm/src/interpreter.rs` | Confirmed CLOSED — `do_call()` + `do_create()` fully implement all 6 opcodes. EIP-150/2929/161/170/2681/3541/3860 all handled. |
| S11-STATUS | `crates/zbx-bridge/src/relayer.rs` | Confirmed CLOSED — `submit()` checks content-hash ID in `pending` + `completed` maps, rejects duplicates. |

### Tests
- `cargo test -p zbx-types -- consensus`: **21/21 passed** after `ConsensusParams` block_time changes
- `cargo check`: **Finished dev, 0 errors** (full workspace)

### Root causes / patterns found
1. **`enode://` URI scheme in bootnode strings** — `network.rs::dial_peer()` calls `addr.to_socket_addrs()` which requires plain `"host:port"`. Any URI scheme prefix causes `DNS resolve failed` → bootnode never connects. Affected: all 4 config locations + 2 code defaults.
2. **`block_time_ms` set to 2s everywhere except mainnet TOML** — TOML config takes precedence at runtime but code defaults and on-chain `ConsensusParams` were all wrong, causing confusion and potential mismatch if TOML is not loaded.
3. **Deploy script using wrong binary/flags** — Script was targeting an old `zebvix-node start` CLI that was replaced by `zbx-node --network`.
4. **ZUSD C-02: 6 vs 18 decimals** — ERC-20 standard requires 18 decimals. The 6-decimal `MAX_SUPPLY` was off by 10^12 relative to genesis balances stored in 18-decimal units.

---

## Session 16 — 2026-05-03: Testnet Fixes + Full Doc Rewrite Pass

### Code changes

| # | File | Change |
|---|---|---|
| S16-C1 | `config/testnet-genesis.json` | Full rewrite: invalid `0xFAUCET`/`0xTESTNET` addresses → valid 20-byte hex; `validators` changed from Vec of objects to Vec of address strings (matching `GenesisConfig`); balances as quoted decimal strings |
| S16-C2 | `node/src/genesis.rs` | Added `balance_serde` module: deserializes `u128` from JSON string OR u64-range integer |
| S16-C3 | `node/src/bin/zbx-keygen.rs` | New binary: BLS12-381 + secp256k1 keypair generator, outputs EVM address, BLS pub/priv, genesis JSON + TOML snippets |
| S16-C4 | `node/Cargo.toml` | Declared `[[bin]] zbx-keygen`, added `rand` dependency |
| S16-C5 | `replit.md` | Full rewrite — 60-crate reference, P2P protocol, all NodeConfig fields |

### Doc rewrites

| # | File | Change |
|---|---|---|
| S16-D1 | `docs/ARCHITECTURE.md` | Full rewrite — crate map, P2P message table, Block-STM phases, zbx-keygen, genesis startup flow |
| S16-D2 | `docs/NETWORK_PROTOCOL.md` | Full rewrite — TCP/JSON/Noise XX (was wrong: QUIC/Kademlia/mTLS) |
| S16-D3 | `docs/CONFIGURATION.md` | Full rewrite — actual `NodeConfig` struct fields (was wrong section names and missing fields) |
| S16-D4 | `docs/VALIDATOR_GUIDE.md` | Full rewrite — zbx-keygen usage, correct TOML format, genesis JSON balances as strings |
| S16-D5 | `docs/API_REFERENCE.md` | Full rewrite — all eth_*, net_*, zbx_* methods including eth_getLogs, eth_feeHistory, eth_syncing, WebSocket |
| S16-D6 | `docs/RPC_API.md` | Full rewrite — all implemented methods, gas oracle impl details, WS subscriptions, TX relay flow |
| S16-D7 | `docs/STAKING.md` | Rewrite — zbx-keygen for key generation step, constants table from code |
| S16-D8 | `docs/SECURITY_AUDIT.md` | Session 16 testnet fix entries added (T1, T2, T3) |
| S16-D9 | `docs/CONTRIBUTING.md` | Build commands for both binaries, key files table |
| S16-D10 | `docs/DOC_STATUS.md` | This file — Session 16 change log |
| S16-D11 | `docs/PERFORMANCE.md` | Version bump 0.1→0.2.0 |

---

## Previous Sessions

### Session 15 (2026-05-03) — Staking overhaul + doc sync

| # | File | Change |
|---|---|---|
| S15-1 | `crates/zbx-contracts/src/staking_escrow.rs` | MIN_STAKE 32→100 ZBX; MIN_DELEGATION=10 ZBX; delegate() fn |
| S15-2 | `crates/zbx-types/src/validation.rs` | min_validator_stake → 100 ZBX |
| S15-3–5 | config JSON files | min_validator_stake + min_delegation fields |
| S15-6–7 | config TOML files | block_time 2→5 |
| S15-8 | `docs/STAKING.md` | All staking params updated |
| S15-9 | `docs/TOKENOMICS.md` | Staking section updated |
| S15-10 | `docs/VALIDATOR_GUIDE.md` | Min stake 100,000→100 ZBX |
| S15-11 | `docs/GOVERNANCE.md` | Min stake table row |
| S15-12 | `docs/ARCHITECTURE.md` | Block time 2s→5s |
| S15-13 | `docs/API_REFERENCE.md` | Validator stake example + delegated field |
| S15-14 | `docs/SECURITY_AUDIT.md` | Full rewrite with all findings |
| S15-15–19 | Various | Deploy guide, README, CHANGELOG, AUDIT, Explorer UI |

### Session 13 (2026-04-27) — Chain-ID drift audit + fixes

> **🛑 OPEN BLOCKER — S13-CHAIN-ID-DRIFT (CRITICAL)**: chain-id `7878` literals
> remain in `zbx-zvm`, `zbx-vm`, `zbx-tx`, integration tests, and TypeScript SDKs.
> All 🚫 items below must move atomically (Rust crates + SDKs + tests together).
> **Do not start VPS devnet bring-up until this is closed.**

See S13 section in previous version for full 39-item checklist.
Closed items: README, CHANGELOG, CONFIGURATION.md, BRIDGE.md, scripts, config TOML/JSON, contracts, AUDIT entry.
Open items: `zbx-zvm/zbx-vm/zbx-tx` Rust literals, TS SDKs, integration tests, monitoring/k8s.

---

## Open Blockers for Mainnet Launch

| ID | Status | Description |
|---|---|---|
| S13-CHAIN-ID-DRIFT | ✅ **CLOSED S17** | All `zbx-zvm/zbx-vm/zbx-tx` crates use `zbx_types::CHAIN_ID_MAINNET` (8989). TS SDKs (`ethers-zbx`, `zebvix-js`) already have `CHAIN_ID_MAINNET=8989` / `CHAIN_ID_TESTNET=8990`. Remaining `7878` is BIP-44 coin type — intentional. |
| S7-EVM3 | ✅ **CLOSED S17** | CALL/CALLCODE/DELEGATECALL/STATICCALL/CREATE/CREATE2/REVERT all fully implemented in `zbx-evm/src/interpreter.rs` via `do_call()` + `do_create()`. Includes EIP-150 gas forwarding, EIP-2929 warm/cold accounting, EIP-161 nonce init, EIP-170 code cap, EIP-2681 nonce overflow guard, EIP-3541, EIP-3860, precompile short-circuit, snapshot/revert. |
| S11-BRIDGE-SOL-OUT1 | ✅ **CLOSED S17** | `BridgeRelayer::submit()` checks content-hash ID against both `pending` and `completed` maps — duplicate requests rejected with `DuplicateRequest`. ID is `keccak256(from‖to‖amount‖block_number‖timestamp‖target_chain)` — computationally infeasible to collide. |
| C-02 | ✅ **CLOSED S17** | `zbx-contracts/src/zusd.rs` `MAX_SUPPLY` changed from 6-decimal (`100B × 10^6`) to 18-decimal ERC-20 standard (`100B × 10^18`). Added `decimals()→18`, `approve()`, `allowance()`, `transfer_from()`. All 4 unit tests pass. |
| S7-PROD1 | ✅ **CLOSED S18** | Full Ethereum-compatible MPT implemented in `crates/zbx-crypto/src/mpt.rs` (Yellow Paper Appendix D). Key = `rlp_uint64(i)`, value = `rlp_bytes(tx.hash)`, root = `keccak256(RLP(root_node))`. Empty list → `keccak256(0x80)` = `EMPTY_TRIE_HASH`. All 3 call sites updated: `zbx-execution/src/bloom.rs::compute_tx_root()`, `zbx-execution/src/verifier.rs::verify_transactions_root()`, `zbx-block/src/body.rs::compute_tx_root()`. 16/16 MPT unit tests pass. Ethereum SPV inclusion proofs now verifiable against ZBX Chain block headers. |

---

## Sessions 49–52 — ZbxPerpetuals v2→v5 Upgrade (2026-05-05)

### Doc changes

| # | File | Status | Change |
|---|------|--------|--------|
| S49-D1 | `docs/proposals/ZEP-034-PERPETUALS.md` | **CURRENT (S52 full rewrite)** | Complete rewrite for v5: multi-market, 200×, Cross/Isolated, SL/TP, trailing stop, liq price, all API signatures, risk table, security table |
| S49-D2 | `docs/proposals/ZEP-000-INDEX.md` | **CURRENT (S52 update)** | ZEP-034 row updated: v5, multi-market, 200×, Cross/Isolated, SL/TP, Liq-Price |
| S49-D3 | `AUDIT_2026-04-30.md` | **CURRENT (S52 update)** | Sessions 49, 50, 51, 52 audit blocks appended |
| S49-D4 | `docs/SECURITY_AUDIT.md` | **CURRENT (S52 update)** | Sessions 49–52 block added: full perpetuals security table, all versions |
| S49-D5 | `docs/CHANGELOG.md` | **CURRENT (S52 update)** | Sessions 49–52 CHANGELOG entries appended |
| S49-D6 | `replit.md` | **CURRENT (S52 update)** | ZEP-034 updated to v5 with all features listed |
| S49-D7 | `docs/DOC_STATUS.md` | **CURRENT (this file)** | Sessions 49–52 delta added |

### ZbxPerpetuals Version Map

| Rev | Session | Key Feature |
|-----|---------|------------|
| v1 | 46 | Single market, 20× leverage, 1h funding, 5% maint |
| v2 | 49 | SL/TP, Trailing Stop, 8h funding, addCollateral, partialClose |
| v3 | 50 | Cross + Isolated margin, **10% maintenance margin** |
| v4 | 51 | Multi-market — unlimited trading pairs via `addMarket()` |
| v5 | 52 | **200× max leverage**, `liquidationPrice()`, `crossLiquidationThreshold()` |

All builds: **0 errors**.

