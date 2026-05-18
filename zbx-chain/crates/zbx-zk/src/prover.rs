//! ZK prover — **placeholder** Groth16 generation; PLONK is fail-closed (S31).
//!
//! # ⚠️ This module emits PLACEHOLDER bytes for the Groth16 path.
//!
//! It is preserved as a shape/API stub only. **Do not** use the proofs
//! produced here for any production purpose; the resulting [`Proof`]
//! values will be rejected by [`crate::verifier::Verifier::verify`] (which
//! returns [`VerifyError::LegacyPlaceholderRefused`] after the S26
//! hardening pass).
//!
//! # S31 PLONK fail-closed
//!
//! Pre-S31 the PLONK branch silently emitted `Proof::Plonk` values
//! containing all-zero G1/G2 byte arrays. A downstream consumer that
//! did NOT route them through the (always-rejecting) legacy
//! [`crate::verifier::Verifier`] facade would have accepted them. S31
//! replaces that branch with an explicit
//! [`ProverError::PlonkNotImplemented`] so no caller can produce a
//! "demo" PLONK proof that merely *looks* well-formed.
//!
//! For real proofs:
//!   - **Groth16**: generate off-chain via snarkjs / circom / arkworks
//!     `Groth16::prove`, using a trusted-setup `ProvingKey` artifact
//!     (Powers-of-Tau ceremony output), then serialise via
//!     `ark_serialize` (compressed mode) and verify via
//!     [`crate::verifier::Groth16Verifier::verify`] (Rust-side) or
//!     `contracts/ZbxGroth16Verifier.sol` (on-chain).
//!   - **PLONK**: see [`crate::plonk`] module docs. Today the verifier
//!     is fail-closed pending upstream `ark-plonk` BN254 stabilisation;
//!     when wired, real PLONK proving will be done off-chain (e.g.
//!     `gnark` / `barretenberg`) and verified through
//!     [`crate::plonk::PlonkVerifier`].

use std::time::Instant;
use crate::circuit::{Circuit, Fp};
use crate::verifier::{Groth16Proof, Proof, ProofType};

#[derive(Debug, Clone)]
pub struct ProverConfig { pub threads: usize, pub proof_type: ProofType }
impl Default for ProverConfig { fn default() -> Self { Self { threads: 4, proof_type: ProofType::Groth16 } } }

#[derive(Debug, Clone)]
pub struct ProvingKey {
    pub alpha:       [u8; 96],
    pub beta:        [u8; 192],
    pub a_query:     Vec<[u8; 96]>,
    pub h_query:     Vec<[u8; 96]>,
}

#[derive(Debug)]
pub struct ProofResult { pub proof: Proof, pub public_inputs: Vec<Fp>, pub ms: u64 }

pub struct Prover { pub config: ProverConfig, pub pk: ProvingKey }

impl Prover {
    pub fn new(config: ProverConfig, pk: ProvingKey) -> Self { Self { config, pk } }

    pub fn prove(&self, circuit: &Circuit, witness: &[Fp]) -> Result<ProofResult, ProverError> {
        let t = Instant::now();
        let full = circuit.evaluate(witness).map_err(|e| ProverError::Witness(e.to_string()))?;
        let pub_inputs: Vec<Fp> = circuit.public_inputs.iter().map(|w| full[w.0]).collect();
        let proof = match self.config.proof_type {
            ProofType::Groth16 => Proof::Groth16(Groth16Proof { a: [0u8;96], b: [0u8;192], c: [0u8;96] }),
            // S31: PLONK proving was previously emitting all-zero
            // placeholder bytes that LOOKED well-formed. Replaced
            // with an explicit error so no caller can be silently
            // fooled. Real PLONK requires upstream ark-plonk BN254
            // stabilisation (see crate::plonk module docs).
            ProofType::Plonk   => return Err(ProverError::PlonkNotImplemented),
        };
        Ok(ProofResult { proof, public_inputs: pub_inputs, ms: t.elapsed().as_millis() as u64 })
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ProverError {
    #[error("Witness: {0}")]   Witness(String),
    #[error("Proving: {0}")]   Proving(String),
    /// S31 — PLONK proving system is not wired. Real PLONK proving
    /// requires upstream ark-plonk BN254 stabilisation; until then
    /// the prover refuses rather than emitting placeholder bytes.
    #[error("PLONK proving not implemented in this build — see crates/zbx-zk/src/plonk.rs module docs")]
    PlonkNotImplemented,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::circuit::CircuitBuilder;

    fn empty_pk() -> ProvingKey {
        ProvingKey {
            alpha:   [0u8; 96],
            beta:    [0u8; 192],
            a_query: vec![],
            h_query: vec![],
        }
    }

    #[test]
    fn s31_plonk_proving_path_returns_explicit_error_not_placeholder_bytes() {
        // S31 regression test: the prover MUST refuse PLONK rather
        // than silently producing zero-byte placeholder proofs.
        let mut cb = CircuitBuilder::new();
        let _w = cb.public_input("x");
        let circuit = cb.build();
        let p = Prover::new(
            ProverConfig { threads: 1, proof_type: ProofType::Plonk },
            empty_pk(),
        );
        // Witness must be wire_count long; circuit has 1 wire.
        let r = p.prove(&circuit, &[Fp::from_u64(7)]);
        assert!(matches!(r, Err(ProverError::PlonkNotImplemented)),
            "prover MUST hard-error on PLONK in S31, not return placeholder bytes");
    }

    #[test]
    fn s31_groth16_proving_path_still_returns_placeholder_for_backcompat() {
        // The legacy Groth16 placeholder behaviour is preserved (callers
        // already pipe it through the always-rejecting Verifier facade
        // or use Groth16Verifier directly with real arkworks bytes).
        let mut cb = CircuitBuilder::new();
        let _w = cb.public_input("x");
        let circuit = cb.build();
        let p = Prover::new(
            ProverConfig { threads: 1, proof_type: ProofType::Groth16 },
            empty_pk(),
        );
        let r = p.prove(&circuit, &[Fp::from_u64(7)]);
        assert!(r.is_ok(), "Groth16 placeholder behaviour preserved");
    }
}