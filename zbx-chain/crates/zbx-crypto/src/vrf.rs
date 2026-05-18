//! Verifiable Random Function (VRF) for block proposer selection.
//!
//! Each validator computes VRF(epoch_seed || validator_index) to determine
//! their slot in the round-robin schedule with weighted randomness.

use crate::{keccak::keccak256, secp256k1::PrivKey};
use zbx_types::{error::ZbxError, H256};
use serde_big_array::BigArray;
use serde::{Deserialize, Serialize};

/// VRF proof produced by a validator for a given epoch seed.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct VrfProof {
    /// The pseudorandom output bytes (32 bytes).
    pub output: H256,
    /// The proof bytes for on-chain verification (64 bytes).
    #[serde(with = "BigArray")]
    pub proof: [u8; 64],
}

/// Compute a VRF output and proof for the given input using the private key.
pub fn vrf_prove(priv_key: &PrivKey, input: &[u8]) -> VrfProof {
    // Canonical VRF construction: H(privkey || input) for output,
    // H(privkey || output) for proof. Production uses ECVRF-SECP256K1-SHA256.
    let mut key_input = Vec::with_capacity(32 + input.len());
    key_input.extend_from_slice(priv_key.as_bytes());
    key_input.extend_from_slice(input);
    let output = keccak256(&key_input);

    let mut proof_input = [0u8; 64];
    proof_input[..32].copy_from_slice(priv_key.as_bytes());
    proof_input[32..].copy_from_slice(output.as_bytes());
    let proof_h = keccak256(&proof_input);
    let mut proof = [0u8; 64];
    proof[..32].copy_from_slice(proof_h.as_bytes());
    proof[32..].copy_from_slice(output.as_bytes());

    VrfProof { output, proof }
}

/// Verify a VRF proof against the given public key and input.
///
/// Audit-2026-05-01 S7-CR4: previously `let _ = check; Ok(proof.output)` —
/// the function discarded the verification hash and rubber-stamped any
/// proof. An attacker could forge any (output, proof) and have it accepted,
/// fully bypassing VRF-based proposer selection. Until a real ECVRF
/// (RFC 9381) implementation lands, we **fail explicitly** so consensus
/// can never accept a stub proof. Re-enable only when a verified-correct
/// ECVRF is wired in (and replace this body with that call).
pub fn vrf_verify(
    _pub_key_bytes: &[u8; 65],
    _input: &[u8],
    _proof: &VrfProof,
) -> Result<H256, ZbxError> {
    Err(ZbxError::Signature(
        "VRF verification is not implemented in this build; \
         callers must reject (Audit-2026-05-01 S7-CR4)".into(),
    ))
}

/// Compute a deterministic 256-bit "stake-weighted ticket" for ranking.
///
/// Audit-2026-05-01 S7-CR5: previously `vrf_score` used `f64.powf(...)`
/// for ranking, which is non-deterministic across architectures /
/// libm versions and silently forks the chain when validators on
/// different CPUs compute different scores. Replaced with deterministic
/// integer arithmetic: ticket = vrf_output_u256 / stake_weight. Higher
/// stake → smaller ticket → higher selection priority (lowest ticket
/// wins). All operations are exact U256, identical on every platform.
///
/// Returns 32 raw bytes (big-endian U256) so callers can rank with
/// `ticket_bytes_a.cmp(&ticket_bytes_b)` and get total ordering.
pub fn vrf_ticket(output: &H256, stake_weight: u64) -> [u8; 32] {
    use zbx_types::U256;
    let raw = U256::from_big_endian(output.as_bytes());
    let weight = stake_weight.max(1); // guard against zero-stake div-by-zero
    let ticket = raw / U256::from(weight);
    let mut out = [0u8; 32];
    ticket.to_big_endian(&mut out);
    out
}

/// Select the block proposer from a validator set deterministically.
/// The validator with the **lowest** stake-weighted ticket wins.
///
/// Audit-2026-05-01 S7-CR5: rewritten with integer ticket comparison;
/// see `vrf_ticket` for the rationale.
pub fn select_proposer(vrf_outputs: &[H256], stake_weights: &[u64]) -> usize {
    assert_eq!(vrf_outputs.len(), stake_weights.len());
    assert!(!vrf_outputs.is_empty(), "select_proposer requires ≥1 validator");
    let mut best_idx = 0usize;
    let mut best_ticket = vrf_ticket(&vrf_outputs[0], stake_weights[0]);
    for (i, (output, &weight)) in vrf_outputs.iter().zip(stake_weights).enumerate().skip(1) {
        let t = vrf_ticket(output, weight);
        if t < best_ticket {
            best_ticket = t;
            best_idx = i;
        }
    }
    best_idx
}
/// ECVRF-EDWARDS25519-SHA512-ELL2 (RFC 9381, suite 0x04) — precompile 0x0E surface.
///
/// Status: **fail-closed**. `verify` always returns `None`; the dispatcher
/// translates that to a 32-byte zero output (ECRECOVER convention) so any
/// caller that branches on `ret.length != 64` correctly treats every proof
/// as invalid until a cross-verified verifier lands. Decode-stage validation
/// (proof length, Γ decompression, canonical s, Y small-subgroup) still
/// runs so malformed inputs are rejected at the same layer they will be in
/// the real impl, keeping the `None` boundary stable across the upgrade.
pub mod ecvrf_edwards25519 {
    use curve25519_dalek::edwards::CompressedEdwardsY;
    use curve25519_dalek::scalar::Scalar;
    use curve25519_dalek::traits::IsIdentity;

