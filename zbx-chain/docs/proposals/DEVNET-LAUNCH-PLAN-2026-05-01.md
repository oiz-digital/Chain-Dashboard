# Zebvix Chain — Devnet Launch Playbook

**Status**: AUTHORITATIVE
**Date**: 2026-05-01 (Session 13)
**Scope**: Bring up a fresh ZBX devnet on a single VPS, then a multi-validator
public devnet, then a public-facing announcement. **NOT** mainnet — see
`PHASE-PLAN-2026-05-01.md` for the mainnet path.
**Audience**: Node-team operators who already have shell access to the VPS.
**Hinglish summary at end** for the project owner.

**Chain-ID design (locked-in 2026-05-01):**
- Mainnet = **8989**, Devnet + Testnet = **8990** (shared).
- Devnet uses the testnet preset (`Network::Testnet`) — no separate `Network::Devnet` enum variant exists or is planned.
- Therefore: do NOT introduce a third chain ID. Wallets configured for public testnet will work against devnet too. Devnet must be operationally isolated from public testnet (different bootstrap peers, different validator key set), not via chain-ID separation.

**Feature-parity scope (locked-in 2026-05-01):**

Devnet AND public testnet must both expose the **full product surface**:

| Surface | Devnet | Public testnet |
|---------|--------|----------------|
| Validator count | 1 | 3+ |
| RPC namespaces | `eth_*`, `zbx_*`, `net_*`, `admin_*` | same |
| Public RPC URL behind TLS | yes | yes |
| WebSocket subscriptions | yes | yes |
| Faucet (rate-limited) | yes | yes (tighter rate) |
| Block explorer | yes | yes |
| Status / health page | yes | yes |
| Prometheus + Grafana | yes (operator-only) | yes (operator-only) |
| All 33+ Solidity contracts deployed | yes | yes |
| BSC-testnet bridge | yes (with experimental warning) | yes (with experimental warning) |
| `sdk/zebvix-js` + `sdk/ethers-zbx` | yes (feature-flag) | yes (default) |
| Mobile Flutter wallet network entry | yes | yes |
| Dev-facing docs reference both | yes | yes |

> **Architect-review override**: the S13.1 architect-review (see `AUDIT_2026-04-30.md`) recommended skipping the bridge entirely on the first public devnet cut due to S11-BRIDGE-SOL-OUT1 (CRITICAL). User decision 2026-05-01 OVERRODE this: bridge ships on devnet too, but every UI/doc surface that touches the bridge MUST carry an explicit "experimental, do not deposit real value" banner until S11-BRIDGE-SOL-OUT1 closes (PHASE-PLAN P0-T02). The architect's safety concern is preserved as a UX warning, not a deployment skip.

> **Resource estimate revision**: previous Phase-A estimate of "1 VPS, ~$20/mo" no longer holds. Full-experience devnet needs **2-3 VPSs** (validator + explorer/Postgres/indexer + faucet/UI; faucet can co-locate with explorer): **~$60-100/mo**. Public testnet adds another 2× validator VPSs for multi-org distribution. Re-scope Phase A accordingly in Session 14.

---

