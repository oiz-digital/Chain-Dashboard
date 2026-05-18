# ZBX Chain — Testnet vs Mainnet Feature Audit

**Date**: 2026-05-16  
**Source**: Full source-code scan (`crates/`, `contracts/`, `node/configs/`, `docs/`)  
**Status**: Accurate against `main` branch (post Pass-11)

---

## Network Identity

| Parameter | Testnet | Mainnet |
|-----------|---------|---------|
| Chain ID | **8990** (shared with devnet) | **8989** |
| RPC URL | `https://rpc-testnet.zbx.io` | `https://rpc.zbx.io` |
| RPC Port (local) | `18545` | `8545` |
| WS Port (local) | `18546` | `8546` |
| P2P Port | `30304` | `30303` |
| BIP-44 Coin Type | `7878` (same) | `7878` (same) |
| Data Dir | `/var/lib/zbx-testnet` | `/var/lib/zbx-mainnet` |
| VPS | `93.127.213.192` | `93.127.213.192` |
| Genesis File | `/etc/zbx/genesis.testnet.json` | `/etc/zbx/genesis.mainnet.json` |
| Validators | 1 | 5 |

---

## Node / Infrastructure Config Differences

| Parameter | Testnet | Mainnet |
|-----------|---------|---------|
| Max peers | 50 | **100** |
| RocksDB cache | 1024 MB | **2048 MB** |
| Mempool max pending | 5,000 | **10,000** |
| Mempool max queued | 2,000 | **5,000** |
| Block time | 5000 ms (same) | 5000 ms (same) |
| Max block gas | 30,000,000 (same) | 30,000,000 (same) |
| WS RPC | Disabled (`false`) | Disabled (`false`) — operator opt-in only |
| CORS origins | `["*"]` (open) | `["https://zbx.io", "https://app.zbx.io", "https://wallet.zbx.io"]` |
| Rate limit | **1200 RPM** | **600 RPM** |
| Bind addr | `127.0.0.1` (TLS via nginx) | `127.0.0.1` (TLS via nginx) |
| KZG trusted setup | Devnet deterministic (NOT production-safe — secret recoverable from source tree) | **Official Ethereum KZG Ceremony output** |
| Metrics port | `9001` | `9000` |
| Max open files | 4096 (same) | 4096 (same) |
| Trie pruner | Enabled (same) | Enabled (same) |
| Max retained trie roots | 128 (same) | 128 (same) |
| Require vault genesis | `true` (same) | `true` (same) |
| ZUSD vault address | `0x0000...5455` (same) | `0x0000...5455` (same) |

---

## Features Present on TESTNET Only

> Items marked **TESTNET-ONLY** exist in code with `Chain ID 8990 (testnet only)` annotation.

| # | Feature | Contract / Crate | Notes |
|---|---------|-----------------|-------|
| 1 | **ZbxFaucet** | `contracts/ZbxFaucet.sol` | 100 ZBX / address / 24h. Funded by testnet foundation allocation. `@custom:zbx-chain Chain ID 8990 (testnet only)`. Not deployed on mainnet. |
| 2 | **Devnet KZG trusted setup** | `node/configs/trusted_setup_devnet.txt` | Deterministic secret — anyone who reads the source can recover it. Testnet uses this; mainnet uses the official Ethereum ceremony output. |
| 3 | Open CORS (`"*"`) | `node/configs/testnet.toml` | Testnet allows all origins. Mainnet restricts to `zbx.io` family only. |
| 4 | Higher rate limit (1200 RPM) | `node/configs/testnet.toml` | Devnet is unlimited (0). Testnet is 1200. Mainnet is 600. |
| 5 | Devnet WS enabled | `node/configs/devnet.toml` | `ws_enabled = true` for local tooling on devnet. Both testnet and mainnet ship with WS disabled (operator opt-in). |

**Total testnet-only items: 5** (1 contract, 4 config differences)

---

## Features Present on BOTH Testnet and Mainnet

### Consensus Layer (4 features)

