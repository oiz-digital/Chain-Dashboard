# Zebvix Chain (ZBX)

**Zebvix Technologies Pvt Ltd** — production L1 blockchain.

## Specs

| | |
|--|--|
| Chain ID | 8989 (mainnet) / 8990 (devnet) |
| Token | ZBX (18 decimals) |
| Address | 20-byte EVM-style (Keccak256(pubkey)[12..]) |
| Crypto | Ed25519 signatures |
| Block time | 5 seconds |
| Total supply cap | 150,000,000 ZBX |
| Foundation pre-mine | 9,990,000 ZBX (6.66% — development & operations) |
| AMM pool genesis seed | 20,000,000 ZBX (13.33% — liquidity) |
| Block-mined supply | 120,010,000 ZBX over time (80.01%) |
| Initial block reward | 3 ZBX |
| Halving interval | 25,000,000 blocks (~3.96 years) |
| Min validator stake | 100 ZBX (self-stake) |
| Min delegator stake | 10 ZBX per delegation |
| Unbonding period | 7 days |
| Consensus (v0.1) | Single-validator PoA |
| Consensus (v0.2) | Multi-validator BFT |
| Smart contracts (v0.2) | EVM-compatible (revm) |
| Storage | RocksDB |
| RPC | JSON-RPC HTTP (Ethereum-style) |

## Build

```bash
# On VPS (Ubuntu/Debian):
apt-get install -y build-essential clang pkg-config libssl-dev librocksdb-dev
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source $HOME/.cargo/env

cd zebvix-chain
cargo build --release
sudo cp target/release/zebvix-node /usr/local/bin/
zebvix-node --version
```

## Quick Start (single validator on VPS)

```bash
# 1. Generate validator key
zebvix-node keygen --out ~/.zebvix/validator.key

# 2. Initialize chain (optional: pre-allocate ZBX to founder)
#    Format: <address>:<amount_in_zbx>
zebvix-node init \\
  --home ~/.zebvix \\
  --validator-key ~/.zebvix/validator.key \\
  --alloc 0xVALIDATOR_ADDR:1000000

# 3. Start the node (block production + JSON-RPC on :8545)
zebvix-node start --home ~/.zebvix --rpc 0.0.0.0:8545
```

## Send a transaction

```bash
# Generate a user key
zebvix-node keygen --out ~/.zebvix/alice.key

# Send 5 ZBX from alice to a recipient
zebvix-node send \\
  --from-key ~/.zebvix/alice.key \\
  --to       0xRECIPIENT_ADDR \\
  --amount   5 \\
  --fee      0.001 \\
  --rpc      http://127.0.0.1:8545
```

## JSON-RPC methods

```bash
# Chain info
curl -s -X POST http://127.0.0.1:8545 -H 'content-type: application/json' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"zbx_chainInfo","params":[]}'

# Latest block height
curl -s -X POST http://127.0.0.1:8545 -H 'content-type: application/json' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}'

# Balance (returns wei in hex)
curl -s -X POST http://127.0.0.1:8545 -H 'content-type: application/json' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getBalance","params":["0xYOUR_ADDR"]}'

# Supply / minting status
curl -s -X POST http://127.0.0.1:8545 -H 'content-type: application/json' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"zbx_supply","params":[]}'

# Get block by height
curl -s -X POST http://127.0.0.1:8545 -H 'content-type: application/json' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"zbx_getBlockByNumber","params":[1]}'
```

## Roadmap

Current state and the path to mainnet are documented in:

- `docs/proposals/PHASE-PLAN-2026-05-01.md` — 33-task / 92-125 dev-day mainnet readiness plan (P0 blockers → P1 wiring → P2 audit → P3 features → P4 ops).
- `docs/proposals/DEVNET-LAUNCH-PLAN-2026-05-01.md` — step-by-step devnet bring-up + public-launch playbook.
- `docs/DOC_STATUS.md` — canonical inventory of every doc and its status.
- `AUDIT_2026-04-30.md` — 12-session rolling security audit (3,100+ lines).

### Honest current state (Session 41, 2026-05-05)

- **Devnet-ready** (chain_id 8990) with 5 documented limitations — see DEVNET-LAUNCH-PLAN.
- **NOT mainnet-ready** until 3 blockers close: S7-PROD1 (tx_root all-zero), S7-EVM3 (CALL family in both VMs), S11-BRIDGE-SOL-OUT1 (BSC nonce-collision).
- **Oracle**: 14 price feeds · 8 CEX/aggregator sources · 8 EVM network relay · 7 advanced modules (TWAP, circuit breaker, DEX fetcher, reporter slasher, heartbeat monitor, Merkle price proof, multi-chain relay) — Session 40.
- **Security**: 12 next-gen ZEPs (ZEP-015–026) implemented and compiling: post-quantum crypto, BLS aggregation, AA v2, MEV protection, ZK-STARK, Parallel EVM (Block-STM v2), state expiry + Verkle, HotStuff-2, enhanced slashing, light client + IBC, confidential transactions, cross-chain messaging — Sessions 33–41.
- `zbx-pq` (post-quantum) and `zbx-confidential` are production crates in the workspace.
- **66+ crates** in the workspace. 13 wired into the production node binary today; remaining 53 are real implementations awaiting integration (see PHASE-PLAN P1A).
- Realistic mainnet date: ~10-14 weeks after green-light, including a 4-8 week external bridge audit lead time.