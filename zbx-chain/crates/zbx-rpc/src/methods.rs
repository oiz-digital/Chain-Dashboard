//! JSON-RPC method dispatch table.
//!
//! This module wires method name strings to handler functions.  All
//! `eth_*`, `net_*`, `web3_*`, and `zbx_*` methods are registered here
//! so the server has a single source-of-truth for the full method set.
//!
//! ## Handler signature convention
//!
//! All handlers take `(&RpcState, Vec<Value>) -> Result<Value, RpcError>`.
//! The `params` vector is passed in as-is from the parsed JSON-RPC request;
//! each handler is responsible for extracting and validating its own params.
//!
//! ## Batch-request gas cap
//!
//! Handlers that invoke the EVM (`eth_call`, `eth_estimateGas`) must call
//! `set_batch_budget` / `batch_budget_consume` (see `eth_api.rs`) rather
//! than executing unbounded gas directly.  The method table enforces this
//! at the dispatch layer by tagging each method with a `MethodClass` so
//! the server can apply the batch budget before calling the handler.

use crate::{
    error::RpcError,
    eth_api,
    state::RpcState,
    zbx_api,
};
use serde_json::Value;
use std::collections::HashMap;

// ── Method class ─────────────────────────────────────────────────────────────

/// Classification used to apply per-batch caps and auth checks.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MethodClass {
    /// Read-only query — no EVM execution.
    ReadOnly,
    /// EVM simulation (eth_call, eth_estimateGas) — subject to gas cap.
    Simulation,
    /// Mutates mempool (eth_sendRawTransaction) — rate-limited per IP.
    Mutation,
    /// Admin / debug — restricted to localhost or auth header.
    Admin,
}

// ── Method descriptor ─────────────────────────────────────────────────────────

pub type HandlerFn = fn(&RpcState, Vec<Value>) -> Result<Value, RpcError>;

pub struct MethodDescriptor {
    pub name: &'static str,
    pub class: MethodClass,
    pub handler: HandlerFn,
}

// ── Method table ─────────────────────────────────────────────────────────────