| # | Feature | Crate | Maturity | Notes |
|---|---------|-------|----------|-------|
| 1 | HotStuff-2 BFT consensus | `zbx-consensus` | **BETA** | 3-phase HotStuff, VRF-weighted proposer, pacemaker, QC finality. 24 tests passing. |
| 2 | BLS signature aggregation | `zbx-consensus`, `zbx-crypto` | **BETA** | Real BLS aggregation (no byte-truncation stub — fixed Pass-5). Validator pubkey registry. |
| 3 | Remote equivocation detection | `zbx-consensus` | **BETA** | Double-vote detector with BLS pre-verify, voter↔pubkey binding guard, drop counters. Wired in Pass-10. |
| 4 | Slashing registry | `zbx-staking` | **BETA** | `SlashingRegistryV2` — submit/finalize/appeal/overturn. RocksDB-persistent (Pass-11). Not yet end-to-end burn. |

### Execution Layer (5 features)

| # | Feature | Crate | Maturity | Notes |
|---|---------|-------|----------|-------|
| 5 | EVM execution | `zbx-evm` | **BETA** | Full opcode dispatch including complete CALL family (CALL, CALLCODE, DELEGATECALL, STATICCALL, CREATE, CREATE2, SELFDESTRUCT, REVERT — added S32/C53-02). |
| 6 | ZVM (Zebvix VM) | `zbx-zvm` | **THIN** | ZEP-004. Parallel to EVM. Gas accounting overhaul pending (soft blocker). |
| 7 | EIP-4844 KZG precompile (0x0B) | `zbx-crypto` | **BETA** | Point-evaluation precompile. Testnet uses devnet trusted setup; mainnet uses official ceremony file. |
| 8 | ZUSD vault precompile (0x0F) | `zbx-crypto` | **BETA** | Direct-read of `ZbxVaultRegistry` state. Hard-fails boot if registry not in genesis. |
| 9 | Standard precompiles (0x01–0x09) | `zbx-evm` | **BETA** | ecRecover, SHA-256, RIPEMD-160, identity, modexp, alt_bn128, BLAKE2. |

### State Layer (4 features)

| # | Feature | Crate | Maturity | Notes |
|---|---------|-------|----------|-------|
| 10 | Merkle Patricia Trie (MPT) | `zbx-trie` | **PROD** | Yellow Paper Appendix-D spec-compliant. 17/17 basic tests + 11/11 proptest passing (Pass-8 fixed Branch/Extension RLP decoder). EIP-1186 proofs. |
| 11 | RocksDB state storage | `zbx-storage` | **BETA** | Column families, write-batch, iterator, snapshot semantics. |
| 12 | State pruner | `zbx-pruner` | **BETA** | `RocksDbPruner` mark-and-sweep over `Column::TrieNodes`. Full/Distance/Selective modes. Full mode mainnet-safe; Distance mode testnet-only until e2e tests pass. |
| 13 | Snapshot & fast-sync | `zbx-snapshot`, `zbx-sync` | **BETA** | End-to-end wired Pass-11. `SyncCoordinator` drives pivot selection → headers-first download → manifest → per-chunk Merkle verify. Real network adapter pending (Pass-12). |

### P2P Network (3 features)

| # | Feature | Crate | Maturity | Notes |
|---|---------|-------|----------|-------|
| 14 | Noise XX transport encryption | `zbx-network` | **PROD** | Every byte encrypted post-handshake (Pass-4). PeerId = keccak256(X25519 pubkey), persisted at `<data_dir>/p2p_static.key` mode 0600. |
| 15 | Persistent peer + ban store | `zbx-network` | **PROD** | `PeerStore` — TTL, atomic write, 0600 mode, FIFO banlist cap. Survives restart (Pass-10). |
| 16 | SSRF filter + dial cap | `zbx-network` | **PROD** | Blocks SSRF loops, limits outbound dials (Pass-4). |

### RPC Layer (3 features)

| # | Feature | Crate | Maturity | Notes |
|---|---------|-------|----------|-------|
| 17 | HTTP JSON-RPC (eth_* compatible) | `zbx-rpc` | **BETA** | Full `eth_*` namespace. Gas cap 50M/call, batch budget 100M, max calldata 128 KiB (Pass-5/6). |
| 18 | WebSocket RPC | `zbx-rpc` (`ws_server.rs`) | **BETA** | `WsServer` implemented, wired in Pass-9. Default off on both testnet/mainnet (operator opt-in). Origin-header check and per-connection sub cap pending (`WS_HARDENING_CHECKLIST`). |
| 19 | Metrics / Prometheus | `zbx-metrics` | **BETA** | Block height, peer count, mempool depth, equivocations_total, dropped vote counters. |

### Mempool (2 features)

