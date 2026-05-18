//! Block builder — constructs optimal blocks by selecting and ordering txs.
//!
//! The block builder:
//!   1. Receives bundles from searchers via the PBS relay.
//!   2. Simulates bundles and selects the most profitable combination.
//!   3. Fills remaining block space with mempool txs (highest fee first).
//!   4. Bids for the block slot via the PBS relay.
//!   5. If bid wins, seals and submits the block.

use crate::{bundle::MevBundle, error::MevError};
use serde_big_array::BigArray;
use serde::{Deserialize, Serialize};

/// A builder's bid for a block slot.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuilderBid {
    /// Builder's public key (identity).
    pub builder:     [u8; 20],
    /// Block number this bid is for.
    pub block_number: u64,
    /// Bid amount (ZBX wei). Paid to the validator.
    pub bid_amount:  u128,
    /// Expected block value (total fees + MEV).
    pub block_value: u128,
    /// Merkle root of the proposed block body (commitment).
    pub block_root:  [u8; 32],
    /// Builder's signature over (block_number, bid_amount, block_root).
    #[serde(with = "BigArray")]
    pub signature:   [u8; 65],
}

/// Block builder: assembles the highest-value block.
pub struct BlockBuilder {
    /// Bundles received from searchers (sorted by profit descending).
    pending_bundles: Vec<MevBundle>,
    /// Maximum gas per block.
    gas_limit:       u64,
    /// Current base fee (for profitability calculation).
    base_fee:        u64,
}

impl BlockBuilder {
    pub fn new(gas_limit: u64, base_fee: u64) -> Self {
        Self { pending_bundles: vec![], gas_limit, base_fee }
    }

    pub fn add_bundle(&mut self, bundle: MevBundle) {
        self.pending_bundles.push(bundle);
        // Keep sorted by builder tip (highest first).
        self.pending_bundles.sort_by(|a, b| b.builder_tip.cmp(&a.builder_tip));
    }

    /// Select non-conflicting bundles that maximise block value.
    pub fn select_bundles(&self, target_block: u64) -> Vec<&MevBundle> {
        let mut selected = vec![];
        let mut gas_used = 0u64;

        for bundle in &self.pending_bundles {
            if bundle.target_block != target_block { continue; }
            // Rough gas estimate: 21_000 per tx as placeholder.
            let bundle_gas = bundle.tx_count() as u64 * 21_000;
            if gas_used + bundle_gas > self.gas_limit { continue; }
            selected.push(bundle);
            gas_used += bundle_gas;
        }
        selected
    }

    /// Build a bid for the block slot.
    pub fn build_bid(
        &self,
        block_number: u64,
        builder_addr: [u8; 20],
        selected_bundles: &[&MevBundle],
    ) -> BuilderBid {
        let total_tip: u128 = selected_bundles.iter().map(|b| b.builder_tip).sum();
        // Builder keeps 10%, pays 90% to validator as bid.
        let bid = total_tip * 90 / 100;
        BuilderBid {
            builder:      builder_addr,
            block_number,
            bid_amount:   bid,
            block_value:  total_tip,
            block_root:   [0u8; 32], // filled by actual block construction
            signature:    [0u8; 65],
        }
    }

    pub fn bundle_count(&self) -> usize { self.pending_bundles.len() }
    pub fn clear_expired(&mut self, current_block: u64) {
        self.pending_bundles.retain(|b| b.target_block >= current_block);
    }
}