> ## 🛑 HARD BLOCKER ADDED 2026-05-01 — DO NOT START THE VPS BRING-UP YET
>
> Session 13 surfaced a **NEW CRITICAL** finding (`S13-CHAIN-ID-DRIFT`) while
> sweeping doc-drift: production Rust source code disagrees with itself on the
> chain ID. Specifically:
>
> - `crates/zbx-types/src/lib.rs:30` — `pub const CHAIN_ID: u64 = 8989;` ← **source of truth**
> - `crates/zbx-zvm/src/lib.rs:63`  — `pub const ZBX_CHAIN_ID: u64 = 7878;` ← **WRONG**
> - `crates/zbx-zvm/src/context.rs:34, 58` — hardcoded `7878`
> - `crates/zbx-vm/src/{interpreter,context}.rs` — hardcoded `7878`
> - `crates/zbx-tx/src/legacy.rs:113, 137-138` — hardcoded `7878` plus a test
>   literally named `chain_id_7878_for_zbx`
> - `crates/zbx-wallet/src/create_import.rs` — BIP-44 coin type `7878`
>   (separate concern — SLIP-0044 reservation; do NOT bump without a proposal)
> - `tests/integration/{zvm,evm,da,bundler,payid}.rs` — assert against `7878`
> - `sdk/{zebvix-js,ethers-zbx}` — TypeScript SDKs hardcode `7878`
>
> **Operational impact if launched today:** every EIP-155 EVM transaction will
> fail signature verification. The chain core will reject the VM's signed
> output, and the VM will reject txs that the chain core accepted. Devnet will
> appear to start but no tx will land.
>
> **Required action before Phase A of this plan runs:** open a separate
> proposal `docs/proposals/S13-CHAIN-ID-DRIFT-fix.md` covering:
>   1. Single source-of-truth: import `zbx_types::CHAIN_ID` everywhere instead
>      of redefining `ZBX_CHAIN_ID` in the VM crate.
>   2. Decision on BIP-44 coin type: keep `7878` (SLIP-0044 path stability) or
>      register a new SLIP-0044 entry for ZBX. Default recommendation: keep
>      coin_type `7878` and add a comment that it is intentionally decoupled
>      from chain_id. Rename `ZBX_COIN_TYPE` constant to make this explicit.
>   3. SDK version bump (zebvix-js, ethers-zbx) — major version because client
>      apps must update their `chainId` literal.
>   4. Test fixtures: rename `chain_id_7878_for_zbx` → `chain_id_matches_const`
>      and load from `zbx_types::CHAIN_ID`.
>   5. Re-run full test suite (gated by Cargo.lock signing — sandbox cannot run
>      RocksDB-linked crates; needs to run on the VPS or a build host).
>
> Estimated effort: **1.5-2 dev-days**. Add as `P0-T06` to PHASE-PLAN.
>
> Until that fix lands and is verified by `pnpm-workspace`-equivalent CI on the
> VPS (ZBX has Rust workspace), **do not run any of the steps below**.

---

