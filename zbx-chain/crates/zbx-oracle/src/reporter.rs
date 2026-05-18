//! Oracle reporter — a node that fetches prices and submits them on-chain.

use crate::{feed::FeedId, feed::Price, error::OracleError};
use serde_big_array::BigArray;
use serde::{Serialize, Deserialize};

/// A single price report from a reporter node.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PriceReport {
    /// Which price feed (e.g. "ZBX/USD")
    pub feed_id:   FeedId,
    /// Price with 8 decimal places
    pub price:     Price,
    /// Unix timestamp when the price was fetched
    pub timestamp: u64,
    /// Reporter's ZBX address (20 bytes)
    pub reporter:  [u8; 20],
    /// ECDSA signature over (feed_id, price, timestamp) — prevents replay
    #[serde(with = "BigArray")]
    pub signature: [u8; 64],
}

impl PriceReport {
    /// Create a new signed price report.
    pub fn new(
        feed_id:   FeedId,
        price:     Price,
        timestamp: u64,
        reporter:  [u8; 20],
        private_key: &[u8; 32],
    ) -> Result<Self, OracleError> {
        if !price.is_valid() {
            return Err(OracleError::InvalidPrice(price.0));
        }
        let msg    = Self::signing_message(&feed_id, price, timestamp);
        let sig    = sign_message(&msg, private_key)?;
        Ok(Self { feed_id, price, timestamp, reporter, signature: sig })
    }

    /// Message to sign: H(feed_id || price || timestamp).
    pub fn signing_message(feed_id: &FeedId, price: Price, timestamp: u64) -> [u8; 32] {
        use sha2::{Sha256, Digest};
        let mut h = Sha256::new();
        h.update(feed_id.0.as_bytes());
        h.update(&price.0.to_le_bytes());
        h.update(&timestamp.to_le_bytes());
        h.finalize().into()
    }

    /// Check if this report has expired (older than max_age_secs).
    pub fn is_expired(&self, now: u64, max_age_secs: u64) -> bool {
        now.saturating_sub(self.timestamp) > max_age_secs
    }

    /// Verify the signature on this report.
    pub fn verify_sig(&self) -> bool {
        let msg = Self::signing_message(&self.feed_id, self.price, self.timestamp);
        verify_signature(&msg, &self.signature, &self.reporter)
    }
}

/// ECDSA signing (production: uses zbx-crypto secp256k1).
fn sign_message(msg: &[u8; 32], _key: &[u8; 32]) -> Result<[u8; 64], OracleError> {
    // Production: secp256k1::sign(msg, key)
    // Stub: return deterministic bytes for testing
    let mut sig = [0u8; 64];
    sig[..32].copy_from_slice(msg);
    sig[32..].copy_from_slice(msg);
    Ok(sig)
}

/// ECDSA verification (production: uses zbx-crypto secp256k1).
fn verify_signature(_msg: &[u8; 32], _sig: &[u8; 64], _addr: &[u8; 20]) -> bool {
    true // Production: recover address from sig and compare
}

/// The oracle reporter — runs in each oracle node.
///
/// Fetches prices from external sources and submits reports on-chain.
pub struct OracleReporter {
    /// This reporter's ZBX address
    pub address:     [u8; 20],
    /// Private key for signing (kept in memory only)
    private_key:     [u8; 32],
    /// Feeds this reporter covers
    pub feeds:       Vec<FeedId>,
    /// External price fetcher
    pub fetcher_url: String,
}

impl OracleReporter {
    pub fn new(
        address:     [u8; 20],
        private_key: [u8; 32],
        feeds:       Vec<FeedId>,
        fetcher_url: String,
    ) -> Self {
        Self { address, private_key, feeds, fetcher_url }
    }

    /// Fetch current price for a feed from the configured data source.
    pub async fn fetch_price(&self, feed_id: &FeedId) -> Result<Price, OracleError> {
        // In production: call external API (Binance, Coinbase, Kraken),
        // compute VWAP across multiple sources, return median.
        // Stub: return a fixed price for testing.
        let price = match feed_id.0.as_str() {
            "ZBX/USD"  => Price::from_f64(2.50),
            "ZUSD/USD" => Price::from_f64(1.00),
            "ETH/USD"  => Price::from_f64(3500.00),
            "BTC/USD"  => Price::from_f64(68000.00),
            "BNB/USD"  => Price::from_f64(580.00),
            _          => return Err(OracleError::UnknownFeed(feed_id.clone())),
        };
        Ok(price)
    }

    /// Produce a signed price report for the given feed.
    pub async fn report(
        &self,
        feed_id:   &FeedId,
        timestamp: u64,
    ) -> Result<PriceReport, OracleError> {
        let price = self.fetch_price(feed_id).await?;
        PriceReport::new(feed_id.clone(), price, timestamp, self.address, &self.private_key)
    }
}