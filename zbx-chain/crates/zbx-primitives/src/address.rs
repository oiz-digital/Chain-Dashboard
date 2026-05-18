//! 20-byte Ethereum-compatible address type.

use serde::{Deserialize, Serialize};
use std::fmt;
use sha3::{Keccak256, Digest};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default, Serialize, Deserialize)]
pub struct Address(pub [u8; 20]);

impl Address {
    pub const ZERO: Self = Self([0u8; 20]);

    pub fn from_hex(s: &str) -> Result<Self, String> {
        let s = s.trim_start_matches("0x");
        if s.len() != 40 { return Err(format!("invalid length: {}", s.len())); }
        let mut b = [0u8; 20];
        for i in 0..20 {
            b[i] = u8::from_str_radix(&s[i*2..i*2+2], 16).map_err(|e| e.to_string())?;
        }
        Ok(Address(b))
    }

    pub fn from_pubkey(pubkey: &[u8]) -> Self {
        let h = Keccak256::digest(pubkey);
        let mut a = [0u8; 20];
        a.copy_from_slice(&h[12..]);
        Address(a)
    }

    pub fn is_zero(&self) -> bool { self.0 == [0u8; 20] }

    pub fn to_hex(&self) -> String { format!("0x{}", hex::encode(self.0)) }

    pub fn to_checksum(&self) -> String {
        let hex_str = hex::encode(self.0);
        let hash = hex::encode(Keccak256::digest(hex_str.as_bytes()));
        let mut out = "0x".to_string();
        for (i, c) in hex_str.chars().enumerate() {
            let nibble = u8::from_str_radix(&hash[i..i+1], 16).unwrap_or(0);
            if nibble >= 8 { out.push(c.to_ascii_uppercase()); }
            else { out.push(c); }
        }
        out
    }
}

impl fmt::Display for Address {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.to_checksum())
    }
}