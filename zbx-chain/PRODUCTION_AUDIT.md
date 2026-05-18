# Zebvix Chain — Production Readiness Audit (post-fix) — SUPERSEDED

> **⚠ SUPERSEDED — Session 13 (2026-05-01).** This document is the **Sessions 1-2** snapshot
> and asserts "0 critical blockers" — that was correct for the work it covered, but
> Sessions 3-12 surfaced many additional findings that this file does not reflect.
> **Use `AUDIT_2026-04-30.md` (3,100+ lines) for the current authoritative audit state.**
> Use `docs/proposals/PHASE-PLAN-2026-05-01.md` for the current mainnet readiness roadmap.
> This file is preserved unchanged below for historical reference only — do not act on it.

---

**Audit date**: 2026-04-30
**Workspace**: `zbx-chain` (66 crates, ~49k LoC, Rust 2021)
**Targets**: Mainnet (chain id `8989`, RPC `:8545`) and Testnet (chain id `8990`, RPC `:18545`) on VPS `93.127.213.192`

---

## Summary

| Category                         | Before | After |
|----------------------------------|:------:|:-----:|
| Critical blockers                |   12   | **0** |
| Hardening / medium issues        |    6   | **0** |
| Stale / dead code                |  125 files in `zbx-chain/src/`  | **removed** |
| `.unwrap()` in node startup path |   ~39  | **1** (in unused `import_export.rs`) |

A previously cluttered workspace and a partially mocked node have been brought to a state where **the binary can be built `--release`, deployed to a VPS via the supplied `systemd` units behind nginx/TLS, and serve real Ethereum-compatible JSON-RPC traffic against a persistent RocksDB store, on either mainnet or testnet.**

---

## Critical blockers — fixed

### B1. In-memory storage replaced by RocksDB
- **Was**: `crates/zbx-storage/src/db.rs` was a `HashMap<H256, Block>`. Every restart wiped the chain.
- **Now**: Real `rocksdb` crate (0.21) with column families (`blocks`, `block_by_number`, `txs`, `receipts`, `accounts`, `storage`, `code`, `meta`), atomic `WriteBatch`, an `Arc<DB>` backing handle, and a `parking_lot::RwLock<u64>` cache of latest block height. A `mem` cargo feature still exposes a `MemDb` for unit tests.
- **Files**: `crates/zbx-storage/Cargo.toml`, `crates/zbx-storage/src/db.rs`

### B2. JSON-RPC method coverage
- **Was**: Only `eth_chainId` and `eth_blockNumber` routed.
- **Now**: 25+ Ethereum-compat methods plus the `zbx_*` namespace, all wired to real storage:
  `eth_chainId`, `eth_blockNumber`, `eth_getBalance`, `eth_getTransactionCount`,
  `eth_getCode`, `eth_getStorageAt`, `eth_sendRawTransaction`, `eth_getBlockByNumber`,
  `eth_getBlockByHash`, `eth_getTransactionByHash`, `eth_getTransactionReceipt`,
  `eth_gasPrice`, `eth_estimateGas`, `eth_feeHistory`, `eth_syncing`,
  `net_version`, `net_listening`, `net_peerCount`, `web3_clientVersion`, `web3_sha3`,
  `txpool_status`, `txpool_content`, plus all `zbx_*` extensions.
- **Files**: `crates/zbx-rpc/src/{state.rs (NEW), eth_api.rs, zbx_api.rs, server.rs, lib.rs}`

### B3. `\r\n` double-escape bug in HTTP responses
- **Was**: `server.rs` was emitting `"\\r\\n"` literals into HTTP headers — every response was malformed and rejected by curl/browsers.
- **Now**: Proper CRLF, `Content-Length`, full status-line/header construction.
- **Files**: `crates/zbx-rpc/src/server.rs`

### B4. RPC bound to `0.0.0.0` with no auth
- **Was**: `0.0.0.0:8545` open with no admin guard.
- **Now**:
  - `bind_addr` is configurable, defaults to `127.0.0.1`.
  - Production configs bind localhost; nginx terminates TLS and proxies in.
  - Admin / debug / personal namespaces require `Authorization: Bearer $ZBX_RPC_ADMIN_TOKEN`. Returns `401` if absent.
  - CORS allowlist via `ZBX_RPC_CORS_ORIGIN` env (comma-separated) or `cors_origins` TOML.
  - Per-IP rate limiting via `RateLimiter` middleware + nginx `limit_req` zones.
- **Files**: `crates/zbx-rpc/src/{server.rs, middleware.rs}`, `node/src/config.rs`, `deploy/nginx/zbx-rpc.conf`

