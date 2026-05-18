//! Price proposal submitted by a proposer in response to an oracle request.

use crate::request::RequestId;
use serde::{Serialize, Deserialize};

/// A proposer's answer to an oracle request.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceProposal {
    /// The request this proposal answers.
    pub request_id: RequestId,
    /// The proposer's address (20-byte Ethereum-compatible).
    pub proposer: [u8; 20],
    /// The proposed price (8-decimal fixed-point, same as Chainlink).
    pub price: i128,
    /// UNIX timestamp when the proposal was submitted.
    pub timestamp: u64,
    /// ZBX bond amount staked (in wei-equivalent base units).
    pub bond: u128,
    /// Optional human-readable explanation / data source reference.
    pub rationale: Option<String>,
}

impl PriceProposal {
    pub fn new(
        request_id: RequestId,
        proposer: [u8; 20],
        price: i128,
        timestamp: u64,
        bond: u128,
    ) -> Self {
        Self { request_id, proposer, price, timestamp, bond, rationale: None }
    }

    /// Challenge window (seconds after `timestamp`) during which disputes may be filed.
    pub const CHALLENGE_WINDOW_SECS: u64 = 7_200; // 2 hours

    /// True if the challenge window has closed at `now`.
    pub fn is_final(&self, now: u64) -> bool {
        now >= self.timestamp + Self::CHALLENGE_WINDOW_SECS
    }
}
