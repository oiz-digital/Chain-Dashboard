//! 32-byte / 20-byte hash newtype wrappers.

use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default, Serialize, Deserialize)]
pub struct H256(pub [u8; 32]);

impl H256 {
    pub const ZERO: Self = Self([0u8; 32]);

    pub fn from_slice(s: &[u8]) -> Self {
        let mut b = [0u8; 32];
        b.copy_from_slice(s);
        Self(b)
    }

    pub fn as_bytes(&self) -> &[u8; 32] { &self.0 }
    pub fn to_bytes(self) -> [u8; 32] { self.0 }
    pub fn is_zero(&self) -> bool { self.0 == [0u8; 32] }
}

impl From<[u8; 32]> for H256 { fn from(v: [u8; 32]) -> Self { Self(v) } }
impl From<H256> for [u8; 32] { fn from(v: H256) -> Self { v.0 } }
impl AsRef<[u8]> for H256 { fn as_ref(&self) -> &[u8] { &self.0 } }

impl fmt::Display for H256 {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "0x")?;
        for b in &self.0 { write!(f, "{:02x}", b)?; }
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default, Serialize, Deserialize)]
pub struct H160(pub [u8; 20]);

impl H160 {
    pub const ZERO: Self = Self([0u8; 20]);

    pub fn from_slice(s: &[u8]) -> Self {
        let mut b = [0u8; 20];
        b.copy_from_slice(s);
        Self(b)
    }

    pub fn as_bytes(&self) -> &[u8; 20] { &self.0 }
    pub fn to_bytes(self) -> [u8; 20] { self.0 }
    pub fn is_zero(&self) -> bool { self.0 == [0u8; 20] }
}

impl From<[u8; 20]> for H160 { fn from(v: [u8; 20]) -> Self { Self(v) } }
impl From<H160> for [u8; 20] { fn from(v: H160) -> Self { v.0 } }
impl AsRef<[u8]> for H160 { fn as_ref(&self) -> &[u8] { &self.0 } }

impl fmt::Display for H160 {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "0x")?;
        for b in &self.0 { write!(f, "{:02x}", b)?; }
        Ok(())
    }
}
