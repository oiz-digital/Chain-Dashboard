# ZBX Chain — Mainnet Readiness Assessment

**Date**: 2026-05-09
**Author**: Engineering review
**Status**: NOT MAINNET-READY — see "Hard blockers" below
**Target**: honest gap analysis against the current `main` branch (post Pass-7)

> This document deliberately resists the temptation to declare victory.
> A production L1 blockchain holds user funds permanently and forks are
> irreversible.  Every "🟡" / "🔴" item below is a pre-launch blocker
> in the strict sense, even though the codebase has progressed
> significantly through 7 security passes.

---

## ✅ UPDATE 2026-05-09 (Pass-8) — S38-TRIE-REGRESSION FIXED

**S38 closed.**  Root cause was a Branch / Extension RLP-decoder bug
(`val_at::<Vec<u8>>` failing on inline list children) + non-canonical
encoding of empty branch slots (`81 80` instead of `80`).  Both
fixed in `crates/zbx-trie/src/node.rs` and `crates/zbx-rlp/src/decode.rs`.

Test results after fix:
- `cargo test -p zbx-trie --test trie_basic`: **17/17 PASS** (was 11/17)
- `cargo test -p zbx-trie --test trie_proptest`: **11/11 PASS** (was 3/11)
- `cargo test -p zbx-trie --test repro_short_keys`: 2/2 PASS (S38 minimal repros)
- `cargo test -p zbx-rlp --test proptest_rlp`: **8/8 PASS** (new in Pass-8)
- Including `insert_order_independence_of_root` — the Patricia
  consensus property — now green.

The MPT layer is no longer the #0 blocker.  Audit firms can now be
engaged on `main` without losing budget to a known-on-day-1 issue.

The estimates below remain valid: Pass-8 closed the engineering
blocker but did NOT shorten the testnet-bake clock, the audit
calendar, or any external dependency.  See
`docs/SECURITY_FIXES_2026-05-09.md` Pass-8 §S38 for full triage.

---

## TL;DR

| Layer | Code-complete? | Audited? | Battle-tested? | Mainnet-ready? |
|-------|:-:|:-:|:-:|:-:|
| Consensus (HotStuff-2 + BLS) | ✅ | 🟡 internal only | 🔴 | 🔴 |
| EVM + ZVM execution | ✅ | 🟡 internal only | 🔴 | 🔴 |
| State / MPT / RocksDB | ✅ | 🟡 internal only | 🔴 | 🔴 |
| P2P transport (Noise XX) | ✅ | 🟡 internal only | 🔴 | 🔴 |
| RPC layer | ✅ | 🟡 internal only | 🟡 | 🟡 |
| Mempool | ✅ | 🟡 internal only | 🔴 | 🔴 |
| Smart contracts (33+ Solidity) | ✅ | 🟡 internal only | 🔴 | 🔴 |
| Bridge (multi-sig threshold) | ✅ | 🔴 NOT externally audited | 🔴 | 🔴 |
| Slashing economics | 🟡 partial | 🔴 | 🔴 | 🔴 |
| Governance | 🟡 ZEP only | 🔴 | 🔴 | 🔴 |
| Genesis ceremony tooling | ✅ scripts present | 🟡 | 🔴 | 🟡 |
| Validator onboarding docs | 🟡 partial | — | 🔴 | 🔴 |
| Testnet uptime / bake time | 🔴 not started | — | 🔴 | 🔴 |
| Incident-response runbook | 🟡 v0.1 drafted (needs SRE sign-off + dry-run) | — | 🔴 | 🟡 |

**Bottom line**: the *code* has come a long way (7 security passes, 60+ critical/high findings closed, 178 chain-id allowlist hits clean, 24 consensus tests passing, 8 trie property tests).  But "code-complete + internally-audited" is roughly **30-40 %** of the work needed to safely launch a mainnet that custodies user value.

---

## Hard blockers (🔴 must close before mainnet)