> ## 🛑 SECOND HARD BLOCKER ADDED 2026-05-01 (post-architect-review) — PLAYBOOK-NAMING/CLI MISMATCHES
>
> Architect review of this playbook against actual `node/` and `crates/` source
> revealed that several commands and binary names quoted below (and inside
> `scripts/testnet-deploy.sh`, `scripts/deploy-contracts.sh`, etc.) do not
> match the workspace's real CLI surface. **The playbook will fail Phase A
> immediately if executed as written today.**
>
> **Concrete corrections required before Phase A runs:**
>
> 1. **Binary name.** Several places call `zebvix-node ...`. The actual binary
>    name in `node/Cargo.toml` is **`zbx-node`** (short form). Either:
>    - rename every `zebvix-node` reference in the playbook + scripts to `zbx-node`, OR
>    - add a `[[bin]] name = "zebvix-node"` alias in `node/Cargo.toml` (shorter
>      diff but creates a second binary; less preferred).
>
>    Affected files (non-exhaustive — re-grep before patching):
>    - `scripts/testnet-deploy.sh` — references `target/release/zebvix-node`
>    - this playbook Phase A "start node" command
>    - this playbook Phase B "validator-add" command
>
> 2. **Subcommand shape.** Playbook references CLI subcommands like
>    `keygen`, `send`, `validator-add` that are not present in `node/src/main.rs`.
>    Inventory the actual subcommands by running `cargo run --release -p zbx-node -- --help`
>    on the VPS and rewrite Phase A/B commands to match. Likely real
>    surface (subject to verification on VPS):
>    - `zbx-node start --config config/testnet.toml`
>    - `zbx-node genesis --config config/testnet-genesis.json`
>    - `zbx-node db {compact,export,import,snapshot}`
>    - `zbx-node admin {peer-add, peer-list}` (admin API on port 8547)
>
>    Document the exact subcommand matrix in this playbook before running.
>
> 3. **RPC method names.** Phase B "verify validator set" command must call
>    **`zbx_getValidatorSet`** (the actual method registered in
>    `crates/zbx-rpc/src/zbx_api.rs:13`), NOT `zbx_validators` as previously
>    written. Phase B "verify peer connectivity" must use **`net_peerCount`**
>    (returns hex-quantity peer count) NOT `net_listening` (returns bool) for
>    a count-based health check.
>
> 4. **Bridge on first public devnet — DEFER.** The current playbook
>    recommends "use BSC TESTNET due to S11-BRIDGE-SOL-OUT1". Architect
>    feedback (and additional review of `crates/zbx-bundler/src/mempool.rs:88`
>    which still hardcodes chain_id 7878 in the bundler `drain_for_bundle`
>    path) is that **the safer default is to skip the bridge entirely on the
>    first public devnet cut**, then add it as a clearly-labelled
>    "experimental Phase D.bridge" later, after S11-BRIDGE-SOL-OUT1 has its
>    proposal scoped (PHASE-PLAN P0-T02). Update Phase D to make bridge
>    integration optional + explicit-opt-in.
>
> 5. **Devnet → mainnet migration.** The current outline implies an in-place
>    "flip the chain ID" migration. Architect: this is not realistic for a
>    consensus chain — chain-id is mixed into every signed transaction and
>    every block hash. The realistic strategy is **fresh mainnet genesis**
>    (chain_id = 8989, fresh validator set, fresh block-height-zero) with
>    optional state-snapshot import for token-balance carry-over. Re-write
>    the migration section to be explicit about "fresh genesis, optional
>    balance-import" instead of "in-place flip".
>
> 6. **`drain_for_bundle` chain-id missed surface.** Add to `S13-CHAIN-ID-DRIFT`
>    proposal scope: `crates/zbx-bundler/src/mempool.rs:88` still hardcodes
>    `7878` in the UserOp-bundle drain path. The bundler add/hash path uses
>    runtime chain-id but the drain path does not, so `EntryPoint` settlement
>    will produce hash-mismatched bundles after S13-CHAIN-ID-DRIFT lands.
>    Bundler is one of the 53 unwired crates today (PHASE-PLAN P1A surface),
>    so impact is post-P1A only — but fix it in the same patch set.
>
> 7. **Legacy chain_id=0 tx acceptance.** `crates/zbx-rpc/src/eth_api.rs:242`
>    explicitly accepts `chain_id == 0` (pre-EIP-155) txs for "compatibility
>    with raw signers". This allows replay-class behavior across networks
>    for legacy-signed txs. Out of scope for this playbook, but file as
>    follow-up finding **`S13-LEGACY-CHAINID-REPLAY`** (HIGH) and resolve
>    before mainnet (recommended fix: reject legacy txs entirely, OR accept
>    only when explicitly enabled and document the cross-network replay
>    risk).
>
> **None of these blockers prevent S13-CHAIN-ID-DRIFT proposal authoring.**
> They DO prevent this playbook from being executed as a runbook. The order
> of operations is: (a) author S13-CHAIN-ID-DRIFT-fix.md; (b) execute it; (c)
> revise this playbook against the actual CLI surface; (d) THEN start Phase A.

---

## Why a separate devnet (and not jump to mainnet)

The full audit (`AUDIT_2026-04-30.md` Sessions 1-12) plus the production-readiness
gap analysis (`PHASE-PLAN-2026-05-01.md`) identified **3 mainnet-blocking
findings** that must NOT ship to a value-bearing chain:

| Blocker | Where | Devnet impact | Mainnet impact |
|---------|-------|---------------|----------------|
| **S7-PROD1** — `tx_root` is hardcoded `[0u8; 32]` in production block producer | `node/src/producer.rs` (or equivalent) | OK for devnet (no external verifiers expected) | Hard-blocker — bridges/light-clients/exchanges reject blocks |
| **S7-EVM3** — CALL/CREATE/DELEGATECALL/STATICCALL/CALLCODE/CREATE2/SELFDESTRUCT/REVERT missing in **both** `zbx-evm` and `zbx-zvm` dispatch tables | `crates/zbx-evm/src/`, `crates/zbx-zvm/src/` | OK for devnet (mark "Limited Solidity — single-contract only"). dApp devs CAN deploy isolated tokens, hello-world contracts, basic logic. **Cannot** deploy Uniswap, Aave, factories, proxies, ERC-4337 wallets. | Hard-blocker — most real dApps will silently fail or revert |
| **S11-BRIDGE-SOL-OUT1** — BSC bridge nonce-collision in `contracts/ZbxBridge.sol` | Solidity contract | OK if devnet bridges to **BSC TESTNET only** (zero monetary value) | Hard-blocker — silent fund-loss on real BSC bridge |

