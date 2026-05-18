//! Bundler error types.

use thiserror::Error;

#[derive(Debug, Error)]
pub enum BundlerError {
    #[error("simulation failed: {0}")]
    SimulationFailed(String),

    #[error("UserOperation gas too high: {0}")]
    GasTooHigh(u64),

    #[error("pre-verification gas too low (min 21000)")]
    PreVerificationGasTooLow,

    #[error("unsupported entry point: {0}")]
    UnsupportedEntryPoint(String),

    #[error("invalid sender address")]
    InvalidSender,

    #[error("missing signature")]
    MissingSignature,

    #[error("calldata too large: {0} bytes")]
    CalldataTooLarge(usize),

    #[error("empty UserOperation (no initCode or callData)")]
    EmptyOperation,

    #[error("verification gas limit too low")]
    VerificationGasTooLow,

    #[error("call gas limit is zero but callData is non-empty")]
    CallGasZero,

    #[error("empty bundle")]
    EmptyBundle,

    #[error("relay error: {0}")]
    Relay(String),

    #[error("bundler rpc error: {0}")]
    Rpc(String),

    /// SEC-2026-05-09 Pass-15 (HIGH-R05): UserOp time window expired
    /// or not yet active. Bundler refuses to include in a bundle.
    #[error("UserOp expired: validAfter={valid_after} validUntil={valid_until} now={now}")]
    Expired { valid_after: u64, valid_until: u64, now: u64 },
}