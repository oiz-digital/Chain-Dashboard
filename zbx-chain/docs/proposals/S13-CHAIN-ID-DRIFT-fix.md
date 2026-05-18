# S13-CHAIN-ID-DRIFT — fix proposal

**Status**: AUTHORED 2026-05-01 (Session 14, T01)
**Author**: agent (post-Session-13 wrap)
**Audit reference**: `AUDIT_2026-04-30.md` Session 13 entry, finding `S13-CHAIN-ID-DRIFT` (CRITICAL, devnet-blocker).
**Related finding**: `S13-LEGACY-CHAINID-REPLAY` (HIGH) — addressed in companion proposal.
**Severity**: CRITICAL (devnet cannot start until merged).

---

## 1. Executive summary

The repo currently has **five different chain-ID values** scattered across crates, tests, SDKs, contracts, ops configs, and docs:

| Value | Where (representative) | Disposition |
|------:|------------------------|-------------|
|  7878 | `zbx-zvm`, `zbx-vm`, `zbx-tx`, `zbx-pool`, `zbx-net`, `zbx-config`, `zbx-sdk`, `zbx-payid`, `zbx-admin`, `zbx-da`, `zbx-genesis`, `zbx-bundler`, `zbx-cli`, `zbx-wallet`, both TS SDKs, several `.sol`, `monitoring/prometheus.yml`, `k8s/da-node.yaml`, 3 ops scripts, ~7 docs | **DELETE** as chain-ID. KEEP only as BIP-44 coin type (renamed). |
|  7879 | `zbx-net::hello.rs::CHAIN_ID_TESTNET`, `zbx-config::ChainConfig::testnet()`, `zbx-sdk::types::testnet`, `zbx-explorer::contract_verify` doc-comment | **DELETE** entirely. |
|  7880 | `zbx-config::ChainConfig::devnet()` | **DELETE** entirely (decision 2026-05-01: no separate devnet chain-ID). |
|  8989 | `zbx-types::CHAIN_ID` (canonical mainnet) | **KEEP** + promote to `CHAIN_ID_MAINNET`. |
|  8990 | `config/{devnet,testnet}.toml` | **KEEP** + lift to `zbx-types::CHAIN_ID_TESTNET`. |

Result after this proposal lands: **only `{8989, 8990, 7878-as-BIP44-coin-type}` exist anywhere in the repo**. CI guard enforces this.

---

## 2. Why this is CRITICAL (not just cosmetic)

1. **Peer handshake refuses to peer with self.** `zbx-net/src/hello.rs:24` defines `CHAIN_ID_MAINNET = 7878` and `hello.rs:109` enforces `local.chain_id == remote.chain_id` with `DisconnectReason::WrongChainId`. Operator config sets 8989; peer handshake compares against 7878 → **every peer connection drops at handshake on a real mainnet build today**. Devnet (8990) has the same defect against `CHAIN_ID_TESTNET = 7879`.
2. **Tx signature replay-protection broken cross-network.** `zbx-tx/src/legacy.rs:113` and `zbx-pool/src/tx_validate.rs:173` build/validate against literal 7878. With operator config = 8989, every signed tx has `chain_id = 8989` but pool fixtures expect 7878 → tests pass against the literal but real mempool rejects real txs.
3. **Bundler entry-point hash mismatch (S13-A3).** `zbx-bundler/src/mempool.rs:88` hashes UserOps with literal 7878. UserOp signatures from real wallets are over `chain_id = 8989`/`8990` → **all 4337 UserOps are rejected** with no useful error.
4. **Wallet derivation collides chain-ID with BIP-44 coin type.** `zbx-wallet::ZBX_COIN_TYPE = 7878` is intentional (SLIP-0044 reservation request) — but the name conflates it with chain-ID, and identical 7878 in both contexts creates "fix one, break the other" hazards.
5. **SDK consumers get the wrong network.** Both `sdk/zebvix-js` and `sdk/ethers-zbx` shipped wrong default → any dApp that imports them connects to a non-existent network.
6. **Explorer contract verification hardcodes "7878 mainnet / 7879 testnet"** — verified contracts will be rejected on a real 8989/8990 chain.
7. **Architect S13.1 review** flagged subset of these (A3 bundler) but missed the `zbx-net::hello.rs` peer-handshake breakage. This proposal closes the full surface.

---

## 3. Design

