# FIX-005: Validator Onboarding Guide (Complete)

**Gap:** docs/VALIDATOR-GUIDE.md was partial — missing key sections on BLS
key management, slashing protection, monitoring, and upgrade procedures.

**File:** `docs/VALIDATOR-GUIDE.md` (replace existing partial file)

---

# ZBX Chain Validator Guide

**Version:** v0.2.1 | **Chain ID:** 8989 (mainnet) / 8990 (testnet)  
**Last updated:** 2026-05-09

---

## Prerequisites

| Requirement | Minimum | Recommended |
|---|---|---|
| CPU | 4 cores (x86_64) | 8+ cores |
| RAM | 16 GB | 32 GB |
| Disk | 500 GB NVMe SSD | 2 TB NVMe SSD |
| Network | 100 Mbps stable | 1 Gbps |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| Stake | 100 ZBX (self-stake) | 10,000+ ZBX |

---

## Phase 1 — Build the Node Binary

```bash
# Install system dependencies
sudo apt-get update && sudo apt-get install -y \
    build-essential clang pkg-config \
    libssl-dev librocksdb-dev protobuf-compiler

# Install Rust (stable toolchain)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
rustup toolchain install stable
rustup default stable

# Clone and build
git clone https://github.com/servicefree310-ctrl/Chain-Dashboard.git zbx-chain
cd zbx-chain/zbx-chain-source/zbx-chain
cargo build --release 2>&1 | tail -5

# Verify
./target/release/zbx --version
sudo cp target/release/zbx /usr/local/bin/zbx
```

---

## Phase 2 — Key Generation (AIR-GAPPED MACHINE RECOMMENDED)

> ⚠️ **SECURITY**: Generate keys on an air-gapped machine or hardware security
> module (HSM). Never expose private keys to internet-connected systems.

```bash
# Create secure directory
mkdir -p ~/.zbx/keys && chmod 700 ~/.zbx/keys

# 1. Node identity key (Ed25519) — used for P2P networking
zbx keygen --type ed25519 --out ~/.zbx/keys/node.key
chmod 400 ~/.zbx/keys/node.key

# 2. BLS12-381 consensus key — used for block signing & voting
zbx keygen --type bls12_381 --out ~/.zbx/keys/bls.key
chmod 400 ~/.zbx/keys/bls.key

# 3. Derive your validator address
zbx key address --key ~/.zbx/keys/node.key
# → 0xYOUR_VALIDATOR_ADDRESS

# 4. Export BLS public key (share this for registration)
zbx key pubkey --key ~/.zbx/keys/bls.key
# → 0xYOUR_BLS_PUBKEY_HEX
```

### Key Backup Protocol

```bash
# Encrypt backup with AES-256-GCM
tar czf - ~/.zbx/keys/ | \
  openssl enc -aes-256-gcm -pbkdf2 -iter 100000 \
  -out ~/.zbx/keys-backup-$(date +%Y%m%d).enc

# Verify backup integrity
openssl enc -d -aes-256-gcm -pbkdf2 -iter 100000 \
  -in ~/.zbx/keys-backup-*.enc | tar tzf -
```

Store encrypted backup on ≥2 physically separate USB drives in different locations.

---

## Phase 3 — Node Configuration

```bash
mkdir -p ~/.zbx/data

cat > ~/.zbx/config.toml <<'TOML'
[node]
moniker    = "my-validator-name"   # human-readable label
data_dir   = "/home/zbx/.zbx/data"
log_level  = "info"

[chain]
chain_id       = 8989
genesis_file   = "/home/zbx/.zbx/mainnet-genesis.json"
block_time_ms  = 5000
max_block_gas  = 30_000_000

[keys]
node_key      = "/home/zbx/.zbx/keys/node.key"
bls_key       = "/home/zbx/.zbx/keys/bls.key"

[network]
listen_addr    = "0.0.0.0:30333"
external_addr  = "YOUR_PUBLIC_IP:30333"   # ← set your VPS public IP
max_peers      = 50
bootstrap_peers = [
    "/ip4/bootstrap1.zbx.network/tcp/30333/p2p/12D3KooW...",
    "/ip4/bootstrap2.zbx.network/tcp/30333/p2p/12D3KooW...",
]

[rpc]
http_listen  = "127.0.0.1:8545"    # NEVER expose 8545 publicly
ws_listen    = "127.0.0.1:8546"
cors_origins = []

[metrics]
listen = "127.0.0.1:9001"          # Prometheus scrape endpoint

[consensus]
validator_mode = true
coinbase       = "0xYOUR_VALIDATOR_ADDRESS"

[storage]
pruning_mode = "archive"    # or "fast" for non-archive validators
TOML
```

---

## Phase 4 — Sync & Stake

