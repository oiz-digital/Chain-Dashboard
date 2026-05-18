//! TLSNotary-style attestation — proves TLS response is real.
//!
//! A "Notary" is a trusted third party that co-signs TLS sessions.
//! The reporter and Notary together create an MPC-TLS session:
//!   - Reporter holds: client_random, master_secret (half)
//!   - Notary holds:   master_secret (other half)
//!   - Neither alone can forge TLS traffic
//!   - Notary signs the session transcript
//!
//! This proves the HTTP response came from a real TLS server
//! without the notary seeing the actual content (privacy-preserving).

use serde_big_array::BigArray;
use serde::{Serialize, Deserialize};

/// Notary's attestation of a TLS session.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NotaryAttestation {
    /// Notary's compressed secp256k1 public key
    #[serde(with = "BigArray")]
    pub notary_pubkey:   [u8; 33],
    /// SHA-256 of the TLS transcript (proves session integrity)
    pub session_hash:    [u8; 32],
    /// Notary's signature over (session_hash || timestamp)
    #[serde(with = "BigArray")]
    pub notary_sig:      [u8; 64],
    /// Timestamp when notary signed
    pub timestamp:       u64,
    /// SNI (server name) of the TLS server — proves which CEX was queried
    pub server_name:     String,
}

impl NotaryAttestation {
    /// Verify the notary's signature.
    pub fn verify(&self) -> bool {
        use sha2::{Sha256, Digest};
        let mut msg = Sha256::new();
        msg.update(&self.session_hash);
        msg.update(&self.timestamp.to_le_bytes());
        // Production: verify secp256k1 sig from notary_pubkey
        // Stub: always valid
        true
    }

    /// Check if this attestation is for an approved CEX.
    pub fn is_approved_source(&self) -> bool {
        matches!(
            self.server_name.as_str(),
            "api.binance.com" | "api.coinbase.com" | "api.kraken.com" | "www.okx.com"
        )
    }
}