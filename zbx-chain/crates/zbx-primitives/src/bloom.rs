//! 256-byte (2048-bit) Ethereum-compatible logs bloom filter.

use serde::{Deserialize, Serialize};
use serde_big_array::BigArray;

#[derive(Clone, Copy, Serialize, Deserialize)]
pub struct Bloom(#[serde(with = "BigArray")] pub [u8; 256]);

impl Bloom {
    pub const ZERO: Self = Self([0u8; 256]);

    pub fn new() -> Self { Self::ZERO }

    pub fn as_bytes(&self) -> &[u8; 256] { &self.0 }
    pub fn to_bytes(self) -> [u8; 256] { self.0 }
    pub fn is_zero(&self) -> bool { self.0 == [0u8; 256] }

    /// OR another bloom into this one (used when accumulating receipts → block bloom).
    pub fn accrue(&mut self, other: &Bloom) {
        for (a, b) in self.0.iter_mut().zip(other.0.iter()) { *a |= *b; }
    }

    /// Set bits per Ethereum yellow paper: take 3 byte-pairs of keccak256(input)
    /// mod 2048, set those bits.
    pub fn add(&mut self, hashed: &[u8]) {
        if hashed.len() < 6 { return; }
        for i in 0..3 {
            let bit = (((hashed[2 * i] as u16) << 8) | (hashed[2 * i + 1] as u16)) as usize % 2048;
            let byte_idx = 255 - bit / 8;
            let bit_idx = bit % 8;
            self.0[byte_idx] |= 1 << bit_idx;
        }
    }
}

impl Default for Bloom { fn default() -> Self { Self::ZERO } }

impl PartialEq for Bloom { fn eq(&self, other: &Self) -> bool { self.0 == other.0 } }
impl Eq for Bloom {}

impl std::fmt::Debug for Bloom {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Bloom(0x")?;
        for b in &self.0 { write!(f, "{:02x}", b)?; }
        write!(f, ")")
    }
}

impl From<[u8; 256]> for Bloom { fn from(v: [u8; 256]) -> Self { Self(v) } }
impl From<Bloom> for [u8; 256] { fn from(v: Bloom) -> Self { v.0 } }
impl AsRef<[u8]> for Bloom { fn as_ref(&self) -> &[u8] { &self.0 } }
