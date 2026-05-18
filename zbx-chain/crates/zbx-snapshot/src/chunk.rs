//! Snapshot chunk — binary blob of accounts.

use serde::{Deserialize, Serialize};
use sha3::{Keccak256, Digest};
use super::AccountSnapshot;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotChunk {
    pub index:     u32,
    pub accounts:  Vec<AccountSnapshot>,
    pub start_key: [u8; 20],
    pub end_key:   [u8; 20],
    pub checksum:  [u8; 32],
}

impl SnapshotChunk {
    pub fn new(index: u32, accounts: Vec<AccountSnapshot>) -> Self {
        let start = accounts.first().map(|a| a.address).unwrap_or([0u8; 20]);
        let end   = accounts.last() .map(|a| a.address).unwrap_or([0xff; 20]);
        let ck    = Self::checksum(&accounts);
        Self { index, accounts, start_key: start, end_key: end, checksum: ck }
    }

    fn checksum(accounts: &[AccountSnapshot]) -> [u8; 32] {
        let mut h = Keccak256::new();
        for a in accounts { h.update(&a.address); h.update(&a.balance); h.update(&a.nonce.to_be_bytes()); }
        h.finalize().into()
    }

    pub fn verify(&self) -> bool { Self::checksum(&self.accounts) == self.checksum }
    pub fn to_bytes(&self) -> Result<Vec<u8>, Box<dyn std::error::Error>> { Ok(bincode::serialize(self)?) }
    pub fn from_bytes(b: &[u8]) -> Result<Self, Box<dyn std::error::Error>> { Ok(bincode::deserialize(b)?) }
}