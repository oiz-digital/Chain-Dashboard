//! Bundle relay: submits bundles to the EntryPoint on-chain.

use crate::{bundle::Bundle, error::BundlerError};
use tracing::{error, info, warn};

pub struct BundleRelay {
    rpc_url: String,
    bundler_key: String,
    entry_point: String,
    chain_id: u64,
}

impl BundleRelay {
    pub fn new(rpc_url: impl Into<String>, bundler_key: impl Into<String>, chain_id: u64) -> Self {
        BundleRelay {
            rpc_url: rpc_url.into(),
            bundler_key: bundler_key.into(),
            entry_point: crate::ENTRY_POINT_ADDRESS.to_string(),
            chain_id,
        }
    }

    /// Submit a bundle to the EntryPoint contract.
    /// Returns the transaction hash on success.
    pub async fn submit(&self, bundle: &Bundle) -> Result<[u8; 32], BundlerError> {
        if bundle.ops.is_empty() {
            return Err(BundlerError::EmptyBundle);
        }

        info!(
            ops = bundle.ops.len(),
            gas = bundle.estimated_gas,
            beneficiary = %bundle.beneficiary,
            "submitting bundle"
        );

        // In production:
        // 1. Build handleOps transaction signed with bundler_key
        // 2. eth_sendRawTransaction to rpc_url
        // 3. Wait for receipt (or use eth_sendBundle for MEV protection)
        // 4. Parse EntryPoint events for UserOperationEvent / UserOperationRevertReason

        // Mock: return deterministic hash
        use sha2::{Digest, Sha256};
        let mut h = Sha256::new();
        h.update(bundle.ops.len().to_le_bytes());
        h.update(self.chain_id.to_le_bytes());
        let mut hash = [0u8; 32];
        hash.copy_from_slice(&h.finalize());
        Ok(hash)
    }

    /// Monitor a submitted bundle transaction for confirmation.
    pub async fn wait_for_inclusion(&self, tx_hash: [u8; 32]) -> Result<u64, BundlerError> {
        info!(tx = hex::encode(tx_hash), "waiting for bundle inclusion");
        // In production: polls eth_getTransactionReceipt until confirmed or timeout
        Ok(1) // mock: block number 1
    }
}