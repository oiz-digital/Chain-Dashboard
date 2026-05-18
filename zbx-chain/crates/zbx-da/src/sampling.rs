//! Data Availability Sampling (DAS) for light clients.
//!
//! Light clients can verify data availability without downloading full blobs
//! by randomly sampling chunks and verifying KZG proofs.

use crate::{commitment::KzgSettings, error::DaError};
use serde::{Deserialize, Serialize};

/// Number of samples a light client takes per blob (default: 75).
/// This gives >99.99% detection probability for withheld data.
pub const DEFAULT_SAMPLE_COUNT: usize = 75;

/// The result of a single DA sampling check.
#[derive(Debug, Serialize, Deserialize)]
pub struct SampleResult {
    /// Block number that was sampled.
    pub block: u64,
    /// Number of samples taken.
    pub samples: usize,
    /// Number of samples that were available.
    pub available: usize,
    /// Whether full DA is confirmed (all samples returned valid proofs).
    pub da_confirmed: bool,
}

/// Light-client DA sampler.
pub struct DaSampler {
    kzg: KzgSettings,
    sample_count: usize,
}

impl DaSampler {
    pub fn new(kzg: KzgSettings, sample_count: usize) -> Self {
        DaSampler { kzg, sample_count }
    }

    /// Sample data availability for a block's blobs.
    /// Returns Ok(SampleResult) if DA confirmed, Err if withheld.
    pub async fn sample_block(&self, block: u64, blob_count: usize) -> Result<SampleResult, DaError> {
        if blob_count == 0 {
            return Ok(SampleResult {
                block,
                samples: 0,
                available: 0,
                da_confirmed: true,
            });
        }

        // SEC-2026-05-09 Pass-12: previous body was a SIMULATION that
        // unconditionally set `available = samples` and returned `da_confirmed
        // = true` for every block — no network requests, no KZG verification.
        // A light client trusting this output would accept ANY withheld blob
        // as "available". Fail-closed until peer DAS protocol + KZG proof
        // verification are wired through `self.kzg`.
        let _ = (block, blob_count, &self.kzg);
        Err(DaError::NotImplemented)
    }
}