/// Build the complete method dispatch table.
///
/// Returns a `HashMap<&'static str, MethodDescriptor>` keyed by method name.
pub fn build_method_table() -> HashMap<&'static str, MethodDescriptor> {
    let methods: &[MethodDescriptor] = &[
        // ── web3 / net ──────────────────────────────────────────────────────
        MethodDescriptor {
            name: "web3_clientVersion",
            class: MethodClass::ReadOnly,
            handler: eth_api::web3_client_version,
        },
        MethodDescriptor {
            name: "web3_sha3",
            class: MethodClass::ReadOnly,
            handler: eth_api::web3_sha3,
        },
        MethodDescriptor {
            name: "net_version",
            class: MethodClass::ReadOnly,
            handler: eth_api::net_version,
        },
        MethodDescriptor {
            name: "net_listening",
            class: MethodClass::ReadOnly,
            handler: eth_api::net_listening,
        },
        MethodDescriptor {
            name: "net_peerCount",
            class: MethodClass::ReadOnly,
            handler: eth_api::net_peer_count,
        },
        // ── eth — block / chain state ────────────────────────────────────────
        MethodDescriptor {
            name: "eth_chainId",
            class: MethodClass::ReadOnly,
            handler: eth_api::eth_chain_id,
        },
        MethodDescriptor {
            name: "eth_blockNumber",
            class: MethodClass::ReadOnly,
            handler: eth_api::eth_block_number,
        },
        MethodDescriptor {
            name: "eth_getBlockByNumber",
            class: MethodClass::ReadOnly,
            handler: eth_api::eth_get_block_by_number,
        },
        MethodDescriptor {
            name: "eth_getBlockByHash",
            class: MethodClass::ReadOnly,
            handler: eth_api::eth_get_block_by_hash,
        },
        MethodDescriptor {
            name: "eth_getBlockTransactionCountByNumber",
            class: MethodClass::ReadOnly,
            handler: eth_api::eth_get_block_tx_count_by_number,
        },
        MethodDescriptor {
            name: "eth_getBlockTransactionCountByHash",
            class: MethodClass::ReadOnly,
            handler: eth_api::eth_get_block_tx_count_by_hash,
        },
        // ── eth — account ────────────────────────────────────────────────────
        MethodDescriptor {
            name: "eth_getBalance",
            class: MethodClass::ReadOnly,
            handler: eth_api::eth_get_balance,
        },
        MethodDescriptor {
            name: "eth_getTransactionCount",
            class: MethodClass::ReadOnly,
            handler: eth_api::eth_get_transaction_count,
        },
        MethodDescriptor {
            name: "eth_getCode",
            class: MethodClass::ReadOnly,
            handler: eth_api::eth_get_code,
        },
        MethodDescriptor {
            name: "eth_getStorageAt",
            class: MethodClass::ReadOnly,
            handler: eth_api::eth_get_storage_at,
        },
        // ── eth — transaction ────────────────────────────────────────────────
        MethodDescriptor {
            name: "eth_getTransactionByHash",
            class: MethodClass::ReadOnly,
            handler: eth_api::eth_get_transaction_by_hash,
        },
        MethodDescriptor {
            name: "eth_getTransactionByBlockNumberAndIndex",
            class: MethodClass::ReadOnly,
            handler: eth_api::eth_get_transaction_by_block_number_and_index,
        },
        MethodDescriptor {
            name: "eth_getTransactionByBlockHashAndIndex",
            class: MethodClass::ReadOnly,
            handler: eth_api::eth_get_transaction_by_block_hash_and_index,
        },
        MethodDescriptor {
            name: "eth_getTransactionReceipt",
            class: MethodClass::ReadOnly,
            handler: eth_api::eth_get_transaction_receipt,
        },
        MethodDescriptor {
            name: "eth_sendRawTransaction",
            class: MethodClass::Mutation,
            handler: eth_api::eth_send_raw_transaction,
        },
        // ── eth — simulation ─────────────────────────────────────────────────
        MethodDescriptor {
            name: "eth_call",
            class: MethodClass::Simulation,
            handler: eth_api::eth_call,
        },
        MethodDescriptor {
            name: "eth_estimateGas",
            class: MethodClass::Simulation,
            handler: eth_api::eth_estimate_gas,
        },
        // ── eth — fee / gas ──────────────────────────────────────────────────
        MethodDescriptor {
            name: "eth_gasPrice",
            class: MethodClass::ReadOnly,
            handler: eth_api::eth_gas_price,
        },
        MethodDescriptor {
            name: "eth_maxPriorityFeePerGas",
            class: MethodClass::ReadOnly,
            handler: eth_api::eth_max_priority_fee_per_gas,
        },
        MethodDescriptor {
            name: "eth_feeHistory",
            class: MethodClass::ReadOnly,
            handler: eth_api::eth_fee_history,
        },
        // ── eth — logs ───────────────────────────────────────────────────────
        MethodDescriptor {
            name: "eth_getLogs",
            class: MethodClass::ReadOnly,
            handler: eth_api::eth_get_logs,
        },
        MethodDescriptor {
            name: "eth_newFilter",
            class: MethodClass::ReadOnly,
            handler: eth_api::eth_new_filter,
        },
        MethodDescriptor {
            name: "eth_newBlockFilter",
            class: MethodClass::ReadOnly,
            handler: eth_api::eth_new_block_filter,
        },
        MethodDescriptor {
            name: "eth_getFilterChanges",
            class: MethodClass::ReadOnly,
            handler: eth_api::eth_get_filter_changes,
        },
        MethodDescriptor {
            name: "eth_uninstallFilter",
            class: MethodClass::ReadOnly,
            handler: eth_api::eth_uninstall_filter,
        },
        // ── eth — misc ───────────────────────────────────────────────────────
        MethodDescriptor {
            name: "eth_syncing",
            class: MethodClass::ReadOnly,
            handler: eth_api::eth_syncing,
        },
        MethodDescriptor {
            name: "eth_mining",
            class: MethodClass::ReadOnly,
            handler: eth_api::eth_mining,
        },
        MethodDescriptor {
            name: "eth_accounts",
            class: MethodClass::ReadOnly,
            handler: eth_api::eth_accounts,
        },
        MethodDescriptor {
            name: "eth_sign",
            class: MethodClass::ReadOnly,
            handler: eth_api::eth_sign,
        },
        // ── zbx — staking ────────────────────────────────────────────────────
        MethodDescriptor {
            name: "zbx_getValidators",
            class: MethodClass::ReadOnly,
            handler: zbx_api::zbx_get_validators,
        },
        MethodDescriptor {
            name: "zbx_getValidatorInfo",
            class: MethodClass::ReadOnly,
            handler: zbx_api::zbx_get_validator_info,
        },
        MethodDescriptor {
            name: "zbx_getDelegations",
            class: MethodClass::ReadOnly,
            handler: zbx_api::zbx_get_delegations,
        },
        MethodDescriptor {
            name: "zbx_getStakingRewards",
            class: MethodClass::ReadOnly,
            handler: zbx_api::zbx_get_staking_rewards,
        },
        // ── zbx — bridge ─────────────────────────────────────────────────────
        MethodDescriptor {
            name: "zbx_getBridgePendingDeposits",
            class: MethodClass::ReadOnly,
            handler: zbx_api::zbx_get_bridge_pending_deposits,
        },
        MethodDescriptor {
            name: "zbx_getBridgeStatus",
            class: MethodClass::ReadOnly,
            handler: zbx_api::zbx_get_bridge_status,
        },
        // ── zbx — node / network ─────────────────────────────────────────────
        MethodDescriptor {
            name: "zbx_nodeInfo",
            class: MethodClass::ReadOnly,
            handler: zbx_api::zbx_node_info,
        },
        MethodDescriptor {
            name: "zbx_networkId",
            class: MethodClass::ReadOnly,
            handler: zbx_api::zbx_network_id,
        },
        // ── zbx — ZK / prover ────────────────────────────────────────────────
        MethodDescriptor {
            name: "zbx_getProofStatus",
            class: MethodClass::ReadOnly,
            handler: zbx_api::zbx_get_proof_status,
        },
        // ── zbx — AI precompile ───────────────────────────────────────────────
        MethodDescriptor {
            name: "zbx_aiInference",
            class: MethodClass::Simulation,
            handler: zbx_api::zbx_ai_inference,
        },
    ];

    methods
        .iter()
        .map(|m| {
            (
                m.name,
                MethodDescriptor {
                    name: m.name,
                    class: m.class,
                    handler: m.handler,
                },
            )
        })
        .collect()
}

