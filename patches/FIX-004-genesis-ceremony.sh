#!/usr/bin/env bash
# =============================================================================
# FIX-004: genesis_ceremony.sh — ZBX Chain Genesis Ceremony
# =============================================================================
#
# Gap: genesis_ceremony.sh was missing from scripts/
# Impact: HIGH — without a rehearsed, reproducible genesis ceremony script,
#         multi-party genesis (≥4 validators) cannot be safely coordinated.
#
# Purpose:
#   Coordinate a trusted multi-party genesis ceremony for ZBX Chain mainnet.
#   Each genesis validator runs this script on their own air-gapped machine.
#   The Ceremony Coordinator (CC) collects outputs and assembles genesis.json.
#
# Usage:
#   # On each validator machine (run as the validator, NOT root):
#   export ZBX_MONIKER="validator-1"
#   export ZBX_CEREMONY_DIR="$HOME/.zbx/ceremony"
#   ./scripts/genesis_ceremony.sh keygen
#
#   # Coordinator: after receiving all validator public keys:
#   ./scripts/genesis_ceremony.sh assemble \
#       --validators validators.csv \
#       --alloc alloc.csv \
#       --chain-id 8989 \
#       --out config/mainnet-genesis.json
#
#   # All validators: verify the assembled genesis
#   ./scripts/genesis_ceremony.sh verify --genesis config/mainnet-genesis.json
#
# =============================================================================

set -euo pipefail

ZBX_BIN="${ZBX_BIN:-./target/release/zbx}"
CEREMONY_DIR="${ZBX_CEREMONY_DIR:-$HOME/.zbx/ceremony}"
CHAIN_ID="${ZBX_CHAIN_ID:-8989}"
MONIKER="${ZBX_MONIKER:-validator}"
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

log()  { echo -e "${GREEN}[CEREMONY]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail() { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ── Sanity checks ──────────────────────────────────────────────────────────
check_binary() {
    [[ -x "$ZBX_BIN" ]] || fail "ZBX binary not found at $ZBX_BIN. Build with: cargo build --release"
    local ver; ver=$("$ZBX_BIN" --version 2>&1 || true)
    log "Binary: $ver"
}

check_env() {
    [[ "$(id -u)" -ne 0 ]] || warn "Running as root — ceremony keys should NOT be on a root-owned machine."
    [[ -n "${MONIKER:-}" ]] || fail "ZBX_MONIKER must be set (e.g. 'validator-1')"
}

# ── Phase 1: Key generation ────────────────────────────────────────────────
cmd_keygen() {
    check_binary; check_env
    mkdir -p "$CEREMONY_DIR"
    chmod 700 "$CEREMONY_DIR"

    log "=== Phase 1: Validator Key Generation — $MONIKER ==="
    log "Ceremony directory: $CEREMONY_DIR"
    log ""

    # 1a. Generate Ed25519 node identity key
    local node_key="$CEREMONY_DIR/${MONIKER}-node.key"
    if [[ -f "$node_key" ]]; then
        warn "Node key already exists at $node_key — skipping (delete to regenerate)"
    else
        "$ZBX_BIN" keygen --type ed25519 --out "$node_key"
        chmod 400 "$node_key"
        log "Node key: $node_key"
    fi

    # 1b. Generate BLS12-381 consensus key
    local bls_key="$CEREMONY_DIR/${MONIKER}-bls.key"
    if [[ -f "$bls_key" ]]; then
        warn "BLS key already exists at $bls_key — skipping"
    else
        "$ZBX_BIN" keygen --type bls12_381 --out "$bls_key"
        chmod 400 "$bls_key"
        log "BLS key: $bls_key"
    fi

    # 1c. Derive validator address from node key
    local addr; addr=$("$ZBX_BIN" key address --key "$node_key")
    local bls_pub; bls_pub=$("$ZBX_BIN" key pubkey --key "$bls_key")
    local node_pub; node_pub=$("$ZBX_BIN" key pubkey --key "$node_key")

    # 1d. Write public outputs file (safe to share with coordinator)
    local pub_file="$CEREMONY_DIR/${MONIKER}-public.json"
    cat > "$pub_file" <<JSON
{
  "moniker":      "$MONIKER",
  "chain_id":     $CHAIN_ID,
  "address":      "$addr",
  "node_pubkey":  "$node_pub",
  "bls_pubkey":   "$bls_pub",
  "created_at":   "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "machine":      "$(uname -srm)"
}
JSON
    log ""
    log "✓ Public info written to: $pub_file"
    log ""
    log "=== ACTION REQUIRED ==="
    log "Share ONLY $pub_file with the Ceremony Coordinator."
    log "Keep $node_key and $bls_key SECRET — never transmit them."
    log ""
    log "SHA-256 checksums (share alongside public.json for integrity):"
    sha256sum "$pub_file" "$node_key" "$bls_key" | while read -r sum file; do
        log "  $sum  $(basename "$file")"
    done
}

# ── Phase 2: Coordinator assembles genesis.json ────────────────────────────
cmd_assemble() {
    local validators_csv="" alloc_csv="" out_file="config/mainnet-genesis.json"
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --validators) validators_csv="$2"; shift 2 ;;
            --alloc)      alloc_csv="$2";      shift 2 ;;
            --chain-id)   CHAIN_ID="$2";       shift 2 ;;
            --out)        out_file="$2";        shift 2 ;;
            *) fail "Unknown option: $1" ;;
        esac
    done
    [[ -n "$validators_csv" ]] || fail "--validators <file> required"
    [[ -f "$validators_csv" ]] || fail "Validators file not found: $validators_csv"

    check_binary
    log "=== Phase 2: Genesis Assembly (Coordinator) ==="
    log "Chain ID:   $CHAIN_ID"
    log "Validators: $validators_csv"
    log "Alloc:      ${alloc_csv:-none}"
    log "Output:     $out_file"
    log ""

    # Count validators
    local n_validators; n_validators=$(grep -c '[^[:space:]]' "$validators_csv" || true)
    [[ "$n_validators" -ge 4 ]] || fail "Minimum 4 validators required for Byzantine fault tolerance. Got: $n_validators"
    log "Validators: $n_validators (BFT threshold: f < $((n_validators / 3)))"

    # Assemble via zbx genesis command
    local extra_args=()
    [[ -n "$alloc_csv" ]] && extra_args+=(--alloc "$alloc_csv")

    "$ZBX_BIN" genesis assemble \
        --chain-id "$CHAIN_ID" \
        --validators "$validators_csv" \
        --block-reward 3000000000000000000 \
        --halving-interval 25000000 \
        --block-time-ms 5000 \
        --min-stake 100000000000000000000 \
        "${extra_args[@]}" \
        --out "$out_file"

    local genesis_hash; genesis_hash=$(sha256sum "$out_file" | awk '{print $1}')
    log ""
    log "✓ Genesis assembled: $out_file"
    log ""
    log "=== BROADCAST TO ALL VALIDATORS ==="
    log "genesis.json SHA-256: $genesis_hash"
    log "Each validator must verify this hash before starting their node."
}