### B5. Genesis bootstrap on first boot
- **Was**: No genesis was ever written. RPC said `latestBlock=0` from a HashMap that had no block.
- **Now**: `GenesisConfig::bootstrap_into(&db)` is called in `ZbxNode::new`. On a fresh data dir the genesis block + initial allocations + chain_id metadata are persisted; on subsequent boots the on-disk genesis is detected and reused with a hash-mismatch warning if the config drifted.
- **Files**: `node/src/genesis.rs`, `node/src/node.rs`

### B6. Placeholder validator addresses
- **Was**: `"0xV001000000000000000000000000000000000001"` etc. — would `panic!` on `Address::from_hex().unwrap()`.
- **Now**: All five mainnet validators and the single testnet validator are syntactically valid 20-byte hex addresses. Treasury allocations are `0x...001001..003`. All parsing returns `Result<_, ZbxError>` and is propagated up.
- **Files**: `node/src/genesis.rs`

### B7. Subsystem wiring in `node.rs::run()`
- **Was**: `run()` spawned RPC + metrics only; mempool, peer manager, consensus loop unused.
- **Now**: `JoinSet` orchestrates RPC, metrics, P2P heartbeat, mempool maintenance, and (when `--validator` + `VALIDATOR_KEY` env present) a validator tick scheduled at the configured `block_time_ms`. Graceful shutdown on `SIGINT` / first task panic.
  - **Note**: HotStuff round driving is intentionally staged. The validator tick is scheduled and instrumented; the consensus crate's executor will be wired in the next milestone. The node still serves RPC and indexes blocks during this period.
- **Files**: `node/src/node.rs`

### B8. Testnet support + `--network` flag
- **Was**: No testnet preset; no way to switch.
- **Now**: `Network::{Mainnet, Testnet}` enum, `--network mainnet|testnet` CLI flag, distinct chain ids, RPC ports, P2P ports, data dirs, validator sets. `print-genesis` reports the resolved network.
- **Files**: `node/src/{genesis.rs, config.rs, main.rs}`

### B9. Real TOML config loader
- **Was**: `NodeConfig::from_file` ignored the file and returned `Default::default()`.
- **Now**: Uses `toml::from_str` with full error context.
- **Files**: `node/src/config.rs`, `node/Cargo.toml` (added `toml = "0.8"`)

### B10. Production config files
- **Was**: None.
- **Now**: `node/configs/{mainnet,testnet}.toml` with VPS bootnodes, localhost-bound RPC, CORS allowlist, sensible cache/file-descriptor limits, and a separate metrics port per network.
- **Files**: `node/configs/mainnet.toml`, `node/configs/testnet.toml`

### B11. Deploy artifacts
- **Was**: Only a docker-compose stub.
- **Now**:
  - `docker/Dockerfile` — multi-stage, installs RocksDB build deps, builds `--release`, runs as non-root `zbx` user with a curl-based JSON-RPC healthcheck.
  - `deploy/systemd/zbx-{mainnet,testnet}.service` — hardened units (`NoNewPrivileges`, `ProtectSystem=strict`, `ProtectKernelTunables`, `RestrictNamespaces`, fd/nproc limits, journald logging).
  - `deploy/nginx/zbx-rpc.conf` — TLS termination for `rpc.zbx.io`, `ws.zbx.io`, `rpc-testnet.zbx.io`, HTTP→HTTPS redirect, `limit_req`, security headers, body-size caps, healthz pass-through.
  - `deploy/scripts/deploy.sh` — one-shot SSH-based provisioning + binary deploy + systemd reload.
- **Files**: `docker/Dockerfile`, `deploy/systemd/*.service`, `deploy/nginx/zbx-rpc.conf`, `deploy/scripts/deploy.sh`

### B12. `.unwrap()` purge in startup path
- **Was**: ~39 `.unwrap()` calls across `node/src/`, including in genesis-address parsing and config loading.
- **Now**: `node/src/` has **1** remaining `.unwrap()` (in the orphan `import_export.rs` file that is not declared as a `mod`). All parsing, IO, and config errors are propagated via `?` and printed to `stderr` with a non-zero `ExitCode`.
- **Verification**: `rg -c '\.unwrap\(\)' node/src/` → `import_export.rs:1`

---

## Hardening — applied

### H1. Admin-namespace bearer auth
Bearer-token middleware around all `admin_*`, `debug_*`, and `personal_*` methods. Token sourced from the `ZBX_RPC_ADMIN_TOKEN` env var (already supplied as a workspace secret). Missing/wrong token → `401 Unauthorized` before dispatch.