```bash
# Start node in sync mode (no block production until synced)
zbx start \
  --config ~/.zbx/config.toml \
  --genesis ~/.zbx/mainnet-genesis.json \
  --sync-only

# Monitor sync progress
curl -s http://127.0.0.1:8545 \
  -d '{"jsonrpc":"2.0","id":1,"method":"zbx_syncStatus","params":[]}' \
  | python3 -m json.tool

# Once synced: register validator stake (requires 100 ZBX minimum)
zbx tx stake register \
  --from-key ~/.zbx/keys/node.key \
  --bls-pubkey $(zbx key pubkey --key ~/.zbx/keys/bls.key) \
  --amount 100000000000000000000 \
  --rpc http://127.0.0.1:8545
```

---

## Phase 5 — Run as a Systemd Service

```bash
sudo useradd -r -s /bin/false -d /home/zbx zbx
sudo mkdir -p /home/zbx/.zbx && sudo chown -R zbx:zbx /home/zbx

sudo tee /etc/systemd/system/zbx-validator.service <<'EOF'
[Unit]
Description=ZBX Chain Validator Node
After=network-online.target
Wants=network-online.target

[Service]
User=zbx
Group=zbx
ExecStart=/usr/local/bin/zbx start \
    --config /home/zbx/.zbx/config.toml \
    --genesis /home/zbx/.zbx/mainnet-genesis.json
Restart=on-failure
RestartSec=5s
LimitNOFILE=65536
StandardOutput=journal
StandardError=journal
SyslogIdentifier=zbx-validator

# Security hardening
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ReadWritePaths=/home/zbx/.zbx

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable zbx-validator
sudo systemctl start zbx-validator
sudo journalctl -u zbx-validator -f
```

---

## Phase 6 — Monitoring & Slashing Protection

### Prometheus + Grafana Setup

```bash
# Scrape config (add to prometheus.yml)
scrape_configs:
  - job_name: zbx-validator
    static_configs:
      - targets: ['localhost:9001']
    relabel_configs:
      - source_labels: [__address__]
        target_label: instance
        replacement: "my-validator"
```

### Critical Alerts

```yaml
# alertmanager rules for validators
groups:
  - name: zbx-validator
    rules:
      - alert: ValidatorMissedBlocks
        expr: zbx_blocks_missed_total > 100
        for: 5m
        annotations:
          summary: "Validator missed >100 consecutive blocks — slashing risk"

      - alert: ValidatorLowPeers
        expr: zbx_p2p_peer_count < 3
        for: 2m
        annotations:
          summary: "Fewer than 3 peers — network isolation risk"

      - alert: ValidatorJailed
        expr: zbx_validator_jailed == 1
        annotations:
          summary: "Validator is JAILED — immediate action required"

      - alert: DiskSpaceLow
        expr: node_filesystem_avail_bytes{mountpoint="/"} < 50_000_000_000
        annotations:
          summary: "Less than 50GB disk — archive node may halt"
```

### Double-Sign Protection

**Never run two validator instances with the same BLS key simultaneously.**

```bash
# Use the slashing protection database
zbx validator slash-protection \
  --db ~/.zbx/slash-protection.db \
  --export slash-protection-backup.json

# Before starting on new machine: import existing protection records
zbx validator slash-protection \
  --db ~/.zbx/slash-protection.db \
  --import slash-protection-backup.json
```

---

## Upgrade Procedure

```bash
# 1. Download new binary (verify checksum first)
wget https://releases.zbx.network/v0.X.Y/zbx-linux-amd64
sha256sum zbx-linux-amd64   # verify against published checksum

# 2. Stop validator gracefully (allows block production to finish)
sudo systemctl stop zbx-validator
sleep 10  # wait for clean shutdown

# 3. Replace binary
sudo cp zbx-linux-amd64 /usr/local/bin/zbx
sudo chmod +x /usr/local/bin/zbx
zbx --version

# 4. Check for migration requirements
zbx migrate --config ~/.zbx/config.toml --dry-run

# 5. Restart
sudo systemctl start zbx-validator
sudo journalctl -u zbx-validator -f
```

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `Error: insufficient stake` | Balance < 100 ZBX | Fund validator address |
| `Error: peer count = 0` | Firewall blocking 30333 | `ufw allow 30333/tcp` |
| `Error: genesis hash mismatch` | Wrong genesis.json | Re-download from coordinator |
| Validator jailed | Missed >500 blocks | Unjail: `zbx tx stake unjail --from-key ...` |
| `Error: BLS key file permission denied` | Wrong file permissions | `chmod 400 ~/.zbx/keys/bls.key` |
| High memory usage | Archive pruning disabled | Set `pruning_mode = "fast"` |

---

## Security Checklist

- [ ] Keys generated on air-gapped machine
- [ ] Private keys have mode 400 (`chmod 400 *.key`)
- [ ] RPC port 8545 NOT exposed publicly (`ufw deny 8545`)
- [ ] Prometheus port 9001 NOT exposed publicly
- [ ] SSH key-only login (password auth disabled)
- [ ] Firewall configured (ufw / iptables)
- [ ] Backup encrypted and stored off-machine
- [ ] Slashing protection database exported before any migration
- [ ] Double-signing prevention: only ONE validator instance running
- [ ] Node software version matches team announcement before each upgrade