# ── Phase 3: Validator verification ───────────────────────────────────────
cmd_verify() {
    local genesis_file=""
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --genesis) genesis_file="$2"; shift 2 ;;
            *) fail "Unknown option: $1" ;;
        esac
    done
    [[ -n "$genesis_file" ]] || fail "--genesis <file> required"
    [[ -f "$genesis_file" ]] || fail "Genesis file not found: $genesis_file"

    check_binary
    log "=== Phase 3: Genesis Verification — $MONIKER ==="

    # 3a. Structural validation
    "$ZBX_BIN" genesis verify --genesis "$genesis_file" \
        || fail "Genesis file failed structural validation"
    log "✓ Structural validation passed"

    # 3b. Chain ID check
    local file_chain_id; file_chain_id=$(python3 -c "import json; print(json.load(open('$genesis_file'))['chain_id'])")
    [[ "$file_chain_id" == "$CHAIN_ID" ]] \
        || fail "Chain ID mismatch: expected $CHAIN_ID, got $file_chain_id"
    log "✓ Chain ID = $file_chain_id"

    # 3c. Validator count
    local n_val; n_val=$(python3 -c "import json; print(len(json.load(open('$genesis_file')).get('validators', [])))")
    [[ "$n_val" -ge 4 ]] || fail "Too few validators in genesis: $n_val (min 4)"
    log "✓ Validators: $n_val"

    # 3d. Supply check — genesis allocations must not exceed cap
    local total_alloc; total_alloc=$(python3 -c "
import json; g=json.load(open('$genesis_file'))
total = sum(int(a['amount']) for a in g.get('alloc', []))
print(total)
")
    local cap=150000000000000000000000000  # 150M ZBX in wei
    python3 -c "assert $total_alloc <= $cap, f'Over-allocated: {$total_alloc} > {$cap}'" \
        || fail "Genesis allocation exceeds 150M ZBX cap"
    log "✓ Supply within cap ($(python3 -c "print($total_alloc / 1e18:.2f)") ZBX allocated)"

    # 3e. Compute and display genesis hash for cross-check with coordinator
    local hash; hash=$(sha256sum "$genesis_file" | awk '{print $1}')
    log ""
    log "=== VERIFY THIS HASH WITH THE COORDINATOR ==="
    log "genesis.json SHA-256: $hash"
    log ""
    log "If hash matches, you are safe to start your node."
    log "If it does NOT match — DO NOT START — contact the coordinator immediately."
}

# ── Dispatch ──────────────────────────────────────────────────────────────
main() {
    local cmd="${1:-help}"
    shift || true
    case "$cmd" in
        keygen)   cmd_keygen "$@" ;;
        assemble) cmd_assemble "$@" ;;
        verify)   cmd_verify "$@" ;;
        help|--help|-h)
            echo "Usage: $0 {keygen|assemble|verify} [options]"
            echo "  keygen             Generate validator keys (run on each validator machine)"
            echo "  assemble           Assemble genesis.json from validator public keys (coordinator)"
            echo "  verify --genesis F Verify genesis.json hash and structure (all validators)"
            ;;
        *) fail "Unknown command: $cmd. Run '$0 help' for usage." ;;
    esac
}

main "$@"