### 3.1 New canonical source of truth

Extend `crates/zbx-types/src/lib.rs`:

```rust
/// Chain ID for Zebvix mainnet.
pub const CHAIN_ID_MAINNET: u64 = 8989;

/// Chain ID for Zebvix public testnet AND devnet (decision locked 2026-05-01).
/// Devnet rides on the testnet preset; no separate chain ID.
pub const CHAIN_ID_TESTNET: u64 = 8990;

/// Backward-compat alias. New code should use `CHAIN_ID_MAINNET`.
#[deprecated(note = "Use CHAIN_ID_MAINNET (or CHAIN_ID_TESTNET on testnet/devnet builds).")]
pub const CHAIN_ID: u64 = CHAIN_ID_MAINNET;

/// BIP-44 SLIP-0044 coin-type registration for ZBX. NOT the chain ID.
/// Reserved value 7878. See https://github.com/satoshilabs/slips/blob/master/slip-0044.md
pub const BIP44_COIN_TYPE_ZBX: u32 = 7878;
```

### 3.2 Crate-by-crate refactor

Every crate that currently has a hardcoded literal MUST switch to a `use zbx_types::{CHAIN_ID_MAINNET, CHAIN_ID_TESTNET};` import. Crates without a `zbx-types` dep get one added. The `BIP44_COIN_TYPE_ZBX` const replaces every `ZBX_COIN_TYPE = 7878` usage in wallet/SDK code (rename, **value unchanged**).

| Crate | Action |
|-------|--------|
| `zbx-types` | Add `CHAIN_ID_MAINNET`/`CHAIN_ID_TESTNET`/`BIP44_COIN_TYPE_ZBX`. Deprecate `CHAIN_ID`. |
| `zbx-zvm` | DELETE local `pub const ZBX_CHAIN_ID = 7878`. Update `context.rs:58` literal → `zbx_types::CHAIN_ID_MAINNET`. |
| `zbx-vm` | Update `interpreter.rs:28`, `context.rs:64` literals → `zbx_types::CHAIN_ID_MAINNET`. |
| `zbx-tx` | **Add `zbx-types` dep**. Update `legacy.rs:{113,138}` → `zbx_types::CHAIN_ID_MAINNET`. Comment in `types.rs:16` updated. |
| `zbx-pool` | Update `tx_validate.rs:173` → `zbx_types::CHAIN_ID_MAINNET`. |
| `zbx-net` | DELETE local `CHAIN_ID_MAINNET`/`CHAIN_ID_TESTNET`. `pub use zbx_types::{CHAIN_ID_MAINNET, CHAIN_ID_TESTNET};` for backward-compat. |
| `zbx-config` | **Add `zbx-types` dep**. DELETE local `ZBX_CHAIN_ID`. Refactor `ChainConfig::{mainnet,testnet}` to use canonical consts; **DELETE `ChainConfig::devnet()`** (decision 2026-05-01). |
| `zbx-sdk` (Rust) | DELETE `pub mod {mainnet,devnet,testnet}` chain-id consts. Re-export from zbx-types. Update `wallet.rs:{29,34,39}`, `transaction.rs:{113,125,131}` → `zbx_types::CHAIN_ID_MAINNET`. |
| `zbx-payid` | Update `resolver.rs:{47,66}` → `zbx_types::CHAIN_ID_MAINNET`. Doc-comment `resolver.rs:17` updated. |
| `zbx-admin` | Update `config.rs:117` literal → `zbx_types::CHAIN_ID_MAINNET`. |
| `zbx-da` | Update `blob.rs:52` doc-comment + literal usages → canonical. |
| `zbx-genesis` | Update `spec.rs:11` doc-comment. |
| `zbx-explorer` | Update `contract_verify.rs:92` doc → "8989 mainnet / 8990 testnet". |
| `zbx-bundler` | Update `mempool.rs:88` to use the runtime chain_id (BundlerMempool gains a `chain_id: u64` field set at construction). |
| `zbx-cli` | Update `README.md` "Chain ID: 7878" → 8989. |
| `zbx-wallet` | Rename `ZBX_COIN_TYPE` → `BIP44_COIN_TYPE_ZBX` (re-export from zbx-types). Update `ZBX_DERIVATION_PATH` doc-comment to NOT say "matches Chain ID". |

### 3.3 Tests refactor

