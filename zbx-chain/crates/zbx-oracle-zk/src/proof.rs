//! ZK price proof structures.

use serde_big_array::BigArray;
use serde::{Serialize, Deserialize};
use crate::notary::NotaryAttestation;

/// A Groth16 proof that a price came from a valid CEX response.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ZkPriceProof {
    /// Groth16 proof bytes (pi_a, pi_b, pi_c)
    #[serde(with = "BigArray")]
    pub groth16_a: [u8; 64],  // G1 point (x, y)
    #[serde(with = "BigArray")]
    pub groth16_b: [u8; 128], // G2 point (x0,x1, y0,y1)
    #[serde(with = "BigArray")]
    pub groth16_c: [u8; 64],  // G1 point (x, y)
    /// Public inputs to the circuit
    pub public_inputs: ZkPublicInputs,
}

/// Public inputs to the ZK price circuit (known to verifier).
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ZkPublicInputs {
    /// SHA-256 of the feed symbol (e.g. H("ZBX/USD"))
    pub symbol_hash:      [u8; 32],
    /// The claimed price (8 decimals)
    pub price:            i128,
    /// Unix timestamp of the CEX response
    pub timestamp:        u64,
    /// SHA-256 of the verifying key (identifies which CEX)
    pub vk_hash:          [u8; 32],
    /// Notary's public key (identifies the TLS notary)
    #[serde(with = "BigArray")]
    pub notary_pubkey:    [u8; 33], // compressed secp256k1
}

/// A ZK-proven price report — combines proof + metadata.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ZkPriceReport {
    pub proof:        ZkPriceProof,
    pub notary_attest: NotaryAttestation,
    pub reporter:     [u8; 20],
}

impl ZkPriceProof {
    /// Concatenate the three flat point fields into the canonical
    /// uncompressed byte layout that arkworks `Proof<Bn254>` expects:
    /// `pi_a (G1, 64 B) || pi_b (G2, 128 B) || pi_c (G1, 64 B) = 256 B`.
    /// SEC-2026-05-09 Pass-17 — consumed by the real Groth16 verifier.
    pub fn proof_bytes_canonical(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(64 + 128 + 64);
        out.extend_from_slice(&self.groth16_a);
        out.extend_from_slice(&self.groth16_b);
        out.extend_from_slice(&self.groth16_c);
        out
    }
}

impl ZkPriceReport {
    /// Verify this report's proof off-chain before submission.
    pub fn verify_locally(&self) -> bool {
        // Production: run Groth16 verifier with the proof and public inputs
        // Stub: always valid for testing
        self.proof.public_inputs.price > 0
            && !self.proof.public_inputs.symbol_hash.iter().all(|&b| b == 0)
    }
}