| # | Feature | Crate | Maturity | Notes |
|---|---------|-------|----------|-------|
| 20 | EIP-1559 mempool admission | `zbx-mempool` | **BETA** | Base-fee + priority-tip checks, balance reservation. DoS hardened: `max_slots_per_sender=64`, replacement-leak fix (Pass-4). |
| 21 | Gas fee market (EIP-1559) | `zbx-fee` | **THIN** | Real EIP-1559 `GasPriceOracle`. **NOT YET WIRED** into node binary — P1A-T01 in phase plan (~3 dev-days to wire). |

### ZRC Token Standards (3 features)

| # | Feature | Contracts | Maturity | Notes |
|---|---------|-----------|----------|-------|
| 22 | ZRC-20 fungible token | `ZRC20.sol`, `ZRC20Base.sol`, `ZRC20Token.sol`, `ZRC20Factory.sol`, `ZRC20Standard.md` | **BETA** | Full ERC-20 + Zebvix extensions (permit, flash-mint, sanction list). Chain ID 8989/8990. |
| 23 | ZRC-721 NFT | `ZRC721Base.sol` | **BETA** | ERC-721 compatible NFT standard. |
| 24 | ZRC-20 extensions | `ZRC20Staking.sol`, `ZRC20Vesting.sol`, `ZRC20Airdrop.sol`, `ZRC20TokenLocker.sol`, `ZRC20FlashMint.sol` | **BETA** | Staking, vesting schedules, airdrop distributor, token locker, flash-mint. |

### DeFi Contracts (9 features)

| # | Feature | Contracts | Notes |
|---|---------|-----------|-------|
| 25 | ZUSD stablecoin (ZEP-002) | `ZUSD.sol`, `ZusdVault.sol`, `ZusdStabilityPool.sol`, `ZusdPricePeg.sol` | CDP-style stablecoin + stability pool. Testnet-deploy required before mainnet. Pending external audit. |
| 26 | AMM / DEX (ZEP-014) | `ZbxAMM.sol`, `ZbxAMMFactory.sol`, `ZbxRouter.sol` | Uniswap-style AMM with pool security hardening (Pass-3). |
| 27 | Flash loans | `ZbxFlashLoan.sol`, `ZRC20FlashMint.sol` | EIP-3156 flash loans on AMM and ZRC-20. |
| 28 | Lending pool | `ZbxLendingPool.sol` | Collateralised lending. BETA — not externally audited. |
| 29 | Staking + rewards | `ZbxStaking.sol`, `ZbxRewardDistributor.sol`, `RewardPool.sol` | Validator + LP staking. Block reward distribution. |
| 30 | Liquid staking (ZEP-033) | `ZbxLiquidStaking.sol` | ZBX liquid staking receipt token. |
| 31 | Yield optimizer (ZEP-035) | `ZbxYieldOptimizer.sol` | Auto-compound yield strategies. |
| 32 | Spot order book (ZEP-042) | `ZbxSpotOrderBook.sol` | On-chain CLOB. |
| 33 | Derivatives (ZEP-034/043/044) | `ZbxPerpetuals.sol`, `ZbxDatedFutures.sol`, `ZbxOptions.sol` | Perpetuals, dated futures, options. Requires oracle. |

### Bridge (2 features)

| # | Feature | Contracts / Crate | Notes |
|---|---------|-------------------|-------|
| 34 | BSC cross-chain bridge | `ZbxBridge.sol`, `BridgeMultisig.sol`, `BridgeVault.sol` | Lock/mint BNB↔ZBX. 5-of-9 multisig threshold. Pausable. **P0-T02 CRITICAL bugs**: nonce-collision (OUT1), source-chain binding (OUT2), tally-griefing (MS1) still open. External audit required before mainnet. |
| 35 | Bridge (Rust crate) | `crates/zbx-bridge` | Orphaned — has 6 conditional CRITICAL/HIGH bugs (S11). Not wired into node binary. Team must delete OR fix + wire (P0-T05). |

### Account Abstraction — ERC-4337 (3 features)

| # | Feature | Contracts / Crate | Notes |
|---|---------|-------------------|-------|
| 36 | Smart wallet (ZEP-017) | `ZbxSmartWallet.sol`, `ZbxEntryPoint.sol`, `ZbxPaymaster.sol` | EIP-4337 smart contract wallets with paymaster. |
| 37 | ERC-4337 bundler | `ZbxBundler.sol`, `crates/zbx-bundler` | Full bundler with canonical entry-point address. Rust crate real but **not wired** into node (P1B task). |
| 38 | ZbxMultisig | `ZbxMultisig.sol` | N-of-M multisig wallet. |

