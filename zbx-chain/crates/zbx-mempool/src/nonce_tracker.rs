//! Per-account nonce tracking.

use std::collections::HashMap;
use zbx_types::address::Address;

/// Tracks the expected next nonce for each sender.
pub struct NonceTracker {
    /// Nonces confirmed on-chain (from world state).
    on_chain: HashMap<Address, u64>,
    /// Nonces of transactions currently in the pending pool.
    pending_max: HashMap<Address, u64>,
}

impl NonceTracker {
    pub fn new() -> Self {
        NonceTracker {
            on_chain: HashMap::new(),
            pending_max: HashMap::new(),
        }
    }

    /// Update the committed on-chain nonce for an address.
    pub fn set_on_chain(&mut self, addr: Address, nonce: u64) {
        self.on_chain.insert(addr, nonce);
        // Evict pending nonces that are now confirmed.
        if let Some(max) = self.pending_max.get(&addr) {
            if *max <= nonce {
                self.pending_max.remove(&addr);
            }
        }
    }

    /// The next expected nonce for a sender (pending-aware).
    pub fn next_nonce(&self, addr: &Address) -> u64 {
        self.pending_max
            .get(addr)
            .copied()
            .map(|n| n + 1)
            .unwrap_or_else(|| self.on_chain.get(addr).copied().unwrap_or(0))
    }

    /// The last confirmed on-chain nonce.
    pub fn on_chain_nonce(&self, addr: &Address) -> u64 {
        self.on_chain.get(addr).copied().unwrap_or(0)
    }

    /// Record that a pending tx with the given nonce was added.
    pub fn record_pending(&mut self, addr: Address, nonce: u64) {
        let entry = self.pending_max.entry(addr).or_insert(0);
        if nonce > *entry {
            *entry = nonce;
        }
    }

    /// Remove pending record when a tx is evicted.
    pub fn remove_pending(&mut self, addr: &Address) {
        self.pending_max.remove(addr);
    }
}

impl Default for NonceTracker {
    fn default() -> Self {
        Self::new()
    }
}