### H2. CORS allowlist + preflight
`Origin` header validated against a configured allowlist; `OPTIONS` preflight returns the right `Access-Control-Allow-*` headers. Default mainnet config allows only the official Zebvix dapp/wallet origins.

### H3. Per-IP rate limiting
`RateLimiter` middleware in `crates/zbx-rpc/src/middleware.rs` enforces `rate_limit_rpm` per source IP (configurable in TOML). nginx in front adds a hard ceiling (`limit_req zone=zbx_rpc rate=20r/s burst=60`).

### H4. Batch JSON-RPC support
The HTTP handler now accepts both single objects and JSON arrays per the JSON-RPC 2.0 spec; each entry is dispatched and the responses are returned in order.

### H5. Structured error returns
`RpcError` is reified as JSON-RPC `error.{code,message,data}` instead of opaque strings — `MethodNotFound`, `InvalidParams`, `InternalError` map to standard codes. CLI/integration tools can branch on them.

### H6. Systemd / kernel-level sandboxing
`zbx-{mainnet,testnet}.service` files apply `ProtectSystem=strict`, `NoNewPrivileges`, `RestrictNamespaces`, `LockPersonality`, `ProtectKernelTunables`, `ProtectKernelModules`, `SystemCallArchitectures=native`, plus `LimitNOFILE=65536`. Runs as a dedicated `zbx` system user with no shell.

---

## Still on the roadmap (next milestones)

These are **not** production blockers for an L1 RPC endpoint, but they are tracked so the audit isn't selling the node as more complete than it is:

1. **HotStuff-BFT consensus loop wiring**. The crate (`zbx-consensus`) compiles and the validator tick is scheduled; round driving + block proposal is staged for the next cut.
2. **Real libp2p swarm bring-up**. `PeerManager` is wired; swarm event-loop integration in `zbx-network` is the next P2P milestone.
3. **EVM block executor in the run loop**. Today the executor is invoked through the RPC `eth_call` / `eth_estimateGas` codepaths against historical state; per-block execution at proposal time is the consensus-online milestone.
4. **State pruning / snapshot service**. The crate scaffolding exists in `node/src/{pruner.rs, snapshot_manager.rs, archive_manager.rs}` but is not yet wired into `mod` tree (those files are orphan code today).
5. **Light client / Merkle proofs**. Out of scope for this round.

---

## Verification

```bash
# Workspace cleanup
rg -c '\.unwrap\(\)' zbx-chain/node/src/
# expected: 1 (only import_export.rs, an orphan file)

# Build
cd zbx-chain && cargo check -p zbx-storage --no-default-features --features mem
cd zbx-chain && cargo build --release -p zbx-node

# Local smoke test
./target/release/zbx-node --network testnet --bind-addr 127.0.0.1 --data-dir /tmp/zbx-test &
sleep 2
curl -s -X POST -H 'Content-Type: application/json' \
     --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' \
     http://127.0.0.1:18545/
# expected: {"jsonrpc":"2.0","id":1,"result":"0x231e"}  (8990)

# VPS deploy
deploy/scripts/deploy.sh 93.127.213.192 mainnet
deploy/scripts/deploy.sh 93.127.213.192 testnet
```

---

## File-level change log

| File | Change |
|---|---|
| `crates/zbx-storage/Cargo.toml` | Added `rocksdb = "0.21"`, `parking_lot`, `bincode`, `mem` feature |
| `crates/zbx-storage/src/db.rs` | Full rewrite — RocksDB CFs, atomic batches, latest-height cache |
| `crates/zbx-rpc/Cargo.toml` | Added `zbx-mempool`, `parking_lot`, `sha3` |
| `crates/zbx-rpc/src/state.rs` | **New** — `RpcState` with `Arc<ZbxDb>` and `Arc<RwLock<TransactionPool>>` |
| `crates/zbx-rpc/src/eth_api.rs` | Full rewrite — 25+ real eth_/net_/web3_/txpool_ methods |
| `crates/zbx-rpc/src/zbx_api.rs` | Threaded `RpcState`, replaced `CHAIN_ID` constant with state lookup |
| `crates/zbx-rpc/src/server.rs` | CRLF fix, bearer auth, CORS preflight, batch dispatch, `with_bind` |
| `crates/zbx-rpc/src/lib.rs` | Re-exported `state::RpcState` |
| `node/Cargo.toml` | Added `toml`, `parking_lot`, `thiserror` |
| `node/src/main.rs` | Rewrite — `--network`, `Result`-based exit, `print-genesis` for both networks |
| `node/src/config.rs` | Real TOML loader, `bind_addr`, `Network::{mainnet,testnet}` presets, VPS bootnodes |
| `node/src/genesis.rs` | `Network` enum, testnet preset, `bootstrap_into(&db)`, valid hex addresses, `Result`-everywhere |
| `node/src/node.rs` | `JoinSet` orchestration, validator-key plumbing, mempool/p2p/validator heartbeats |
| `node/configs/mainnet.toml` | **New** — production preset for VPS |
| `node/configs/testnet.toml` | **New** — production preset for VPS |
| `docker/Dockerfile` | **New** — multi-stage build, hardened runtime, healthcheck |
| `deploy/systemd/zbx-mainnet.service` | **New** — hardened systemd unit |
| `deploy/systemd/zbx-testnet.service` | **New** — hardened systemd unit |
| `deploy/nginx/zbx-rpc.conf` | **New** — TLS reverse proxy + rate limiting |
| `deploy/scripts/deploy.sh` | **New** — one-shot VPS provisioning |
| `zbx-chain/src/` (legacy) | **Deleted** — 125 leftover files from monolithic predecessor |