### Oracles (4 features)

| # | Feature | Contracts | Notes |
|---|---------|-----------|-------|
| 39 | Price oracle | `ZbxOracle.sol`, `ZbxAggregatorV3.sol`, `ZbxOracleConsumer.sol` | Chainlink-style decentralised oracle. |
| 40 | TVL oracle (ZEP-007) | `ZbxTvlOracle.sol`, `interfaces/IZbxTvlOracle.sol` | Protocol TVL aggregator. Pending external audit. |
| 41 | TWAP oracle (ZEP-008) | `ZbxTwapOracle.sol` | Time-weighted average price. |
| 42 | ZK verifiers | `ZbxVerifier.sol`, `ZbxGroth16Verifier.sol`, `ZbxStarkVerifier.sol` | Groth16 + Stark proof verifiers. Precompile stub path in production. |

### Identity & Utility (4 features)

| # | Feature | Contracts | Notes |
|---|---------|-----------|-------|
| 43 | ZbxPayId (ZEP-001) | `ZbxPayId.sol` | Human-readable payment IDs (e.g. `alice@zbx`). |
| 44 | ZbxNameService / ZNS (ZEP-037) | `ZbxNameService.sol` | On-chain DNS-style name resolution. |
| 45 | Multicall3 | `Multicall3.sol` | Batch multiple read calls. |
| 46 | Token registry | `TokenRegistry.sol` | On-chain registry of ZRC-20/721 tokens. |

### Governance (3 features)

| # | Feature | Contracts | Notes |
|---|---------|-----------|-------|
| 47 | On-chain governance | `ZbxGovernor.sol`, `ZbxTimelock.sol`, `ZbxTimelockController.sol` | Governor + timelock. ZEP proposals tracked. |
| 48 | Contract factory (ZEP-038) | `ZbxContractFactory.sol` | Permissioned factory for deploying Zebvix-standard contracts. |
| 49 | Ownable2Step | `Ownable2Step.sol` | Two-step ownership transfer pattern. |

### Randomness & VRF (2 features)

| # | Feature | Contracts | Notes |
|---|---------|-----------|-------|
| 50 | VRF (Verifiable Random Function) | `ZbxVRF.sol` | On-chain VRF for fair randomness. |
| 51 | Random beacon | `randomness/ZbxRandomBeacon.sol` | Aggregate VRF beacon for protocol randomness. |

### Gaming & Social (6 features)

| # | Feature | Contracts | ZEP | Notes |
|---|---------|-----------|-----|-------|
| 52 | Game items | `ZbxGameItems.sol` | ZEP-031 | ZRC-1155 in-game item registry. |
| 53 | Card game | `ZbxCardGame.sol` | ZEP-041 | On-chain turn-based card game. |
| 54 | Game escrow | `ZbxGameEscrow.sol` | ZEP-031 | Prize pool escrow for games. |
| 55 | Prediction market (ZEP-040) | `ZbxPredictionMarket.sol` | ZEP-040 | Binary outcome prediction markets. |
| 56 | Raffle (ZEP-039) | `ZbxRaffle.sol` | ZEP-039 | VRF-powered on-chain raffles. |
| 57 | Meme factory (ZEP-045) | `ZbxMemeFactory.sol`, `ZbxMemeToken.sol` | ZEP-045 | One-click meme token deployment. |

### Payments & Commerce (2 features)

| # | Feature | Contracts | Notes |
|---|---------|-----------|-------|
| 58 | Payment gateway (ZEP-032) | `ZbxPaymentGateway.sol` | Merchant payment processing. |
| 59 | Launchpad (ZEP-036) | `ZbxLaunchpad.sol` | Token launch + IDO platform. |

### Advanced Protocol Features (6 features — UNWIRED in node, code exists)

| # | Feature | Crate / Contract | ZEP | Status |
|---|---------|-----------------|-----|--------|
| 60 | Data availability layer | `crates/zbx-da` | ZEP-003 | Real implementation, NOT wired into node (P1B task). |
| 61 | MEV protection | `crates/zbx-mev` | ZEP-018 | Private mempool + bundles. NOT wired. |
| 62 | Confidential transactions | `crates/zbx-confidential` | ZEP-025 | NOT wired. |
| 63 | ZK rollup | `crates/zbx-zk`, `crates/zbx-prover` | ZEP-019 | NOT wired. |
| 64 | Light client | `crates/zbx-light` | ZEP-024 | THIN — NOT wired. Soft blocker. |
| 65 | AI precompile | `crates/zbx-ai-precompile`, `zbx-ai-registry`, `zbx-ai-sdk` | — | Stub mode flag exists; NOT wired. |

