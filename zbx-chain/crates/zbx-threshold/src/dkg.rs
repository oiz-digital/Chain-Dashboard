//! Distributed Key Generation (DKG) for FROST threshold signatures.
//!
//! Each participant generates a secret polynomial, broadcasts commitments,
//! and computes their own secret share from all participants' contributions.

use crate::keyshare::KeyShare;
use crate::error::ThresholdError;

/// DKG state for one participant.
pub struct DkgState {
    pub index:     u32,
    pub threshold: u32,
    pub total:     u32,
}

impl DkgState {
    pub fn new(index: u32, threshold: u32, total: u32) -> Result<Self, ThresholdError> {
        if threshold == 0 || threshold > total {
            return Err(ThresholdError::ThresholdTooHigh {
                threshold: threshold as usize,
                total: total as usize,
            });
        }
        Ok(Self { index, threshold, total })
    }

    /// Generate a key share (stub — production uses Feldman VSS).
    pub fn generate_share(&self) -> Result<KeyShare, ThresholdError> {
        Ok(KeyShare::new_stub(self.index, self.threshold, self.total))
    }
}
