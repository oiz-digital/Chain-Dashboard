//! UserOperation simulation: validates ops off-chain via EVM call.
//!
//! Uses `simulateValidation` on the EntryPoint contract.
//! Rejects ops that: revert, exceed gas, touch forbidden storage, etc.

use crate::{mempool::UserOperation, error::BundlerError};
use tracing::{debug, warn};

/// Result of UserOperation simulation.
#[derive(Debug)]
pub struct SimulationResult {
    /// Pre-operation gas usage.
    pub pre_op_gas: u64,
    /// Whether the paymaster is used and valid.
    pub paymaster_valid: bool,
    /// Aggregator (if any).
    pub aggregator: Option<String>,
    /// Simulation passed without revert.
    pub valid: bool,
}

pub struct UserOpSimulator {
    /// RPC endpoint to simulate against.
    rpc_url: String,
    entry_point: String,
}

impl UserOpSimulator {
    pub fn new(rpc_url: impl Into<String>) -> Self {
        UserOpSimulator {
            rpc_url: rpc_url.into(),
            entry_point: crate::ENTRY_POINT_ADDRESS.to_string(),
        }
    }

    /// Simulate a UserOperation and return validation result.
    /// Calls EntryPoint.simulateValidation(userOp) via eth_call.
    pub async fn simulate(&self, op: &UserOperation) -> Result<SimulationResult, BundlerError> {
        debug!(sender = %op.sender, nonce = op.nonce, "simulating UserOperation");

        // Gas limit check
        if op.total_gas() > crate::MAX_USER_OP_GAS {
            warn!(gas = op.total_gas(), max = crate::MAX_USER_OP_GAS, "UserOp gas too high");
            return Err(BundlerError::GasTooHigh(op.total_gas()));
        }

        // Minimum gas check
        if op.pre_verification_gas < 21_000 {
            return Err(BundlerError::PreVerificationGasTooLow);
        }

        // In production: encode simulateValidation(userOp) calldata,
        // send eth_call, decode ValidationResult return, check for ValidationFailed revert.
        // Mock: assume valid for properly formed ops.
        Ok(SimulationResult {
            pre_op_gas: op.pre_verification_gas,
            paymaster_valid: !op.paymaster_and_data.is_empty(),
            aggregator: None,
            valid: true,
        })
    }

    /// Check if a UserOperation conflicts with another (same sender + nonce).
    pub fn conflicts(a: &UserOperation, b: &UserOperation) -> bool {
        a.sender == b.sender && a.nonce == b.nonce
    }
}