### Tooling & SDK (4 features)

| # | Feature | Location | Notes |
|---|---------|----------|-------|
| 66 | zbxctl CLI | `crates/zbx-cli` | Full CLI including `dev faucet`, key management, chain queries. |
| 67 | JavaScript SDK | `sdk/zebvix-js` | `eth_chainId` runtime resolution, `destroy()` zeroes private keys, EIP-4337 keccak userOpHash, `parseWei` (Pass-4). |
| 68 | Ethers.js adapter | `sdk/ethers-zbx` | Plug-in provider for ethers.js. |
| 69 | HD wallet + BIP-39 | `crates/zbx-sdk/src/hd_wallet.rs` | Feature-gated `#[cfg(feature = "hd")]`. BIP-44 coin type 7878. |

---

## Feature Count Summary

| Category | Testnet Only | Both (Testnet + Mainnet) | Mainnet Only |
|----------|:-----------:|:------------------------:|:------------:|
| Contract diff | 1 (ZbxFaucet) | 66 Solidity contracts | 0 |
| Config diff | 4 (KZG setup, CORS, rate limit, WS) | Core node config | 0 |
| Consensus | 0 | 4 | 0 |
| Execution / EVM | 0 | 5 | 0 |
| State / MPT | 0 | 4 | 0 |
| P2P Network | 0 | 3 | 0 |
| RPC | 0 | 3 | 0 |
| Mempool | 0 | 2 | 0 |
| Token Standards (ZRC) | 0 | 3 | 0 |
| DeFi | 0 | 9 | 0 |
| Bridge | 0 | 2 | 0 |
| Account Abstraction | 0 | 3 | 0 |
| Oracles | 0 | 4 | 0 |
| Identity / Utility | 0 | 4 | 0 |
| Governance | 0 | 3 | 0 |
| Randomness | 0 | 2 | 0 |
| Gaming / Social | 0 | 6 | 0 |
| Commerce / Payments | 0 | 2 | 0 |
| Advanced (unwired) | 0 | 6 | 0 |
| Tooling / SDK | 0 | 4 | 0 |
| **TOTAL** | **5** | **69** | **0** |

> **Testnet has 74 features total (69 shared + 5 testnet-only).**  
> **Mainnet has 69 features total (69 shared, 0 mainnet-only, 0 testnet-only enabled).**

---

## Rust Crate Status (73 crates total)

### Wired into node binary (17 crates — 23%)

| Crate | Purpose |
|-------|---------|
| `zbx-types` | Primitive types, chain IDs |
| `zbx-crypto` | KZG, BLS, hashing, vault precompile |
| `zbx-consensus` | HotStuff-2 BFT |
| `zbx-mempool` | Tx admission |
| `zbx-network` | Noise XX P2P |
| `zbx-storage` | RocksDB columns |
| `zbx-trie` | MPT |
| `zbx-pruner` | State pruner |
| `zbx-execution` | Block execution pipeline |
| `zbx-evm` | EVM interpreter |
| `zbx-state` | State DB |
| `zbx-rpc` | JSON-RPC + WS |
| `zbx-staking` | Slashing registry |
| `zbx-keystore` | Key loading |
| `zbx-bridge` | Bridge (orphaned — P0-T05 decision needed) |
| `zbx-metrics` | Prometheus |
| `zbx-genesis` | Genesis loader |

### Real implementations, NOT yet wired (56 crates — 77%)

Key unwired crates with wiring priority:

