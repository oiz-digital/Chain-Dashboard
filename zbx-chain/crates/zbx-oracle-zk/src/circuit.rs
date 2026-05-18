//! Groth16 circuit definition for ZK-verified price proofs.
//!
//! Public inputs:  (symbol_hash: [u8;32], price: u128, timestamp: u64, vk_hash: [u8;32])
//! Private inputs: (tls_response: Vec<u8>, notary_sig: [u8;64])
//!
//! The circuit is a stub — full R1CS / constraint generation is deferred to
//! the ZEP-012 implementation sprint.  This module compiles cleanly so the
//! rest of the ZK pipeline (proof, verifier, notary) can be integrated.

/// Public inputs committed to in the proof.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CircuitPublicInputs {
    /// keccak256 of the feed symbol string (e.g. "ZBX/USD").
    pub symbol_hash: [u8; 32],
    /// Reported price (8-decimal fixed-point, same as oracle feed).
    pub price: u128,
    /// UNIX timestamp of the price observation.
    pub timestamp: u64,
    /// keccak256 of the verification key used to generate this proof.
    pub vk_hash: [u8; 32],
}

/// Private (witness) inputs known only to the prover.
#[derive(Debug, Clone)]
pub struct CircuitPrivateInputs {
    /// Raw TLS response bytes from the CEX endpoint.
    pub tls_response: Vec<u8>,
    /// Notary co-signature over the TLS transcript.
    pub notary_sig: [u8; 64],
    /// The CEX public key used to sign the TLS session.
    pub cex_pubkey: [u8; 65],
}

/// Placeholder for the full R1CS circuit.
///
/// In production this will implement `ark_relations::r1cs::ConstraintSynthesizer`
/// from the arkworks ecosystem. For now it carries the inputs and can be used
/// as a type-checked boundary between the proving and verification layers.
#[derive(Debug)]
pub struct PriceCircuit {
    pub public:  CircuitPublicInputs,
    pub private: CircuitPrivateInputs,
}

impl PriceCircuit {
    pub fn new(public: CircuitPublicInputs, private: CircuitPrivateInputs) -> Self {
        Self { public, private }
    }

    /// Stub: returns `true` when the private inputs are non-empty.
    /// Replace with actual R1CS satisfaction check.
    pub fn is_satisfied(&self) -> bool {
        !self.private.tls_response.is_empty()
    }
}