| Test | Action |
|------|--------|
| `tests/integration/zvm_test.rs:25` | `assert_eq!(ZBX_CHAIN_ID, 7878)` → `assert_eq!(zbx_types::CHAIN_ID_MAINNET, 8989)`. |
| `tests/integration/evm.rs:18` | `chain_id: 7878` → `zbx_types::CHAIN_ID_MAINNET`. |
| `tests/integration/da_test.rs:{73,102}` | Same. |
| `tests/integration/bundler_test.rs:{68,81,144,145,152}` | Use new mempool API: `mempool.add(op)` with mempool constructed via `BundlerMempool::new(zbx_types::CHAIN_ID_MAINNET)`. Direct `op.hash(EP, 7878)` → `op.hash(EP, zbx_types::CHAIN_ID_MAINNET)`. |
| `tests/unit/payid.rs:{128,145}` | `chain_id: 7878` → `zbx_types::CHAIN_ID_MAINNET`. |
| `crates/zbx-tx/src/legacy.rs:138` (inline `#[test]`) | Same; rename test fn for clarity. |

### 3.4 SDKs (TypeScript) — major-version bump required

| SDK | Action | Version bump |
|-----|--------|--------------|
| `sdk/zebvix-js` | Add `MAINNET_CHAIN_ID = 8989`, `TESTNET_CHAIN_ID = 8990` consts. Default `CHAIN_ID` export → 8989 (mainnet) but with prominent doc-comment. Update `wallet.ts:{77,119,152}` + `contract.ts:109` + `index.ts:81`. | 0.x → 1.0 (breaking change). |
| `sdk/ethers-zbx` | Update `chain.ts:{14,45}`, `provider.ts:17` → 8989. Add testnet network factory. | 0.x → 1.0 (breaking change). |

### 3.5 Solidity contracts + contract docs

Drop the chain-ID-as-literal pattern in NatSpec entirely. NatSpec already cannot bind on-chain; the per-network address files (`deployments/{mainnet,testnet}.json`) are authoritative.

| File | Change |
|------|--------|
| `contracts/interfaces/IZRC20.sol:5` | Drop "(Chain ID 7878)". |
| `contracts/ZRC20Base.sol:8` | Drop. |
| `contracts/ZbxBundler.sol:16` | Drop "ZBX Chain ID: 7878" line. |
| `contracts/ZbxPayId.sol:24` | Drop. |
| `contracts/ZRC20Standard.md:4` | "Chain ID 7878" → "Chain IDs: 8989 mainnet / 8990 testnet & devnet". |
| `contracts/README.md:{23,108}` | 7878 → 8989. |

### 3.6 Ops configs + scripts

| File | Change |
|------|--------|
| `monitoring/prometheus.yml:9` | `chain_id: '7878'` → `chain_id: '8989'`. |
| `k8s/da-node.yaml:32` | `value: "7878"` → `value: "8989"`. |
| `scripts/da-submit.sh:47` | `--chain-id 7878` → `--chain-id 8989`. |
| `scripts/snapshot.sh:76` | `chain_id: 7878` → `chain_id: 8989`. |
| `scripts/testnet-add-validator.sh:{38,498}` | `chain_id 7878` → `chain_id 8989` in mainnet-untouched comments. |

### 3.7 Documentation

| File | Change |
|------|--------|
| `docs/RPC_API.md:{24,77}` | 7878 → 8989. |
| `docs/API_REFERENCE.md:{14,56,89}` | 7878 → 8989; `0x1EC6` (7878 hex) → `0x231D` (8989 hex). |
| `docs/PAYID.md:144` | "ZBX Mainnet (7878)" → "(8989)". |
| `docs/NFT_STANDARD.md:4` | Same. |
| `docs/DA_LAYER.md:{21,100}` | Same. |
| `docs/EVM_COMPATIBILITY.md:{53,63,64,65}` | Update table cells + worked examples. |
| `docs/proposals/ZEP-001-PAYID.md:{60,154}` | Same. |
| `docs/BRIDGE.md:5` | Already updated in Session 13; verify. |
| `crates/zbx-cli/README.md:{3,56}` | 7878 → 8989. |

### 3.8 CI literal-scanner guard

Add `scripts/check-chain-id.sh` that fails CI on any `\b(7878|7879|7880)\b` match outside an explicit allowlist:

