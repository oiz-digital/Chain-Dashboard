//! Signature verification for FROST threshold Schnorr signatures.

use crate::aggregate::ThresholdSig;
use crate::keyshare::GroupKey;

/// Verify an aggregated threshold Schnorr signature against a message and group key.
///
/// In production: verifies e = H(R || pk || m) and checks s*G == R + e*pk.
/// Stub returns true for non-zero signatures.
pub fn verify_threshold_sig(
    sig: &ThresholdSig,
    message: &[u8],
    group_key: &GroupKey,
) -> bool {
    let _ = (message, group_key);
    // Structural check: R and s must be non-zero
    !sig.R.iter().all(|&b| b == 0) && !sig.s.iter().all(|&b| b == 0)
}