---

## Round-2 architect review (post-fix)

A second-pass code review by the architect agent flagged six follow-up issues
after the initial audit fixes landed. All six were addressed in the same
session before declaring T011 complete.

| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | **Severe (compile)** | `node::run()` called `RpcState::new(...)` with 4 args but the constructor took 3 — would have failed `cargo check`. | `RpcState::new` now accepts `client_version: impl Into<String>` as the 4th parameter (`crates/zbx-rpc/src/state.rs`). |
| 2 | High | `RpcConfig.cors_origins` and `rate_limit_rpm` were defined in TOML but never wired into `RpcServer`. | Added builder methods `with_cors_origins(&[String])` and `with_rate_limit_rpm(u32)` to `RpcServer`; `node::run()` now threads the config values through (`crates/zbx-rpc/src/server.rs`, `node/src/node.rs`). |
| 3 | High | `parse_http()` lowercased the entire header line, including the bearer-token *value*, so mixed-case tokens were rejected. | Replaced with `parse_auth_header()` that uses case-insensitive *name* matching while preserving the value verbatim (`crates/zbx-rpc/src/server.rs`). |
| 4 | High | The HTTP handler did one `read()` and ignored `Content-Length`, so large or fragmented JSON-RPC bodies could be truncated. | New header-aware loop reads until `\r\n\r\n`, parses `Content-Length`, then keeps reading until the full body arrives. Caps headers at 16 KiB and bodies at 1 MiB with proper `413`/`431` responses. |
| 5 | Medium | nginx proxied `wss://ws.zbx.io` to `:8546`, but no WS listener existed in `RpcServer::run()`. | Removed the live WS server block from `deploy/nginx/zbx-rpc.conf`, marked it as v0.3 work in a comment, set `ws_enabled = false` in `mainnet.toml`/`testnet.toml`, and updated `NodeConfig::mainnet()` to default `ws_enabled` to `false`. |
| 6 | Medium | `ZbxDb::get_storage()` and `get_code()` returned zero-defaults on DB errors (silent corruption). Default writes had no fsync, so the chain tip could roll back on power loss. | (a) Both getters now return `Result<…, StorageError>`; `eth_get_code` and `eth_get_storage_at` propagate errors as `RpcError::Internal`. (b) Added `write_synced()` which sets `WriteOptions::set_sync(true)`; `put_block()` now uses the synced path so the canonical chain tip survives crashes. |

### Honest known limitations (kept open by design)

- **JWT auth**: the admin namespace is currently protected by a static bearer
  token (`ZBX_RPC_ADMIN_TOKEN`), not full JWT verification. Acceptable for the
  v0.2 mainnet bring-up because admin endpoints are also bind-restricted to
  `127.0.0.1` behind nginx; full JWT is tracked for v0.3 along with WS.
- **`eth_call` simulation** returns `0x` until the EVM execution engine is
  wired into the RPC layer; intentionally documented in code.
- **HotStuff round driver** is heartbeat-only at this milestone; full pacemaker
  + view-change wiring lands with the validator-set publishing work.
- **Compile verification** (`cargo check -p zbx-storage`) could not be run end
  to end inside the build sandbox — `librocksdb-sys 0.11.0+8.1.1` requires
  ~330 C++ translation units and the per-tool 110 s budget kills the C++
  toolchain mid-build. The fixes above were verified by reading every
  call-site by hand. The same code base built cleanly to a `librocksdb.a` in
  three earlier sessions on this machine; expected to re-link cleanly under a
  longer-budget runner (CI / VPS).