### 1. External security audit
- **Status**: NOT STARTED
- **Why blocking**: Every reputable L1 (Ethereum, Solana, Avalanche, Sei, Berachain) had ≥2 independent firms audit the consensus, VM, bridge, and economics before mainnet.  Internal review (passes 1-7) catches most exploit classes but cannot replace adversarial outside eyes.
- **Recommended**: Trail of Bits / OpenZeppelin / Halborn / Quantstamp / Spearbit / Zellic — pick **two** independent firms.  Budget: $200-500k each, 6-12 weeks elapsed, 2 weeks of remediation per firm.
- **Specifically audit**:
  - `zbx-consensus` (HotStuff-2, BLS aggregation, equivocation guards)
  - `zbx-evm` + `zbx-zvm` (gas accounting, CALL family, opcode coverage, precompiles)
  - `zbx-state` + `zbx-trie` + `zbx-storage` (MPT, snapshot/revert, state-bypass paths)
  - `zbx-net` Noise transport + `zbx-network` peer management
  - `zbx-mempool` (DoS, eviction, replacement)
  - `crates/zbx-bridge` + `contracts/ZbxBridge.sol` — bridges historically have the highest exploit dollar-value (Ronin $625M, Wormhole $326M, Nomad $190M).  This MUST get a dedicated bridge-specialist audit.
  - All 33+ Solidity contracts (Slither + manual)
  - `sdk/zebvix-js` + `sdk/ethers-zbx` (key handling, signing)

### 2. Public testnet bake time
- **Status**: not yet running publicly
- **Why blocking**: Liveness bugs only surface under sustained load with adversarial peers, real network jitter, and validator churn.  No amount of unit tests catches a 3-AM HotStuff view-change deadlock.
- **Recommended**: ≥ **90 days continuous testnet uptime** with:
  - ≥ 21 independent validators (geographically distributed, **not** all on one VPS provider)
  - ≥ 1000 daily active addresses (simulated via load-test.sh + grants programme)
  - ≥ 1 successful intentional-fault drill (kill 3 of 21 validators, verify chain liveness)
  - ≥ 1 successful chain upgrade (state-breaking + non-state-breaking)
  - Public block explorer + RPC endpoints + faucet running the whole time
  - Bug-bounty programme open during the bake (Immunefi tier: $50k-$500k for criticals)

### 3. Slashing economics + on-chain enforcement
- **Status**: ZEP-023-SLASHING.md exists; partial implementation.
- **Why blocking**: Without economic finality, BFT alone is insufficient to keep a mainnet safe — a colluding validator set with no skin in the game can long-range attack at zero cost.
- **Required before mainnet**:
  - Bonded-stake floor per validator (e.g. 100k ZBX)
  - Equivocation slash (≥ 5 % of stake) — `zbx-consensus` already detects equivocation in Pass-5; needs to actually burn stake.
  - Downtime slash (graduated) + jail-on-N-missed-blocks.
  - Unbonding period ≥ 21 days (longer than weak-subjectivity window).
  - Inflation / reward schedule simulation against worst-case validator set sizes.

### 4. Bridge security model
- **Status**: code in `crates/zbx-bridge` + `contracts/ZbxBridge.sol`. Pass-1 added ReentrancyGuard, Pass-4 closed nonce collision, Pass-2 enforced threshold ≥ 2.
- **Why still blocking**: even with all those fixes, a 5-of-9 multisig bridge is a single point of failure.  Ronin had 5-of-9 too.
- **Required before mainnet**:
  - **Either** (a) start with a small TVL cap (e.g. $1M per asset, $5M total) and grow only after 3 months of clean operation, **or** (b) ship with light-client / ZK proof verification (zbx-zk crate exists — wire it through), **or** (c) push bridge launch to a Phase-2 milestone after mainnet spot trading proves out.
  - Dedicated bridge-firm audit (Sigma Prime, Trail of Bits bridge team).
  - Independent guardian / pause-multisig with a published incident playbook.

### 5. Key custody for genesis + validator keys
- **Status**: keygen.sh + testnet-genesis-keygen.sh exist; no documented HSM / KMS path.
- **Why blocking**: A leaked genesis key or top-N validator BLS key is an unrecoverable mainnet event.
- **Required**:
  - Genesis keys generated **only** in an air-gapped ceremony, recorded on video, multi-party witnessed, sharded via Shamir.  Never touch a live filesystem.
  - Validator BLS keys live in HSM (YubiHSM / Ledger / Fireblocks) for top-21 validators; signing happens via remote-signer protocol.
  - Documented key-rotation procedure (active before launch, not "we'll figure it out later").