| Priority | Crate | Feature | Phase Plan Task |
|----------|-------|---------|----------------|
| P1A | `zbx-fee` | EIP-1559 gas market | P1A-T01 |
| P1A | `zbx-rewards` | Block rewards + halving | P1A-T02 |
| P1A | `zbx-sync` | Fast-sync coordinator | P1A-T03 |
| P1A | `zbx-indexer` | Block/tx indexer | P1A-T04 |
| P1B | `zbx-bundler` | ERC-4337 bundler | P1B task |
| P1B | `zbx-oracle` | Chainlink-style oracle | P1B task |
| P1B | `zbx-da` | Data availability | P1B task |
| P1B | `zbx-light` | Light client | P1B task |
| P2 | `zbx-mev` | MEV protection | P2 task |
| P2 | `zbx-zk` + `zbx-prover` | ZK rollup | P2 task |
| P2 | `zbx-confidential` | Confidential txs | P2 task |
| P2 | `zbx-zvm` | Zebvix VM | P2 task |
| P3+ | `zbx-wasm` | WASM execution | P3 task |
| P3+ | `zbx-pq` | Post-quantum crypto | ZEP-015 |
| P3+ | `zbx-xcl` | Cross-chain light | ZEP-026 |
| P3+ | `zbx-threshold` | Threshold signatures | — |
| P3+ | `zbx-ai-*` | AI precompile/registry/SDK | — |
| P3+ | `zbx-sequencer` | Sequencer module | — |

---

## What Mainnet Needs Before Launch (Hard Blockers)

These items are **not in testnet either** — they are gaps that must be closed before the project can safely operate on either a serious public testnet or mainnet:

| # | Blocker | Status | Phase Plan |
|---|---------|--------|------------|
| 1 | External security audit (2 firms) | NOT STARTED | — |
| 2 | Public testnet — 90-day bake with 21 validators | NOT STARTED | Phase 2 |
| 3 | Bridge P0 bugs (OUT1 nonce-collision, OUT2 source-binding, MS1 tally-griefing) | OPEN | P0-T02 |
| 4 | Slashing end-to-end (stake burn, RPC surface) | PARTIAL (Pass-11) | P0 / P1 |
| 5 | Key custody (HSM for genesis + top-21 validator BLS keys) | NOT DONE | Pre-launch |
| 6 | SRE readiness (24/7 on-call, incident runbook, pager) | PARTIAL | Pre-launch |
| 7 | Fast-sync real network adapter (Pass-11 ships mock) | PENDING | P1A-T03 |
| 8 | WS hardening (CORS on upgrade, per-connection sub cap) | PENDING | P1 |
| 9 | zbx-fee EIP-1559 wiring | PENDING | P1A-T01 |
| 10 | zbx-rewards block-rewards wiring | PENDING | P1A-T02 |

---

## Devnet vs Testnet vs Mainnet Quick Reference

| | Devnet | Testnet | Mainnet |
|---|--------|---------|---------|
| Chain ID | 8990 | 8990 | 8989 |
| Network flag | `--network testnet` | `--network testnet` | `--network mainnet` |
| RPC port | 8545 | 18545 | 8545 |
| WS | Enabled | Disabled | Disabled (opt-in) |
| CORS | `"*"` | `"*"` | zbx.io only |
| Rate limit | Unlimited | 1200 RPM | 600 RPM |
| Max peers | 25 | 50 | 100 |
| Cache | 256 MB | 1024 MB | 2048 MB |
| KZG setup | Devnet (deterministic) | Devnet (deterministic) | Official ETH ceremony |
| ZbxFaucet | ✅ | ✅ | ❌ |
| Block time | 2000 ms | 5000 ms | 5000 ms |
| Validators | 1 (local) | 1 | 5 |
| Bootnodes | None | 93.127.213.192:30304 | 93.127.213.192:30303 |

---

## ZEP (Zebvix Enhancement Proposals) Status

38 ZEPs authored covering all protocol layers:

| Range | Domain |
|-------|--------|
| ZEP-000 — ZEP-008 | Core protocol (PayId, ZUSD, DA, ZVM, ZUSD redemption, ZRC-20 advanced, TVL oracle, TWAP oracle) |
| ZEP-013 — ZEP-015 | Stable assets (ZINR), AMM security, Post-quantum |
| ZEP-016 — ZEP-024 | BLS aggregation, Account abstraction, MEV protection, ZK rollup, Parallel EVM, State expiry, HotStuff-2, Slashing, Light client |
| ZEP-025 — ZEP-026 | Confidential txs, Cross-chain |
| ZEP-031 — ZEP-045 | Gaming, Payments, Liquid staking, Perpetuals, Yield, Launchpad, ZNS, Factory, Raffle, Prediction market, Card game, Spot orderbook, Dated futures, Options, Meme factory |

---

*Generated from full source scan of `zbx-chain-source/zbx-chain` on 2026-05-16. For mainnet readiness timeline see `docs/MAINNET-READINESS-2026-05-09.md`. For phase plan see `docs/proposals/PHASE-PLAN-2026-05-01.md`.*