// ── Dispatch ─────────────────────────────────────────────────────────────────

/// Lazy-initialised global method table.
static METHOD_TABLE: std::sync::OnceLock<HashMap<&'static str, MethodDescriptor>> =
    std::sync::OnceLock::new();

/// Dispatch a JSON-RPC method call.
///
/// Returns `Err(RpcError::MethodNotFound)` for unknown methods.
pub fn dispatch(
    method: &str,
    params: Vec<Value>,
    state: &RpcState,
) -> Result<Value, RpcError> {
    let table = METHOD_TABLE.get_or_init(build_method_table);
    match table.get(method) {
        Some(desc) => (desc.handler)(state, params),
        None => Err(RpcError::MethodNotFound(method.to_string())),
    }
}

/// Check whether a method is a simulation method (subject to gas cap).
pub fn is_simulation(method: &str) -> bool {
    let table = METHOD_TABLE.get_or_init(build_method_table);
    table
        .get(method)
        .map(|d| d.class == MethodClass::Simulation)
        .unwrap_or(false)
}

/// Check whether a method is a mutation (subject to rate-limiting).
pub fn is_mutation(method: &str) -> bool {
    let table = METHOD_TABLE.get_or_init(build_method_table);
    table
        .get(method)
        .map(|d| d.class == MethodClass::Mutation)
        .unwrap_or(false)
}

/// Returns all registered method names (sorted alphabetically).
pub fn all_method_names() -> Vec<&'static str> {
    let table = METHOD_TABLE.get_or_init(build_method_table);
    let mut names: Vec<&'static str> = table.keys().copied().collect();
    names.sort_unstable();
    names
}