### 6. Operational / SRE readiness
- **Status**: scripts present (mainnet-launch.sh, snapshot.sh, generate-genesis.sh); no on-call runbook.
- **Required**:
  - 24/7 on-call rotation for at least the first 6 months.
  - Pager integration tied to:
    - Block production halt > 30 s
    - Validator BFT participation < 80 %
    - RPC error rate spike
    - Mempool back-pressure spike
    - Bridge anomaly (large outflow / fast-burn rate)
  - Documented incident classification + comms playbook.
  - Snapshot/restore tested end-to-end on real-volume data (today's snapshot.sh has not been load-tested).

---

## Soft blockers (🟡 should close before mainnet, can ship hot-fix)

| Item | Where | Effort |
|------|-------|--------|
| `StateAccess` trait split (full architectural fix for C4) | `zbx-state` | ~1 week |
| ZVM gas accounting overhaul | `zbx-zvm` | 2-3 weeks |
| cargo-fuzz harness for `zbx-evm` interpreter | new `fuzz/` workspace | 1 week + ongoing CI burn |
| Light-client crate (ZEP-024) graduated to production | `zbx-light` | 2 weeks |
| Governance contract (ZEP-?? — currently only an ZEP entry) | new contract | 3-4 weeks |
| Foundry / Hardhat tutorials for dApp devs | `docs/` | 1 week |
| Public block explorer (zbx-explorer crate exists, not deployed) | DevOps | 1-2 weeks |
| Faucet, deposit/withdraw UI | `apps/` | 2 weeks |
| ~~WebSocket RPC (mainnet.toml has it disabled — "v0.3 milestone")~~ ✅ done Pass-9 — `WsServer` was already implemented, just unwired; `node::ZbxNode::start` now spawns it on `ws_enabled = true`. Default still `false` for mainnet (operator opt-in). | `zbx-rpc` + `node` | done |
| Snapshot / fast-sync verified end-to-end | DevOps + QA | 2 weeks |

---

## What IS done (✅ credit where it's due)

These are actual mainnet prerequisites already satisfied:

- **Chain-ID lockdown** — mainnet 8989, testnet+devnet 8990, BIP-44 7878.  CI guard (`scripts/check-chain-id.sh`) prevents drift.  178 allowlisted hits, no inline literals.
- **EVM compatibility** — full CALL/CALLCODE/DELEGATECALL/STATICCALL/CREATE/CREATE2/SELFDESTRUCT (Sprints S32, C53-02).  9-test call-family suite.
- **HotStuff-2 BFT** — 24 consensus tests passing.  TimeoutCertificate cryptographically verified (Pass-5 C6).  Real BLS aggregation (no byte-truncation stub) (Pass-5 C7).  Equivocation guard with double-vote rejection (Pass-5 H3).
- **Noise XX transport encryption** — every byte after handshake encrypted (Pass-4 P1+P2).  PeerId = keccak256(remote X25519 pubkey), persisted at `<data_dir>/p2p_static.key` mode 0600.
- **Mempool DoS hardening** — `max_slots_per_sender = 64`, cumulative balance reservation, replacement-leak fix (Pass-4 R1+R2).
- **RPC DoS hardening** — `RPC_GAS_CAP = 50M` per call, `RPC_BATCH_GAS_BUDGET = 100M` per batch, `RPC_MAX_CALLDATA = 128 KiB` (Pass-5 C8 + Pass-6 H-batch).
- **State-bypass guards** — `StateDB::set_account` AND `StateView::set_account` both enforce nonce monotonicity + EIP-684 code immutability (Pass-6 C4 + architect follow-up).
- **MPT** — fully spec-compliant (Yellow Paper Appendix-D), insert/get/delete/prove with branch-collapse semantics, EIP-1186 proofs.  Now backed by 7-property randomised proptest harness (Pass-7 C9).
- **Solidity contracts** — ReentrancyGuard everywhere, SafeERC20 for USDT-compatibility, Pausable circuit breaker on bridge, threshold floor (Passes 1-3).  Trading layer (perps/spot/options/dated) hardened against oracle-staleness, cross-margin exploits, OTM collateral stranding (Pass-3).
- **CI security pipeline** — cargo-audit, cargo-deny, Slither, Foundry, gitleaks (Pass-1).
- **SDK hardening** — runtime `eth_chainId` resolution, `destroy()` zeroes private keys, EIP-4337 keccak userOpHash, exact-decimal `parseWei` (Pass-4 Tier-F).
- **Network configs locked** — mainnet.toml uses chain_id 8989, RPC bound to 127.0.0.1 behind nginx TLS, CORS whitelist for zbx.io domains.
- **Mainnet launch checklist script** (`scripts/mainnet-launch.sh`) — 7-section gating: binary, config, crypto material, network, contracts, security, monitoring.

---

## Recommended path-to-mainnet timeline

This is what a credible L1 launch looks like, conservatively:

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| **0 — Today** | done | Code-complete + 7 internal security passes |
| **1 — External audit kickoff** | 0-2 weeks | Engage 2 audit firms, scope locked |
| **2 — Public testnet "Genesis-1"** | weeks 0-4 | 21 validator testnet up, public RPC + explorer + faucet |
| **3 — Audit pass 1 + remediation** | weeks 4-12 | First firm delivers report, all critical/high closed |
| **4 — Audit pass 2 + remediation** | weeks 8-16 | Second firm delivers report, all critical/high closed |
| **5 — Bug-bounty live + load drills** | weeks 12-24 | Immunefi programme open, intentional-fault drills passed |
| **6 — Mainnet-candidate testnet** | weeks 16-24 | Same binary as mainnet will run, frozen for 60 days |
| **7 — Genesis ceremony** | week 24 | Air-gapped key generation, multi-party witnessed |
| **8 — Mainnet launch** | week 25 | Soft launch with TVL caps, gradual deposit limits |
| **9 — Cap removal + bridge open** | weeks 27-36 | Caps lifted as audits / bake-time accumulate |

**Realistic earliest mainnet date** (assuming work starts immediately):
**~6 months** from today, optimistically.  More realistically **9-12 months**.
Anything faster than that means cutting one of: external audit, testnet
bake, key-custody discipline, or initial-TVL caps — and every single
mainnet that has cut one of those has eventually paid for it (Terra,
Ronin, Wormhole, Nomad, Beanstalk).

---

## Decisions the team must make this week

1. **Audit budget approval** — without this, Phases 3-4 are blocked.
2. **Validator set composition** — who runs the genesis 21?  External
   stakers, or internal team only at first?
3. **TVL cap policy** — soft launch with caps, or fully open from day one?
4. **Bridge launch timing** — with mainnet, or Phase-2?
5. **Token launch mechanics** — fair-launch, pre-sale, airdrop?
   This intersects with chain-launch but is a separate workstream.
6. **Legal entity for mainnet operations** — who holds the
   guardian/pause keys?  Who is contractually liable?

---

## What the engineering team can do *right now* (this sprint)

Without waiting on audits:

1. ✅ Continue Pass-8 deferred items: `StateAccess` trait split, ZVM gas overhaul, cargo-fuzz on `zbx-evm`.
2. Stand up a public testnet (21 validators, public RPC, explorer, faucet) — start the 90-day bake clock.
3. Write incident-response runbook (template exists in many open-source projects — Tendermint, Cosmos, Solana have public ones).
4. Wire HSM signing for validator BLS keys (today only soft keyfiles).
5. Document the genesis ceremony (script + dry-run on a throwaway chain).
6. End-to-end test snapshot/restore with realistic volume.
7. Submit `cargo audit` + `cargo deny` to CI on every PR (already in pipeline — verify it's actually gating).

---

## Bottom line for leadership

> The code is in much better shape than it was 30 days ago — Passes 1-7
> have closed every CRITICAL and HIGH finding from the internal audit.
> But "no known criticals" ≠ "no criticals exist".  Mainnet-grade
> assurance only comes from external audit + sustained adversarial
> testnet operation.  Skipping either of those is a $-event waiting to
> happen.
>
> **Recommendation**: target a 6-month minimum runway to mainnet.
> Begin audit engagement and public testnet **this month**.  Ship a
> soft mainnet (TVL-capped, no bridge) before opening fully.
