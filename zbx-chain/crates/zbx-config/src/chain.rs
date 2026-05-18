//! Chain-level constants and parameters.

use serde::{Deserialize, Serialize};

// Chain IDs are the single source of truth in `zbx-types`. Re-exported here for
// backward compatibility — new code should import directly from `zbx_types`.
pub use zbx_types::{CHAIN_ID_MAINNET, CHAIN_ID_TESTNET};

pub const ZBX_BLOCK_TIME:     u64 = 5;
pub const ZBX_GAS_LIMIT:      u64 = 30_000_000;
pub const ZBX_BASE_FEE_GWEI:  u64 = 1_000_000_000;
pub const ZBX_MAX_VALIDATORS: u32 = 100;
pub const ZBX_EPOCH_LENGTH:   u64 = 300;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainConfig {
    pub chain_id:             u64,
    pub name:                 String,
    pub symbol:               String,
    pub decimals:             u8,
    pub block_time_secs:      u64,
    pub gas_limit:            u64,
    pub initial_base_fee:     u64,
    pub max_validators:       u32,
    pub epoch_length:         u64,
    pub halving_interval:     u64,
    pub initial_block_reward: u64,
}

impl Default for ChainConfig {
    fn default() -> Self {
        Self {
            chain_id: CHAIN_ID_MAINNET, name: "Zebvix Chain".into(), symbol: "ZBX".into(),
            decimals: 18, block_time_secs: ZBX_BLOCK_TIME, gas_limit: ZBX_GAS_LIMIT,
            initial_base_fee: ZBX_BASE_FEE_GWEI, max_validators: ZBX_MAX_VALIDATORS,
            epoch_length: ZBX_EPOCH_LENGTH, halving_interval: 25_000_000,
            initial_block_reward: 3_000_000_000_000_000_000,
        }
    }
}

impl ChainConfig {
    pub fn mainnet()  -> Self { Self::default() }

    /// Public testnet AND devnet share `chain_id = 8990` (locked-in 2026-05-01).
    /// Operational isolation between devnet and public testnet is via
    /// bootstrap peers + validator key set, NOT chain-ID separation.
    /// `Self::devnet()` is intentionally absent — use `testnet()` for both.
    pub fn testnet()  -> Self { Self { chain_id: CHAIN_ID_TESTNET, name: "Zebvix Testnet".into(), ..Self::default() } }
}