### Devnet rules to make blockers tolerable

1. **Token has zero value**. Devnet ZBX is for testing only. Faucet drip to anyone.
2. **Bridge connects to BSC TESTNET only**, never BSC mainnet. Devnet ZBX cannot move to a value-bearing chain.
3. **Mark Solidity capability honestly**. Public docs say "deploy single-contract Solidity (CALL family pending P0-T03)".
4. **No external indexer / light-client integrations until S7-PROD1 lands**. tx_root being zero will confuse them.
5. **No exchange listing requests**. Period.

If those 5 rules are followed, devnet is safe to run publicly while P0 work
proceeds in parallel on a separate branch.

---

## Pre-flight checklist (before touching the VPS)

### Code-level prerequisites

- [ ] Repo at the expected commit (current HEAD on `main` includes Session 1-12 audit fixes)
- [ ] `cargo check -p zbx-types && cargo check -p zbx-crypto` passes locally
- [ ] `crates/zbx-types/src/lib.rs` shows `CHAIN_ID = 8989` (mainnet) — and `Network::Testnet` in `node/src/genesis.rs` resolves to `CHAIN_ID + 1 = 8990` for devnet
- [ ] `node/src/genesis.rs` validator addresses are real 20-byte hex (not placeholders)
- [ ] `ZBX_RPC_ADMIN_TOKEN` is set in the deploy env (we use the existing `ADMIN_TOKEN` workspace secret)
- [ ] Session 13 chain-id-script-fixes (testnet-deploy.sh, deploy-contracts.sh, mainnet-launch.sh) are committed — see DOC_STATUS.md "Session 13 doc-drift fix list" items 13-15

### Env / secrets

- [ ] `ADMIN_TOKEN` (already in workspace secrets) — used as `ZBX_RPC_ADMIN_TOKEN` for admin namespace
- [ ] `BSC_DEPLOYER_PRIVATE_KEY` (already in workspace secrets) — used **only** to deploy bridge contracts to BSC **testnet**, never mainnet
- [ ] `DEVNET_FAUCET_KEY` — generate fresh on first boot (`zebvix-node keygen --out ~/.zebvix/faucet.key`); fund from genesis allocation
- [ ] `GOVERNOR_KEY` — separate from validator keys; used to sign `validator-add` txs

### VPS sizing (single-node devnet)

| Resource | Minimum (single-validator devnet) | Recommended (3-validator public devnet) |
|----------|------------------------------------|------------------------------------------|
| CPU | 4 cores | 8 cores per node |
| RAM | 8 GB | 16 GB per node |
| Disk | 250 GB SSD | 1 TB NVMe per node |
| Network | 100 Mbps | 1 Gbps + static IP per node |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| Kernel | ≥ 5.15 (for io_uring) | ≥ 5.15 |
| Open ports | `8545` (RPC), `30333` (P2P), `9090` (metrics, behind nginx-allow-list) | same + `8546` (WS) once wired |

### External services to provision before public launch

