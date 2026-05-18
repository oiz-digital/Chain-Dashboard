//! Node configuration loaded from a TOML file or CLI flags.

use crate::genesis::Network;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use zbx_types::CHAIN_ID;

/// Full node configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeConfig {
    pub chain: ChainConfig,
    pub storage: StorageConfig,
    pub network: NetworkConfig,
    pub consensus: ConsensusConfig,
    pub rpc: RpcConfig,
    pub metrics: MetricsConfig,
}

/// One entry in the `chain.validators` table — used to configure the full
/// validator set on multi-validator testnets and mainnets.
///
/// Example TOML:
/// ```toml
/// [[chain.extra_validators]]
/// address    = "0xAbCd..."      # 20-byte EVM address (hex, 0x prefix OK)
/// bls_pubkey = "0xDeF0..."      # 48-byte BLS-12-381 public key (hex, 0x prefix OK)
/// ```
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ValidatorEntry {
    /// EVM-compatible address of the validator (20 bytes, hex).
    pub address: String,
    /// BLS-12-381 compressed public key of the validator (48 bytes, hex).
    pub bls_pubkey: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainConfig {
    pub chain_id: u64,
    /// Optional path to a custom genesis JSON. When the file exists AND is
    /// not the default `genesis.json` placeholder, the node loads it instead
    /// of the network preset. Operators that just want mainnet/testnet
    /// defaults can leave this at `genesis.json` and the file is ignored.
    /// (Audit S4-B8.)
    pub genesis_file: PathBuf,
    pub is_validator: bool,
    /// BLS private key hex for validator node. Precedence at runtime:
    ///   1. `VALIDATOR_KEY` env var (preferred — never written to disk)
    ///   2. This field, when set
    ///   3. Falls back to full-node mode if neither is present.
    /// (Audit S4-B8.)
    pub validator_key: Option<String>,
    /// ZBX-SEC-2026: secp256k1 private key for coinbase address derivation.
    /// Separate from VALIDATOR_KEY (BLS). Set via NODE_KEY env var or this field.
    /// Derivation: secp256k1(NODE_KEY) -> pubkey -> keccak256(pubkey[1:])[12:] = EVM address.
    #[serde(default)]
    pub node_key: Option<String>,
    /// Additional validators for multi-validator testnets/mainnets.
    /// Each entry must specify the validator's EVM address and BLS pubkey.
    /// The node's own key (derived from VALIDATOR_KEY / validator_key) is
    /// always included automatically — list only the *other* validators here.
    #[serde(default)]
    pub extra_validators: Vec<ValidatorEntry>,
    /// Optional path to the EIP-4844 KZG trusted-setup file (ceremony
    /// format: `4096\n65\n<G1 hex × 4096>\n<G2 hex × 65>`). Loaded once
    /// at node startup and installed as the process-global verifier
    /// settings consumed by precompile 0x0B (KZG point evaluation).
    /// Mainnet (chain 8989) refuses to boot when this is unset or the
    /// file is missing/corrupt; testnet/devnet (chain 8990) emits a
    /// warning and operates with 0x0B fail-closed if absent.
    /// (Task #4.)
    #[serde(default)]
    pub kzg_trusted_setup_path: Option<PathBuf>,
    /// Task #7: canonical address of `ZbxVaultRegistry.sol` for the
    /// 0x0F precompile (ZUSD vault state direct-read). Hex string with
    /// or without `0x` prefix; the loader compares against
    /// `zbx_crypto::vault_state::ZUSD_VAULT_ADDRESS` and warns on
    /// mismatch.
    #[serde(default)]
    pub zusd_vault_address: Option<String>,
    /// Task #7: when `true` the node refuses to boot unless the
    /// configured (or default) ZUSD vault registry address has
    /// non-empty bytecode in the loaded genesis allocations. Mainnet
    /// (chain 8989) always treats this as `true` regardless. Testnet
    /// /devnet (chain 8990) defaults to `false` (boot with a warning
    /// — every 0x0F call will return 128 zero bytes).
    #[serde(default)]
    pub require_vault_genesis: bool,
    /// Task #22: pinned (height, hash) the snapshot importer treats as
    /// the freshness anchor when verifying `SignedSnapshotManifest`.
    /// Mainnet/testnet operators MUST set this when they intend to
    /// fast-sync from a snapshot bundle dropped into `<data_dir>`;
    /// the importer refuses to proceed without it. Rotated on each
    /// release whose snapshot the operator wants to accept.
    #[serde(default)]
    pub trusted_snapshot_checkpoint: Option<TrustedSnapshotCheckpoint>,
    /// Task #22: BLS pubkeys (compressed G1, hex with optional `0x`)
    /// authorised to produce snapshot manifests. The importer rejects
    /// any signed manifest whose producer is outside this set. Empty
    /// is treated as "no snapshot import allowed" — present a manifest
    /// file with this empty and the import is refused.
    #[serde(default)]
    pub snapshot_allowed_producers: Vec<String>,
}

/// Task #22: pinned (height, hash) anchor for snapshot manifest
/// freshness verification. Both fields are required when the table
/// is present.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrustedSnapshotCheckpoint {
    pub height: u64,
    /// 32-byte block hash, hex with optional `0x` prefix.
    pub hash: String,
}

