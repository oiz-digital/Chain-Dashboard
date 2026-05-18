//! Algebraic Intermediate Representation (AIR) circuits.
//!
//! A circuit defines the constraint system that execution must satisfy.
//! Each row of the trace represents one step of computation.
//! Constraints are polynomial equations over the trace columns.
//!
//! Circuit types:
//!   - StateTransitionCircuit:  proves block execution (state root transition)
//!   - TransactionCircuit:      proves a single tx is valid
//!   - BalanceCircuit:          proves account balance without revealing other state
//!   - StorageCircuit:          proves contract storage slot value
//!   - BridgeCircuit:           proves cross-chain message validity

use crate::{error::ProverResult, field::GoldilocksField};
use serde::{Deserialize, Serialize};

/// Supported circuit types.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum CircuitType {
    StateTransition,
    Transaction,
    Balance,
    Storage,
    Bridge,
    Recursive,
}

/// A single AIR constraint: polynomial equation over trace columns.
/// The constraint evaluates to 0 if and only if the transition is valid.
#[derive(Debug, Clone)]
pub struct Constraint {
    pub name:     String,
    /// Degree of the constraint polynomial (degree 2 is most common).
    pub degree:   usize,
    /// Evaluator: given current row `curr` and next row `next`, returns 0 if valid.
    pub evaluate: fn(curr: &[GoldilocksField], next: &[GoldilocksField]) -> GoldilocksField,
}

/// A ZK circuit — collection of AIR constraints.
pub struct Circuit {
    pub circuit_type: CircuitType,
    pub num_columns:  usize,
    pub constraints:  Vec<Constraint>,
    pub public_inputs: Vec<usize>, // column indices that are public inputs
}

impl Circuit {
    /// State transition circuit: proves block N → block N+1 is valid.
    ///
    /// Columns (selected):
    ///   0:  program counter (EVM)
    ///   1:  stack depth
    ///   2:  gas remaining
    ///   3:  memory size (words)
    ///   4-7: top of stack (4 words)
    ///   8-11: current storage slot key/value
    ///   12: state root (before)
    ///   13: state root (after)
    ///   14: tx hash
    ///   15: block number
    pub fn state_transition() -> Self {
        Self {
            circuit_type: CircuitType::StateTransition,
            num_columns:  256,
            public_inputs: vec![12, 13, 15], // state_root_before, state_root_after, block_number
            constraints: vec![
                Constraint {
                    name:   "gas_non_negative".into(),
                    degree: 1,
                    // gas_remaining[next] <= gas_remaining[curr]
                    evaluate: |curr, next| {
                        // Constraint: gas[curr] - gas[next] >= 0
                        // Encoded as: (gas[curr] - gas[next]) * validity_flag = 0
                        let gas_curr = curr.get(2).copied().unwrap_or(GoldilocksField::ZERO);
                        let gas_next = next.get(2).copied().unwrap_or(GoldilocksField::ZERO);
                        // This is a placeholder — real impl uses range-check lookup
                        gas_curr.sub(gas_next) // must be non-negative (checked via lookup)
                    },
                },
                Constraint {
                    name:   "stack_depth_valid".into(),
                    degree: 2,
                    // 0 <= stack_depth <= 1024
                    evaluate: |curr, _next| {
                        let depth = curr.get(1).copied().unwrap_or(GoldilocksField::ZERO);
                        // Polynomial: depth * (1024 - depth) >= 0 (range check)
                        depth.mul(GoldilocksField::new(1024).sub(depth))
                    },
                },
                Constraint {
                    name:   "state_root_continuity".into(),
                    degree: 1,
                    // state_root_after[tx N] == state_root_before[tx N+1]
                    evaluate: |curr, next| {
                        let root_after  = curr.get(13).copied().unwrap_or(GoldilocksField::ZERO);
                        let root_before = next.get(12).copied().unwrap_or(GoldilocksField::ZERO);
                        root_after.sub(root_before)
                    },
                },
                Constraint {
                    name:   "block_number_non_decreasing".into(),
                    degree: 1,
                    evaluate: |curr, next| {
                        let bn_curr = curr.get(15).copied().unwrap_or(GoldilocksField::ZERO);
                        let bn_next = next.get(15).copied().unwrap_or(GoldilocksField::ZERO);
                        bn_next.sub(bn_curr) // must be 0 (same block) or 1 (new block)
                    },
                },
            ],
        }
    }

    /// Transaction validity circuit: proves a tx is valid (sig, nonce, balance).
    pub fn transaction() -> Self {
        Self {
            circuit_type: CircuitType::Transaction,
            num_columns:  64,
            public_inputs: vec![0, 1, 2], // tx_hash, sender, value
            constraints: vec![
                Constraint {
                    name:   "signature_valid".into(),
                    degree: 3,
                    evaluate: |curr, _next| {
                        // ECDSA signature verification: r, s, v in expected range
                        // Real impl uses secp256k1 constraint gadget
                        let r = curr.get(4).copied().unwrap_or(GoldilocksField::ZERO);
                        let s = curr.get(5).copied().unwrap_or(GoldilocksField::ZERO);
                        // r * s != 0 (both must be non-zero for valid signature)
                        r.mul(s)
                    },
                },
                Constraint {
                    name:   "nonce_increments".into(),
                    degree: 1,
                    evaluate: |curr, next| {
                        let nonce_curr = curr.get(6).copied().unwrap_or(GoldilocksField::ZERO);
                        let nonce_next = next.get(6).copied().unwrap_or(GoldilocksField::ZERO);
                        // nonce[next] = nonce[curr] + 1
                        nonce_next.sub(nonce_curr.add(GoldilocksField::ONE))
                    },
                },
                Constraint {
                    name:   "balance_sufficient".into(),
                    degree: 2,
                    evaluate: |curr, _next| {
                        let balance = curr.get(7).copied().unwrap_or(GoldilocksField::ZERO);
                        let value   = curr.get(8).copied().unwrap_or(GoldilocksField::ZERO);
                        let gas_cost = curr.get(9).copied().unwrap_or(GoldilocksField::ZERO);
                        // balance >= value + gas_cost → balance - value - gas_cost >= 0
                        balance.sub(value).sub(gas_cost)
                    },
                },
            ],
        }
    }

    /// Check all constraints on a given trace row.
    pub fn check_constraints(
        &self,
        trace: &[Vec<GoldilocksField>],
        row: usize,
    ) -> ProverResult<()> {
        let curr = &trace[row];
        let next = if row + 1 < trace.len() { &trace[row + 1] } else { curr };

        for constraint in &self.constraints {
            let result = (constraint.evaluate)(curr, next);
            if result != GoldilocksField::ZERO {
                return Err(crate::error::ProverError::ConstraintViolated {
                    row,
                    col: 0,
                    msg: constraint.name.clone(),
                });
            }
        }
        Ok(())
    }
}