    /// Suite string for ECVRF-EDWARDS25519-SHA512-ELL2 (RFC 9381 §5.5).
    pub const SUITE_STRING: u8 = 0x04;
    /// Length of `pi_string` (Gamma:32 || c:16 || s:32) for this suite.
    pub const PROOF_LEN: usize = 80;
    /// Length of `beta_string` (SHA-512 output).
    pub const BETA_LEN: usize = 64;
    /// Length of the public-key compressed encoding.
    pub const PUBKEY_LEN: usize = 32;

    /// RFC 9381 §5.3 ECVRF_verify(Y, alpha_string, pi_string).
    ///
    /// **Fail-closed.** Returns `Some(beta)` only when a cross-verified
    /// verifier lands; for now always returns `None` after running the
    /// decode-stage validation (proof length, Γ decompression, canonical
    /// `s`, Y small-subgroup). The dispatcher converts `None` to a
    /// 32-byte zero output, matching the ECRECOVER convention.
    pub fn verify(pubkey: &[u8; PUBKEY_LEN], _alpha: &[u8], pi: &[u8]) -> Option<[u8; BETA_LEN]> {
        if pi.len() != PROOF_LEN {
            return None;
        }
        let mut gamma_bytes = [0u8; 32];
        gamma_bytes.copy_from_slice(&pi[0..32]);
        let mut s_bytes_le = [0u8; 32];
        s_bytes_le.copy_from_slice(&pi[48..80]);

        // Γ must decompress; s must be canonical (< L); Y must not be in the
        // small subgroup. These are the cheap checks the real verifier will
        // also run first, kept here so the rejection boundary is stable.
        CompressedEdwardsY(gamma_bytes).decompress()?;
        let _s_scalar = Option::<Scalar>::from(Scalar::from_canonical_bytes(s_bytes_le))?;
        let y_point = CompressedEdwardsY(*pubkey).decompress()?;
        if y_point.mul_by_cofactor().is_identity() {
            return None;
        }
        // Verifier body deferred — see module-level docs.
        None
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        // RFC 9381 §A.4 Example 16 (suite 0x04, alpha = empty) — kept as the
        // canonical well-formed input that exercises the decode path. Used
        // only to construct malformed mutations; positive-path verification
        // is deferred (see module docs).
        const PK_HEX: &str = "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a";
        const PI_HEX: &str = "7d9c633ffeee27349264cf5c667579fc583b4bda63ab71d001f89c10003ab46f25898f6bd7d4ed4c75f0282b0f7bb9d0e61b387b76db60b3cbf34bf09109ccb33fab28e3e7d09a4f56cdb71fe34c1b0d";

        fn h(s: &str) -> Vec<u8> {
            (0..s.len())
                .step_by(2)
                .map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap())
                .collect()
        }

        fn pk32() -> [u8; 32] {
            let mut a = [0u8; 32];
            a.copy_from_slice(&h(PK_HEX));
            a
        }

        #[test]
        fn malformed_proof_length_rejected() {
            assert!(verify(&pk32(), b"", &vec![0u8; 79]).is_none());
            assert!(verify(&pk32(), b"", &vec![0u8; 81]).is_none());
        }

        #[test]
        fn non_canonical_scalar_rejected() {
            // s = all-0xff (>> L) — must fail decode-stage canonical check.
            let mut pi = h(PI_HEX);
            for b in pi[48..80].iter_mut() {
                *b = 0xff;
            }
            assert!(verify(&pk32(), b"", &pi).is_none());
        }

        #[test]
        fn small_subgroup_pubkey_rejected() {
            // Identity point compresses to 32 bytes with byte 0 = 0x01.
            let mut pk = [0u8; 32];
            pk[0] = 0x01;
            assert!(verify(&pk, b"", &h(PI_HEX)).is_none());
        }

        #[test]
        fn well_formed_input_currently_returns_none() {
            // Documents the fail-closed contract: even a valid RFC vector
            // returns None until the verifier body lands. Flip this to
            // assert!(.is_some()) when un-deferring.
            assert!(verify(&pk32(), b"", &h(PI_HEX)).is_none());
        }
    }
}