- [ ] DNS records: `rpc-devnet.zbvix.com`, `ws-devnet.zbvix.com`, `explorer-devnet.zbvix.com`, `faucet-devnet.zbvix.com`, `status.zbvix.com`
- [ ] TLS certs (Let's Encrypt via certbot — script `scripts/letsencrypt-init.sh` if needed)
- [ ] BSC testnet RPC URL (use public e.g. `https://data-seed-prebsc-1-s1.bnbchain.org:8545`)
- [ ] Block explorer instance (use the existing `artifacts/sui-fork-dashboard` artifact pointed at the devnet RPC URL)
- [ ] Status page (any hosted offering — Statuspage.io, Instatus, or self-hosted Uptime Kuma)
- [ ] Discord/Telegram for community comms

---

## Phase A — Single-validator devnet on one VPS

This is the smallest viable devnet. Use it to shake out script bugs before
expanding to multi-validator.

### Step 1 — Build the binary

```bash
# On the VPS (as a regular user, not root)
sudo apt-get update
sudo apt-get install -y build-essential clang pkg-config libssl-dev librocksdb-dev curl

# Install Rust if not present
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
source $HOME/.cargo/env

git clone https://github.com/zebvix-org/zebvix-chain ~/zebvix-chain
cd ~/zebvix-chain

# Devnet binary uses the testnet feature flag (lower stake, looser rate limits, etc.)
cargo build --release --features zvm,testnet --bin zebvix-node

ls -la target/release/zebvix-node      # binary should exist
target/release/zebvix-node --version
```

> **If the build runs out of memory** (likely on a 4 GB VPS — librocksdb-sys has ~330 C++ TUs), set `CARGO_BUILD_JOBS=1` or `CARGO_BUILD_JOBS=2` and re-run. On 8 GB+ leave it parallel.

### Step 2 — Bootstrap with the deploy script

```bash
sudo bash scripts/testnet-deploy.sh           # full deploy (build + install + systemd)
# or, if you already built:
sudo bash scripts/testnet-deploy.sh --service-only
```

> **Verify** the script reports `✓ TESTNET banner confirmed` after restart. If you see `⚠ TESTNET banner not found`, the chain-id-grep in the script is out of sync — Session 13 already fixed this (now greps for `8990`); confirm by `grep 8990 scripts/testnet-deploy.sh`.

### Step 3 — Verify the node is alive

```bash
# Local RPC test (chain id should be 0x231e = 8990 decimal)
curl -fsS -X POST http://127.0.0.1:18545 \
     -H 'Content-Type: application/json' \
     -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
# expected: {"jsonrpc":"2.0","id":1,"result":"0x231e"}

# Block height — should grow every 2s
for i in 1 2 3 4 5; do
  sleep 3
  curl -fsS -X POST http://127.0.0.1:18545 \
       -H 'Content-Type: application/json' \
       -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
       | jq -r '.result'
done
# expected: monotonically increasing hex values
```

### Step 4 — Fund the faucet

```bash
# Inside zebvix-chain dir on the VPS
target/release/zebvix-node keygen --out ~/.zebvix-testnet/faucet.key
chmod 600 ~/.zebvix-testnet/faucet.key

# Get the faucet address (printed by keygen)
FAUCET_ADDR=$(grep -oE '0x[0-9a-fA-F]{40}' ~/.zebvix-testnet/faucet.key | head -1)

# Send from genesis founder account to faucet
target/release/zebvix-node send \
  --from-key ~/.zebvix-testnet/founder.key \
  --to       $FAUCET_ADDR \
  --amount   1000000 \
  --fee      0.001 \
  --rpc      http://127.0.0.1:18545

# Wait 5s for inclusion, then check balance
sleep 5
curl -X POST http://127.0.0.1:18545 \
     -H 'Content-Type: application/json' \
     -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getBalance\",\"params\":[\"$FAUCET_ADDR\",\"latest\"],\"id\":1}"
```

### Step 5 — Smoke-test contract deployment

```bash
# Deploy the pre-built contract suite (contracts that DON'T use CALL family)
# IMPORTANT: deploy-contracts.sh defaults to devnet — confirm with `head -30 scripts/deploy-contracts.sh`
DEVNET_PRIVATE_KEY=$(cat ~/.zebvix-testnet/faucet.key | jq -r .secret_hex) \
  bash scripts/deploy-contracts.sh devnet

ls -la deployments/devnet-*.json     # should show a fresh deployment record
```

> **NOTE on S7-EVM3**: ZbxRouter and BridgeMultisig deployments will succeed at the `forge create` step but **will revert at runtime** when their methods try to call other contracts. This is expected and documented. For Phase A devnet, treat them as "deployed but unreachable until P0-T03 ships".

---

## Phase B — Multi-validator public devnet (3 nodes)

Once Phase A runs cleanly on one VPS for ≥48 hours, expand to 3 nodes for HA
and to give the consensus layer a real workout.

### Layout

| Node | VPS | RPC URL | Role |
|------|-----|---------|------|
| node-1 | `93.127.213.192` (your primary) | `https://rpc-devnet.zbvix.com` (public) | Validator + RPC + faucet host |
| node-2 | (provision second VPS) | internal only | Validator |
| node-3 | (provision third VPS) | internal only | Validator |

### Per-extra-node setup

On each extra VPS, after running Steps 1-3 above, point `--peer` at node-1:

```bash
# On node-2 / node-3
sudo bash scripts/testnet-genesis-keygen.sh node-2     # or node-3

# Get node-1's peer ID
NODE1_PEER_ID=$(curl -fsS http://93.127.213.192:18545 \
    -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","method":"net_listening","params":[],"id":1}' \
    | jq -r '.result.peer_id')

# Edit the systemd unit to add --peer
sudo systemctl edit zebvix-testnet
# Drop in:
#   [Service]
#   ExecStart=
#   ExecStart=/usr/local/bin/zebvix-node-testnet start \
#       --rpc 127.0.0.1:18545 --p2p-port 31333 \
#       --home /root/.zebvix-testnet \
#       --validator-key /root/.zebvix-testnet/validator-keys/node-2.key \
#       --peer /ip4/93.127.213.192/tcp/31333/p2p/$NODE1_PEER_ID
sudo systemctl restart zebvix-testnet
```

### Add the validators to the active set

From node-1 (which holds the genesis governor key):

```bash
# For each new node:
NEW_PUBKEY_HEX=$(ssh root@<node-2-ip> "grep -oE 'pubkey_hex.*' /root/.zebvix-testnet/validator-keys/node-2.key | cut -d'\"' -f4")
zebvix-node-testnet validator-add \
    --pubkey-hex "$NEW_PUBKEY_HEX" --power 1 \
    --rpc http://127.0.0.1:18545 \
    --governor-key /root/.zebvix-testnet/governor.key

# Wait ~10s for the consensus epoch
sleep 10
curl -X POST http://127.0.0.1:18545 \
     -H 'Content-Type: application/json' \
     -d '{"jsonrpc":"2.0","method":"zbx_validators","params":[],"id":1}'
# expected: 3 entries
```

### Public RPC frontend (nginx + TLS)

Node-1 only:

```bash
# Install nginx + certbot
sudo apt-get install -y nginx certbot python3-certbot-nginx

# Use the bundled config (already in deploy/nginx/zbx-rpc.conf)
sudo cp deploy/nginx/zbx-rpc.conf /etc/nginx/sites-available/zbx-devnet.conf
# Edit to point at the devnet ports:
#   server_name rpc-devnet.zbvix.com;
#   proxy_pass http://127.0.0.1:18545;
sudo ln -s /etc/nginx/sites-available/zbx-devnet.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# TLS
sudo certbot --nginx -d rpc-devnet.zbvix.com -d ws-devnet.zbvix.com \
             -d faucet-devnet.zbvix.com -d explorer-devnet.zbvix.com \
             --redirect --non-interactive --agree-tos -m ops@zbvix.com
```

---

## Phase C — Bridge to BSC testnet (NOT mainnet)

S11-BRIDGE-SOL-OUT1 is unfixed → we deploy bridge contracts only to **BSC testnet**.

```bash
cd ~/zebvix-chain/contracts
# Deploy the M-of-N multisig + vault to BSC testnet
TESTNET_PRIVATE_KEY=$BSC_DEPLOYER_PRIVATE_KEY \
ZBX_TESTNET_RPC=https://data-seed-prebsc-1-s1.bnbchain.org:8545 \
  bash ../scripts/deploy-contracts.sh testnet --verify

# Note the BridgeMultisig + BridgeVault addresses from deployments/testnet-*.json
# Wire those addresses into the relayer config on each devnet node
```

> **Hard rule**: do NOT run `bash scripts/deploy-contracts.sh mainnet` until S11-BRIDGE-SOL-OUT1 is fixed AND an external Solidity audit signs off. The script enforces a `read -rp "Type 'yes I am sure'"` prompt for mainnet — do not bypass it.

---

## Phase D — Public launch (community-facing)

### Pre-launch checklist

- [ ] All 3 validators producing/voting blocks for ≥7 days continuously
- [ ] RPC reachable from outside the VPS network (`curl https://rpc-devnet.zbvix.com -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'` from a laptop)
- [ ] Faucet endpoint live + rate-limited (recommended 1 ZBX per address per 24h, capped per-IP)
- [ ] Explorer (sui-fork-dashboard or similar) is indexing the devnet RPC
- [ ] Status page configured with at least: RPC up/down, block-height freshness, peer-count, validator-set-size
- [ ] `S7-EVM3` known limitation banner visible on docs site + faucet site
- [ ] `chain_id = 8990` documented in the public-facing devnet README
- [ ] BSC-testnet bridge UI (or simple form) live, with hard banner "DEVNET — TESTNET BRIDGE — ZERO VALUE"
- [ ] `prometheus + grafana` running with the supplied `monitoring/` config; alerting wired to ops Discord/Slack

### Public-launch comms

Sample announcement skeleton (English; translate to Hindi/Hinglish for community):

```
Zebvix Chain devnet is live.

  RPC:        https://rpc-devnet.zbvix.com
  Chain ID:   8990
  Explorer:   https://explorer-devnet.zbvix.com
  Faucet:     https://faucet-devnet.zbvix.com
  Block time: ~2s
  Status:     https://status.zbvix.com

This is a DEVNET. Tokens have zero monetary value.

Known limitations (mainnet roadmap):
  • CALL/CREATE family of EVM opcodes is not yet implemented — multi-contract
    Solidity (Uniswap, Aave, factories, ERC-4337 wallets) will fail.
    Single-contract Solidity (ERC-20, simple logic) works.
  • Bridge currently connects to BSC testnet only.
  • tx_root is zero in produced blocks — external indexers / light clients
    should pin to our explorer rather than try to verify tx-roots independently.

We are tracking a 7-10 week mainnet readiness plan in
docs/proposals/PHASE-PLAN-2026-05-01.md. Mainnet date will be announced
after that plan completes.
```

---

## Phase E — Devnet → mainnet migration outline (skeleton only)

> Full mainnet roadmap goes in a separate doc *after* devnet has been running
> publicly for ≥30 days. This is just the skeleton so we know what's coming.

1. All P0 blockers in `PHASE-PLAN-2026-05-01.md` closed (Session 14+ work).
2. P1A wiring complete (snap-sync, fee market, pruner, slashing monitor, bridge audit signed-off).
3. Spin up a fresh chain at `chain_id = 8989` (mainnet). Devnet keeps running at 8990.
4. Genesis snapshot from the devnet experience: which validator set, which initial allocations, which precompiles enabled.
5. Mainnet bridge to BSC mainnet (only after S11-BRIDGE-SOL-OUT1 fix + external Solidity audit pass).
6. 7-day mainnet bake with reduced ZBX value caps before lifting all caps.
7. Exchange listing conversations begin only after 30-day mainnet bake.

---

## Operational runbook quick-reference

| Task | Command |
|------|---------|
| Restart devnet node | `sudo systemctl restart zebvix-testnet` |
| Tail logs | `sudo journalctl -u zebvix-testnet -f` |
| Quick health | `sudo bash scripts/testnet-deploy.sh --status` |
| Stop & wipe state (NUKE) | `sudo systemctl stop zebvix-testnet && sudo rm -rf /root/.zebvix-testnet/db && sudo systemctl start zebvix-testnet` |
| Snapshot for backup | `sudo bash scripts/snapshot.sh /backup/zbx-devnet-$(date +%F).tar.zst` |
| Add a new validator | See Phase B step "Add the validators to the active set" |
| Rotate faucet key | `keygen` new, fund from founder, retire old |
| Pause bridge | `cast send <BridgeVault> "pause()" --rpc-url <bsc-testnet> --private-key $BSC_DEPLOYER_PRIVATE_KEY` |
| Update binary | `git pull && cargo build --release --features zvm,testnet && sudo bash scripts/testnet-deploy.sh --build-only && sudo systemctl restart zebvix-testnet` |

---

## Risk register (what can go wrong on devnet)

| Risk | Likelihood | Impact | Mitigation |
|------|:---:|:---:|---|
| Single-validator chain halts if VPS dies | High | Devnet outage | Move to Phase B (3 nodes) before public announcement |
| Faucet drained by abusers | High | Annoyance only — devnet ZBX is valueless | Per-IP + per-address rate limit; cap to ~1 ZBX / address / 24h |
| dApp dev confused by S7-EVM3 silent revert | High | Trust hit | Banner everywhere; honest `EVM_COMPATIBILITY.md` note |
| External indexer trusts tx_root and breaks | Medium | Indexer outage (their problem) | Document in launch comms; recommend they pin to our explorer |
| BSC-testnet bridge replay (S11 derivative) | Low | Devnet bridge UI breaks | Bridge to BSC TESTNET only; never mainnet |
| Operator confuses devnet with mainnet binary | Low (mitigated) | Could deploy wrong binary | Different binary names (`zebvix-node` vs `zebvix-node-testnet`), different home dirs, loud `🧪 TESTNET 🧪` banner in startup |
| Devnet chain-id collides with another chain | Low | Wallet UX confusion | 8990 is not in chainlist.org; we'll reserve it once devnet stabilises |

---

## Acceptance criteria for "devnet is launched"

A reasonable definition of done for Sessions 14-16 (or however long it takes):

1. `https://rpc-devnet.zbvix.com` returns chain_id `0x231e` from a non-VPS network
2. `eth_blockNumber` advances by ≥1 every ≤4 seconds
3. ≥3 validators in `zbx_validators` response, all marked active
4. Faucet has dispensed ≥10 fundings to at least 3 distinct external addresses
5. Explorer indexes the latest block within 10s of production
6. Status page reports green for ≥48h continuous
7. Public announcement posted in at least 1 community channel (Discord/Telegram/Twitter)
8. At least 1 external developer has deployed a hello-world ERC-20 contract via the public RPC

When all 8 are true, devnet is publicly launched. Move on to writing the
mainnet roadmap doc.

---

## Hinglish summary (for project owner)

**Kya karna hai is plan se:**

1. **Phase A** — Ek VPS pe single-validator devnet uthao. Existing scripts (`testnet-deploy.sh`) use karo. Confirm karo ki chain_id `0x231e` (8990 decimal) RPC se aata hai aur block height har ~2 second mein badh raha hai.
2. **Phase B** — Do aur VPS pe nodes spin karo (total 3). HotStuff ko 3-validator pe properly test karne ke liye. Validator-add tx governor-key se sign karke broadcast karo.
3. **Phase C** — BSC **testnet** par bridge contracts deploy karo (mainnet par MAT). Ye S11-BRIDGE-SOL-OUT1 bug ke karan zaroori hai.
4. **Phase D** — Faucet, explorer, status page, DNS, TLS sab setup karo. Phir public announcement karo with **honest disclaimers** (CALL family missing, devnet only, zero value).
5. **Phase E** — Devnet 30+ din chalne ke baad alag mainnet roadmap doc likhenge.

**Critical rules:**

- Devnet token ki value ZERO hai — clearly bolna har jagah
- Bridge sirf BSC testnet par, mainnet par kabhi nahi (jab tak audit nahi)
- Multi-contract Solidity dApps abhi nahi chalenge (single-contract OK)
- Mainnet ki announcement nahi karni jab tak `PHASE-PLAN-2026-05-01.md` ka P0 phase complete nahi hota

**Tum aaj kya kar sakte ho:**

- Phase A ke pre-flight checklist se shuru karo
- Session 13 ki script-fixes (chain-id 7878 → 8989/8990) merge karo VPS pe
- Phase A Step 1-5 chalao — single VPS pe sab kuch hota hai
- Sab green hone ke baad Phase B plan karo

Estimated time:
- Phase A: 1-2 din (pehli baar setup)
- Phase B: 2-3 din (extra VPS provision + nodes join)
- Phase C: 1 din (BSC testnet contracts)
- Phase D: 3-5 din (frontend + comms)
- **Total: 1-2 hafte for full public devnet launch**