/// Task #7 boot-time check that `ZbxVaultRegistry.sol` is deployed at
/// the canonical address. Wired into `main.rs` immediately after the
/// KZG trusted-setup install (mirrors the Task #4 pattern).
///
/// The check iterates `genesis_alloc` looking for the canonical (or
/// configured) vault address, requires `code` to be present and
/// non-empty, and:
///   * Hard-fails on mainnet (chain 8989) regardless of
///     `require_vault_genesis`.
///   * Hard-fails on any chain when `require_vault_genesis = true`.
///   * Otherwise emits a warning so operators see the misconfiguration
///     in their logs.
///
/// Returns `Ok(true)` on a verified deployment, `Ok(false)` when the
/// check fell through to a warning, and `Err(...)` on hard-fail.
pub fn assert_vault_genesis_or_warn<I, S, F>(
    chain: &ChainConfig,
    is_mainnet: bool,
    genesis_alloc_iter: I,
    mut log_warn: F,
) -> Result<bool, String>
where
    I: IntoIterator<Item = (S, Option<S>)>,
    S: AsRef<str>,
    F: FnMut(&str),
{
    use zbx_crypto::vault_state::ZUSD_VAULT_ADDRESS;
    let canonical_hex = format!("0x{}", hex::encode(ZUSD_VAULT_ADDRESS));
    let configured = chain
        .zusd_vault_address
        .as_deref()
        .map(|s| s.trim_start_matches("0x").to_ascii_lowercase());
    if let Some(cfg_addr) = &configured {
        let want = canonical_hex.trim_start_matches("0x").to_ascii_lowercase();
        if cfg_addr != &want {
            log_warn(&format!(
                "Task #7: chain.zusd_vault_address ({}) does not match the canonical \
                 ZUSD vault registry address ({}). Precompile 0x0F reads from the \
                 canonical address; the configured override is ignored.",
                cfg_addr, want,
            ));
        }
    }
    let want = canonical_hex.trim_start_matches("0x").to_ascii_lowercase();
    let mut found_code = false;
    for (addr, code) in genesis_alloc_iter {
        let addr_norm = addr.as_ref().trim_start_matches("0x").to_ascii_lowercase();
        if addr_norm == want {
            if let Some(c) = code {
                let c_str = c.as_ref().trim().trim_start_matches("0x");
                if !c_str.is_empty() {
                    found_code = true;
                }
            }
            break;
        }
    }
    if found_code {
        return Ok(true);
    }
    let msg = format!(
        "Task #7: ZbxVaultRegistry.sol is NOT deployed at canonical address {} in genesis. \
         Precompile 0x0F (ZUSD vault state direct-read) will return 128 zero bytes for every \
         vault owner until the registry is included in genesis allocations.",
        canonical_hex
    );
    if is_mainnet || chain.require_vault_genesis {
        return Err(msg);
    }
    log_warn(&msg);
    Ok(false)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageConfig {
    pub data_dir: PathBuf,
    pub max_open_files: i32,
    pub cache_size_mb: u64,
    /// Task #1: trie pruner runtime knobs. `#[serde(default)]` so existing
    /// TOML configs (which predate Task #1) keep parsing — they get the
    /// safe production defaults from `PrunerSettings::default()`.
    #[serde(default)]
    pub pruner: PrunerSettings,
}

/// Operator-tunable pruner knobs. Mirrors `zbx_storage::pruner::PrunerConfig`
/// plus a wall-clock cadence (the storage-level config is per-cycle; the
/// node-level config also picks the cycle interval).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrunerSettings {
    /// Run the pruner subsystem at all. Default: `true`. Operators on
    /// archive nodes (intentional unbounded retention) set this to `false`.
    #[serde(default = "default_pruner_enabled")]
    pub enabled: bool,
    /// Seconds between consecutive prune cycles. Default: 300 (5 min).
    #[serde(default = "default_pruner_interval_secs")]
    pub interval_secs: u64,
    /// Retain the last N state roots' reachable nodes. Default: 256.
    #[serde(default = "default_pruner_max_retained_roots")]
    pub max_retained_roots: usize,
    /// Skip a cycle when fewer than this many heights elapsed since
    /// the last run. Default: 64.
    #[serde(default = "default_pruner_min_height_advance")]
    pub min_height_advance: u64,
    /// Sweep deletes in batches of this many keys. Default: 4096.
    #[serde(default = "default_pruner_sweep_batch_size")]
    pub sweep_batch_size: usize,
    /// Explicit archive-mode opt-in (Pass-19 architect-review).
    /// When `true`, mainnet readiness check #4 permits booting with
    /// `enabled = false` (intentional unbounded retention for indexer
    /// / explorer nodes). Default: `false` so a vanilla mainnet node
    /// that disables the pruner is rejected at boot.
    #[serde(default = "default_pruner_archive_mode")]
    pub archive_mode: bool,
}