```sh
#!/usr/bin/env bash
# Allowlist:
#   - AUDIT_2026-04-30.md, CHANGELOG.md, DOC_STATUS.md (historical record)
#   - This proposal file
#   - BIP-44 coin-type usages (literal must be commented `// BIP-44 coin type, not chain ID`)
set -euo pipefail
ALLOWLIST_REGEX='AUDIT_2026-04-30\.md|CHANGELOG\.md|DOC_STATUS\.md|S13-CHAIN-ID-DRIFT-fix\.md|BIP-44 coin type, not chain ID'
HITS=$(rg -n '\b(7878|7879|7880)\b' --type-add 'src:*.{rs,ts,js,toml,json,sh,md,yml,yaml,sol}' -t src . 2>/dev/null | grep -vE "$ALLOWLIST_REGEX" || true)
if [ -n "$HITS" ]; then
  echo "❌ chain-ID literal-scanner found drift:"; echo "$HITS"; exit 1
fi
echo "✅ chain-ID guard passed"
```

Wired into the existing `make check` / `pnpm run typecheck` pipeline as a pre-commit step (and into CI as a required check).

---

## 4. Atomicity / merge strategy

This change is **all-or-nothing**. Partial merge would leave the chain in an inconsistent state where some crates speak 7878 and others 8989, which is exactly the bug today. PR commit ordering:

1. `zbx-types`: add new consts (does not break anything).
2. `zbx-tx`, `zbx-config`, `zbx-wallet`: add `zbx-types` Cargo dep.
3. All Rust source-code refactors in one commit.
4. All test updates in one commit.
5. SDK + contract NatSpec + ops/configs/docs in one commit.
6. CI guard script + wire-up in one commit.
7. CHANGELOG / replit.md / DOC_STATUS update in final commit.

Total expected diff: **~50 files, ~250 lines changed**.

---

## 5. Verification plan

**Sandbox CANNOT verify** (RocksDB build SIGKILL — known constraint). All verification deferred to a build host.

| Step | Command | Expected |
|------|---------|----------|
| 1 | `cargo build --release` | Clean build. |
| 2 | `cargo test --release -- --nocapture` | All tests pass; no chain-ID-related panics. |
| 3 | `bash scripts/check-chain-id.sh` | Exit 0; "✅ chain-ID guard passed". |
| 4 | `cargo run --release -p zbx-node -- --network mainnet --print-config \| grep chain_id` | `chain_id: 8989`. |
| 5 | `cargo run --release -p zbx-node -- --network testnet --print-config \| grep chain_id` | `chain_id: 8990`. |
| 6 | Spawn 2 nodes with same network, observe peer handshake | No `WrongChainId` disconnects. |
| 7 | `pnpm --filter @zebvix/zebvix-js run build && pnpm test` | Clean. Major version bumped to 1.0.0. |

If steps 1-3 fail, **revert and re-author**. If 4-7 fail, hot-fix on top.

---

## 6. Rollback plan

If a defect surfaces post-merge that requires emergency rollback:

```sh
git revert <merge-commit-sha>
# OR if rebased:
git revert <range-of-this-PR>
```

The revert restores the pre-merge state (broken peer handshake + drift) but unblocks any unrelated work. Then re-attempt with the defect fixed.

---

## 7. Out of scope (handled separately)

- **`S13-LEGACY-CHAINID-REPLAY` (HIGH)** — `eth_api.rs:242` accepts `chain_id=0` legacy txs unconditionally; addressed in companion proposal `S13-LEGACY-CHAINID-REPLAY-fix.md`.
- **Network enum** — project-goal doc mentions `Network::{Mainnet,Testnet}` enum; that enum doesn't exist as a Rust enum today. Out of scope for this proposal; tracked separately if/when needed.
- **Mainnet genesis hash regeneration** — no genesis exists yet; no rotation needed.

---

## 8. Hinglish summary (for project owner)

Pure repo me chain-ID 5 alag-alag values me bikhri hai (7878, 7879, 7880, 8989, 8990). Yeh proposal sab ko sirf 2 values me consolidate karta hai (8989 mainnet, 8990 devnet+testnet). 7878 sirf BIP-44 coin-type ke liye reserve rahegi (alag naam se). Total ~50 files touch honge. Sandbox build nahi kar sakta — VPS pe `cargo build` + `cargo test` chala ke verify karna padega. Devnet bring-up ka HARD BLOCKER yehi proposal hai.