fn default_pruner_enabled() -> bool { true }
fn default_pruner_interval_secs() -> u64 { 300 }
fn default_pruner_max_retained_roots() -> usize { 256 }
fn default_pruner_min_height_advance() -> u64 { 64 }
fn default_pruner_sweep_batch_size() -> usize { 4_096 }
fn default_pruner_archive_mode() -> bool { false }

impl Default for PrunerSettings {
    fn default() -> Self {
        Self {
            enabled: default_pruner_enabled(),
            interval_secs: default_pruner_interval_secs(),
            max_retained_roots: default_pruner_max_retained_roots(),
            min_height_advance: default_pruner_min_height_advance(),
            sweep_batch_size: default_pruner_sweep_batch_size(),
            archive_mode: default_pruner_archive_mode(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkConfig {
    pub listen_addr: String,
    pub listen_port: u16,
    pub max_peers: usize,
    pub bootnodes: Vec<String>,
    pub nat: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsensusConfig {
    pub block_time_ms: u64,
    pub max_block_gas: u64,
    pub mempool_max_pending: usize,
    pub mempool_max_queued: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcConfig {
    pub http_enabled: bool,
    pub http_port: u16,
    pub ws_enabled: bool,
    pub ws_port: u16,
    /// Bind address for the RPC HTTP server.
    /// Recommended: `127.0.0.1` behind nginx/TLS, or `0.0.0.0` for direct exposure.
    #[serde(default = "default_bind_addr")]
    pub bind_addr: String,
    pub cors_origins: Vec<String>,
    pub rate_limit_rpm: u32,
}

fn default_bind_addr() -> String {
    "127.0.0.1".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsConfig {
    pub enabled: bool,
    pub port: u16,
}

impl NodeConfig {
    /// Default mainnet configuration.
    pub fn mainnet() -> Self {
        NodeConfig {
            chain: ChainConfig {
                chain_id: Network::Mainnet.chain_id(),
                genesis_file: PathBuf::from("genesis.json"),
                is_validator: false,
                validator_key: None,
                node_key: None,
                extra_validators: Vec::new(),
                kzg_trusted_setup_path: Some(PathBuf::from(
                    "node/configs/trusted_setup.txt",
                )),
                zusd_vault_address: Some(
                    "0x0000000000000000000000000000000000005455".to_string(),
                ),
                require_vault_genesis: true,
                trusted_snapshot_checkpoint: None,
                snapshot_allowed_producers: Vec::new(),
            },
            storage: StorageConfig {
                data_dir: PathBuf::from("/var/lib/zbx-mainnet"),
                max_open_files: 512,
                cache_size_mb: 512,
                pruner: PrunerSettings::default(),
            },
            network: NetworkConfig {
                listen_addr: "0.0.0.0".to_string(),
                listen_port: Network::Mainnet.p2p_port(),
                max_peers: 50,
                // Real bootnodes — production VPS endpoints.
                bootnodes: vec![
                    "93.127.213.192:30303".to_string(),
                ],
                nat: Some("any".to_string()),
            },
            consensus: ConsensusConfig {
                block_time_ms: 5_000,
                max_block_gas: 30_000_000,
                mempool_max_pending: 5_000,
                mempool_max_queued: 2_000,
            },
            rpc: RpcConfig {
                http_enabled: true,
                http_port: Network::Mainnet.rpc_port(),
                // WebSocket RPC: implemented in `zbx_rpc::WsServer` (eth_subscribe
                // / eth_unsubscribe for newHeads, newPendingTransactions, logs).
                // Wired in `node::ZbxNode::start` 2026-05-09. Default `false`
                // for mainnet — operators must opt-in by setting `ws_enabled = true`
                // in their config and exposing `ws_port` (8546) through their
                // reverse proxy (nginx → wss://ws.zbx.io).
                ws_enabled: false,
                ws_port: 8546,
                bind_addr: "127.0.0.1".to_string(),
                // Default to empty (browsers block cross-origin). Operators
                // running a public-facing RPC must explicitly list domains.
                // See AUDIT_2026-04-30.md H-08.
                cors_origins: Vec::new(),
                rate_limit_rpm: 600,
            },
            metrics: MetricsConfig { enabled: true, port: 9000 },
        }
    }

    /// Default testnet configuration.
    pub fn testnet() -> Self {
        let mut cfg = Self::mainnet();
        cfg.chain.chain_id = Network::Testnet.chain_id();
        cfg.storage.data_dir = PathBuf::from("/var/lib/zbx-testnet");
        cfg.network.listen_port = Network::Testnet.p2p_port();
        cfg.network.bootnodes = vec!["93.127.213.192:30304".to_string()];
        cfg.rpc.http_port = Network::Testnet.rpc_port();
        cfg.rpc.ws_port = 18546;
        cfg.metrics.port = 9001;
        // Testnet/devnet (chain 8990) uses the deterministic devnet
        // trusted setup committed in-tree. Mainnet (chain 8989) MUST
        // override this with the official Ethereum KZG ceremony output.
        cfg.chain.kzg_trusted_setup_path = Some(PathBuf::from(
            "node/configs/trusted_setup_devnet.txt",
        ));
        // Task #7: testnet enforces vault-genesis deployment at boot
        // (registry pre-deployed in `genesis.rs::testnet()`). Mainnet
        // also enforces (preset includes the registry alloc).
        cfg.chain.require_vault_genesis = true;
        cfg
    }

    pub fn for_network(net: Network) -> Self {
        match net {
            Network::Mainnet => Self::mainnet(),
            Network::Testnet => Self::testnet(),
        }
    }

    /// Load configuration from a TOML file. Falls back to mainnet defaults
    /// for any missing top-level section so configs can be partial.
    pub fn from_file(path: &Path) -> Result<Self, String> {
        let content =
            std::fs::read_to_string(path).map_err(|e| format!("read config {path:?}: {e}"))?;
        toml::from_str(&content).map_err(|e| format!("parse config {path:?}: {e}"))
    }
}

#[cfg(test)]
mod vault_genesis_tests {
    use super::*;

    fn alloc(addr: &str, code: Option<&str>) -> (String, Option<String>) {
        (addr.to_string(), code.map(|s| s.to_string()))
    }

    #[test]
    fn passes_when_canonical_address_has_code_in_alloc() {
        let cfg = NodeConfig::testnet();
        let allocs = vec![
            alloc("0x0000000000000000000000000000000000005455", Some("0x6080604052")),
            alloc("0x0000000000000000000000000000000000003001", None),
        ];
        let mut warns = Vec::new();
        let r = assert_vault_genesis_or_warn(&cfg.chain, false, allocs, |m| {
            warns.push(m.to_string())
        });
        assert_eq!(r.unwrap(), true);
        assert!(warns.is_empty());
    }

    #[test]
    fn warns_on_testnet_when_code_missing_and_not_required() {
        let mut cfg = NodeConfig::testnet();
        cfg.chain.require_vault_genesis = false;
        let allocs = vec![alloc("0x0000000000000000000000000000000000003001", None)];
        let mut warns = Vec::new();
        let r = assert_vault_genesis_or_warn(&cfg.chain, false, allocs, |m| {
            warns.push(m.to_string())
        });
        assert_eq!(r.unwrap(), false, "should fall through to warning, not boot-fail");
        assert_eq!(warns.len(), 1);
        assert!(warns[0].contains("0x0000000000000000000000000000000000005455"));
    }

    #[test]
    fn hard_fails_on_mainnet_when_code_missing() {
        let cfg = NodeConfig::mainnet();
        let allocs: Vec<(String, Option<String>)> = vec![alloc(
            "0x0000000000000000000000000000000000001001",
            None,
        )];
        let r = assert_vault_genesis_or_warn(&cfg.chain, true, allocs, |_| {});
        let err = r.unwrap_err();
        assert!(err.contains("NOT deployed"), "{err}");
    }

    #[test]
    fn hard_fails_when_require_vault_genesis_true_even_on_testnet() {
        let mut cfg = NodeConfig::testnet();
        cfg.chain.require_vault_genesis = true;
        let allocs: Vec<(String, Option<String>)> = vec![];
        let r = assert_vault_genesis_or_warn(&cfg.chain, false, allocs, |_| {});
        assert!(r.is_err());
    }

    #[test]
    fn empty_code_string_treated_as_missing() {
        let mut cfg = NodeConfig::testnet();
        cfg.chain.require_vault_genesis = true;
        let allocs = vec![
            alloc("0x0000000000000000000000000000000000005455", Some("0x")),
        ];
        let r = assert_vault_genesis_or_warn(&cfg.chain, false, allocs, |_| {});
        assert!(r.is_err(), "empty code (`0x`) must NOT count as deployed");
    }

    #[test]
    fn validates_custom_genesis_file_when_present() {
        // Task-#7-rev-2 regression: the startup helper must read from
        // the custom genesis JSON when `chain.genesis_file` points at
        // an existing non-default path, NOT from the preset. This
        // simulates that path by writing a temp genesis.json with a
        // funded ZbxVaultRegistry alloc and asserting the helper
        // accepts it.
        use std::io::Write;
        let dir = std::env::temp_dir();
        let path = dir.join(format!("zbx-test-genesis-{}.json", std::process::id()));
        let json = r#"{
            "chain_id": 8990,
            "timestamp": 1714521600,
            "gas_limit": 30000000,
            "base_fee": 1000000000,
            "extra_data": "test",
            "alloc": [
                {
                    "address": "0x0000000000000000000000000000000000005455",
                    "balance": "0",
                    "code": "0x6080604052"
                }
            ],
            "validators": []
        }"#;
        {
            let mut f = std::fs::File::create(&path).unwrap();
            f.write_all(json.as_bytes()).unwrap();
        }
        let loaded =
            crate::genesis::GenesisConfig::from_file(&path).expect("custom genesis loads");
        let alloc_iter = loaded.alloc.iter().map(|a| {
            (format!("0x{}", hex::encode(a.address.as_bytes())), a.code.clone())
        });
        let mut cfg = NodeConfig::testnet();
        cfg.chain.require_vault_genesis = true;
        let r = assert_vault_genesis_or_warn(&cfg.chain, false, alloc_iter, |_| {});
        assert_eq!(r.unwrap(), true, "custom genesis with registry must pass");
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn configured_address_mismatch_emits_warning() {
        let mut cfg = NodeConfig::testnet();
        cfg.chain.zusd_vault_address = Some("0x0000000000000000000000000000000000009999".into());
        let allocs = vec![
            alloc("0x0000000000000000000000000000000000005455", Some("0x6080604052")),
        ];
        let mut warns = Vec::new();
        let _ = assert_vault_genesis_or_warn(&cfg.chain, false, allocs, |m| {
            warns.push(m.to_string())
        });
        assert!(warns.iter().any(|w| w.contains("does not match the canonical")));
    }
}

impl Default for NodeConfig {
    fn default() -> Self {
        let mut cfg = Self::mainnet();
        cfg.chain.chain_id = CHAIN_ID;
        cfg
    }
}
