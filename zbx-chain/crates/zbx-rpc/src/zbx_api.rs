//! Zebvix-native JSON-RPC methods (zbx_* namespace).

use crate::{error::RpcError, state::RpcState};
use zbx_types::{TOTAL_SUPPLY, INITIAL_BLOCK_REWARD};
use zbx_staking::validator::ValidatorStatus;
use serde_json::{json, Value};
use tracing::debug;

/// Dispatch a zbx_* method call.
pub fn dispatch_zbx(method: &str, params: &Value, state: &RpcState) -> Result<Value, RpcError> {
    debug!(method, "zbx_* RPC call");
    match method {
        "zbx_getChainInfo"           => zbx_get_chain_info(state),
        "zbx_getValidatorSet"        => zbx_get_validator_set(params, state),
        "zbx_getStakingInfo"         => zbx_get_staking_info(params, state),
        "zbx_getBridgeInfo"          => zbx_get_bridge_info(),
        "zbx_getBlockReward"         => zbx_get_block_reward(params),
        "zbx_getEpochInfo"           => zbx_get_epoch_info(),
        "zbx_proposeGovernance"      => zbx_propose_governance(params),
        "zbx_getGovernanceProposal"  => zbx_get_governance_proposal(params),
        // ── Native Cross-Chain Layer (XCL) ──────────────────────────────
        "zbx_xcl_getInfo"            => xcl_get_info(),
        "zbx_xcl_getChannels"        => xcl_get_channels(),
        "zbx_xcl_getChannel"         => xcl_get_channel(params),
        "zbx_xcl_getClients"         => xcl_get_clients(),
        "zbx_xcl_getClient"          => xcl_get_client(params),
        "zbx_xcl_sendPacket"         => xcl_send_packet(params),
        "zbx_xcl_getPacketStatus"    => xcl_get_packet_status(params),
        "zbx_xcl_getRelayStats"      => xcl_get_relay_stats(),
        "zbx_sendStakingTx"          => zbx_send_staking_tx(params, state),
        _ => Err(RpcError::MethodNotFound(method.to_string())),
    }
}

/// `zbx_sendStakingTx(rawTx)` — submit a staking transaction.
///
/// The transaction MUST:
/// - be a normal EIP-1559 / legacy / EIP-2930 signed tx,
/// - target `to == STAKING_PRECOMPILE_ADDR (0x...0888)`,
/// - carry an RLP-encoded `StakingTx` in `data` (canonical wire format),
/// - be signed under this node's `chain_id`.
///
/// We validate destination + payload up-front to surface errors at RPC
/// time, then submit through the same mempool path as
/// `eth_sendRawTransaction` (including P2P relay).
fn zbx_send_staking_tx(params: &Value, state: &RpcState) -> Result<Value, RpcError> {
    let raw = params
        .get(0)
        .and_then(Value::as_str)
        .ok_or_else(|| RpcError::InvalidParams("missing rawTransaction".into()))?;
    let stripped = raw.strip_prefix("0x").unwrap_or(raw);
    let bytes = hex::decode(stripped)
        .map_err(|e| RpcError::InvalidParams(format!("hex: {e}")))?;

    let (signed_tx, eth_hash) = crate::tx_decode::decode_raw_tx(&bytes)?;

    if signed_tx.tx.chain_id != state.chain_id {
        return Err(RpcError::InvalidParams(format!(
            "wrong chainId (tx={}, node={})",
            signed_tx.tx.chain_id, state.chain_id
        )));
    }

    // Destination must be the staking precompile.
    if !zbx_staking::is_staking_destination(signed_tx.tx.to.as_ref()) {
        return Err(RpcError::InvalidParams(format!(
            "zbx_sendStakingTx: 'to' must be STAKING_PRECOMPILE_ADDR \
             (0x{}), got {:?}",
            hex::encode(zbx_types::staking_tx::STAKING_PRECOMPILE_ADDR.as_bytes()),
            signed_tx.tx.to
        )));
    }

    if let Err(e) = zbx_staking::decode_staking_call(signed_tx.tx.data.as_slice()) {
        return Err(RpcError::InvalidParams(format!(
            "zbx_sendStakingTx: malformed StakingTx payload: {e}"
        )));
    }

    let sender_acct = state
        .db
        .get_account(&signed_tx.from)
        .map_err(|e| RpcError::Internal(format!("storage get_account: {e}")))?;
    let sender_balance = sender_acct.balance_u128();
    let sender_nonce = sender_acct.nonce;

    let tx_for_relay = signed_tx.clone();
    let added = {
        let mut pool = state.mempool.write();
        pool.add_transaction(signed_tx, sender_balance, sender_nonce)
    };
    match added {
        Ok(_) => {
            let _ = state.tx_relay_tx.send(tx_for_relay);
            Ok(json!(format!("0x{}", hex::encode(eth_hash.as_bytes()))))
        }
        Err(e) => Err(RpcError::InvalidParams(format!("mempool: {e}"))),
    }
}

fn zbx_get_chain_info(state: &RpcState) -> Result<Value, RpcError> {
    Ok(json!({
        "chainId": state.chain_id,
        "latestBlock": state.latest_height(),
        "chainName": "Zebvix",
        "symbol": "ZBX",
        "decimals": 18,
        "totalSupply": TOTAL_SUPPLY.to_string(),
        "initialBlockReward": INITIAL_BLOCK_REWARD.to_string(),
        "halvingInterval": zbx_types::HALVING_INTERVAL,
        "blockGasLimit": zbx_types::BLOCK_GAS_LIMIT,
        "consensusMechanism": "HotStuff-BFT",
        "targetBlockTime": 2,
        "evmCompatible": true
    }))
}

fn zbx_get_validator_set(_params: &Value, state: &RpcState) -> Result<Value, RpcError> {
    let vs = state.validator_set.read();
    let latest_height = state.latest_height();
    let epoch = latest_height / zbx_staking::EPOCH_LENGTH;

    let validators: Vec<serde_json::Value> = vs.active_set.iter().filter_map(|addr| {
        vs.validators.get(addr).map(|v| {
            let addr_hex = format!("0x{}", hex::encode(addr.as_bytes()));
            let jailed = matches!(v.status, ValidatorStatus::Jailed);
            json!({
                "address":         addr_hex,
                "totalStake":      v.total_stake().to_string(),
                "selfStake":       v.self_stake.to_string(),
                "delegated":       v.delegated_stake.to_string(),
                "commissionBps":   v.commission_bps,
                "status":          format!("{:?}", v.status),
                "jailed":          jailed,
                "registeredEpoch": v.registered_epoch,
            })
        })
    }).collect();

    let total_stake: u128 = vs.active_set.iter()
        .filter_map(|a| vs.validators.get(a).map(|v| v.total_stake()))
        .sum();

    let quorum = if validators.is_empty() {
        0
    } else {
        (validators.len() * 2) / 3 + 1   // 2/3 + 1 BFT quorum
    };

    Ok(json!({
        "epoch":        epoch,
        "validators":   validators,
        "quorum":       quorum,
        "totalStake":   total_stake.to_string(),
        "maxValidators": zbx_staking::MAX_VALIDATORS,
        "epochLength":   zbx_staking::EPOCH_LENGTH,
    }))
}

fn zbx_get_staking_info(params: &Value, state: &RpcState) -> Result<Value, RpcError> {
    let addr_s = params.get(0).and_then(Value::as_str).unwrap_or("0x0");
    let addr = zbx_types::address::Address::from_hex(addr_s)
        .map_err(|e| RpcError::InvalidParams(format!("address: {e}")))?;

    let vs = state.validator_set.read();

    if let Some(v) = vs.validators.get(&addr) {
        let addr_hex = format!("0x{}", hex::encode(addr.as_bytes()));
        let jailed = matches!(v.status, ValidatorStatus::Jailed);
        Ok(json!({
            "address":         addr_hex,
            "selfStake":       v.self_stake.to_string(),
            "delegatedStake":  v.delegated_stake.to_string(),
            "totalStake":      v.total_stake().to_string(),
            "commissionBps":   v.commission_bps,
            "pendingRewards":  v.pending_rewards.to_string(),
            "status":          format!("{:?}", v.status),
            "jailed":          jailed,
            "registeredEpoch": v.registered_epoch,
            "inActiveSet":     vs.active_set.contains(&addr),
        }))
    } else {
        Ok(json!({
            "address":        addr_s,
            "selfStake":      "0",
            "delegatedStake": "0",
            "totalStake":     "0",
            "commission":     0,
            "pendingRewards": "0",
            "status":         "NotRegistered",
            "jailed":         false,
            "epochJoined":    0,
            "inActiveSet":    false,
        }))
    }
}

fn zbx_get_bridge_info() -> Result<Value, RpcError> {
    Ok(json!({
        "supported_chains": [
            { "chainId": 1,   "name": "Ethereum",  "symbol": "ETH" },
            { "chainId": 56,  "name": "BSC",        "symbol": "BNB" },
            { "chainId": 137, "name": "Polygon",    "symbol": "MATIC" }
        ],
        "min_bridge_amount": "1000000000000000000",
        "bridge_fee_bps": 10,
        "multisig_threshold": "3/5"
    }))
}

fn zbx_get_block_reward(params: &Value) -> Result<Value, RpcError> {
    let height = params.get(0)
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    let reward = zbx_types::block_reward_at(height);
    Ok(json!({
        "height": height,
        "reward": reward.to_string(),
        "halving_epoch": height / zbx_types::HALVING_INTERVAL
    }))
}

fn zbx_get_epoch_info() -> Result<Value, RpcError> {
    Ok(json!({
        "current_epoch": 1,
        "epoch_length_blocks": 172800,
        "blocks_until_next_epoch": 172799,
        "validator_rotation": true
    }))
}

fn zbx_propose_governance(_params: &Value) -> Result<Value, RpcError> {
    Err(RpcError::Internal("governance not yet initialized".into()))
}

fn zbx_get_governance_proposal(_params: &Value) -> Result<Value, RpcError> {
    Ok(Value::Null)
}

// ─────────────────────────────────────────────────────────────────────────────
// Native Cross-Chain Layer (XCL) — zbx_xcl_* methods
//
// These expose the protocol-level cross-chain state to wallets, explorers,
// and relayer daemons.  No bridge operators, no multisig — all operations are
// verified by BLS light-client proofs + MPT Merkle proofs.
// ─────────────────────────────────────────────────────────────────────────────

/// `zbx_xcl_getInfo` — XCL protocol overview and feature flags.
fn xcl_get_info() -> Result<Value, RpcError> {
    Ok(json!({
        "protocol": "zbx-xcl/1",
        "description": "Native Cross-Chain Layer — trustless, bridge-free interoperability",
        "trustModel": "Light-client BLS12-381 proofs + Merkle Patricia Trie state proofs",
        "noBridgeOperators": true,
        "noWrappedTokens": true,
        "supplyConserved": true,
        "permissionlessRelay": true,
        "packetLifecycle": ["send_packet", "recv_packet", "ack_packet", "timeout_packet"],
        "evmPrecompile": {
            "address": "0x000000000000000000000000000000000000000b",
            "function": "xcl_send(bytes32 channel, bytes32 receiver, uint128 amount, uint64 timeout_height) returns (uint64 sequence)"
        },
        "supportedChains": [
            { "chainId": 8989, "name": "Zebvix Mainnet",  "role": "home"         },
            { "chainId": 8990, "name": "Zebvix Testnet",  "role": "counterparty" }
        ],
        "commitmentScheme": "keccak256(canonical_packet_bytes)",
        "ackScheme":        "keccak256(ack_bytes)",
        "trieKeyPrefix":    "xcl/"
    }))
}

/// `zbx_xcl_getChannels` — list all registered channels.
fn xcl_get_channels() -> Result<Value, RpcError> {
    Ok(json!({
        "channels": [],
        "note": "Channels are registered at genesis or via on-chain governance."
    }))
}

/// `zbx_xcl_getChannel` — get a specific channel by hex ID.
///
/// Params: `[channel_id_hex]`
fn xcl_get_channel(params: &Value) -> Result<Value, RpcError> {
    let id = params.get(0)
        .and_then(Value::as_str)
        .ok_or_else(|| RpcError::InvalidParams("missing channel_id".into()))?;

    Ok(json!({
        "channelId":             id,
        "state":                 "Open",
        "ordering":              "Unordered",
        "counterpartyChainId":   null,
        "counterpartyChannel":   null,
        "nextSeqSend":           1,
        "nextSeqRecv":           1,
        "nextSeqAck":            1,
        "note": "Full channel state available after XCL genesis initialization."
    }))
}

/// `zbx_xcl_getClients` — list all registered foreign-chain light clients.
fn xcl_get_clients() -> Result<Value, RpcError> {
    Ok(json!({
        "clients": [],
        "note": "Light clients are registered per connected counterparty chain."
    }))
}

/// `zbx_xcl_getClient` — get a foreign-chain light client by hex ID.
///
/// Params: `[client_id_hex]`
fn xcl_get_client(params: &Value) -> Result<Value, RpcError> {
    let id = params.get(0)
        .and_then(Value::as_str)
        .ok_or_else(|| RpcError::InvalidParams("missing client_id".into()))?;

    Ok(json!({
        "clientId":      id,
        "chainId":       null,
        "latestHeight":  0,
        "hasValidators": false,
        "trustModel":    "BLS12-381 aggregate signature + 2f+1 quorum",
        "note": "Client state populated once foreign-chain headers are submitted."
    }))
}

/// `zbx_xcl_sendPacket` — construct a cross-chain send transaction.
///
/// Params: `[{ channel, sender, receiver, amount, denom, timeout_height, memo }]`
///
/// Returns the unsigned transaction data that should be signed and submitted
/// via `eth_sendRawTransaction`.
fn xcl_send_packet(params: &Value) -> Result<Value, RpcError> {
    let obj = params.get(0)
        .ok_or_else(|| RpcError::InvalidParams("missing send params object".into()))?;

    let channel  = obj.get("channel").and_then(Value::as_str).unwrap_or("");
    let sender   = obj.get("sender").and_then(Value::as_str).unwrap_or("0x0");
    let receiver = obj.get("receiver").and_then(Value::as_str).unwrap_or("0x0");
    let amount   = obj.get("amount").and_then(Value::as_str).unwrap_or("0");
    let denom    = obj.get("denom").and_then(Value::as_str).unwrap_or("ZBX");
    let timeout  = obj.get("timeout_height").and_then(Value::as_u64).unwrap_or(0);
    let memo     = obj.get("memo").and_then(Value::as_str).unwrap_or("");

    Ok(json!({
        "protocol":       "zbx-xcl/1",
        "action":         "send_packet",
        "channelId":      channel,
        "sender":         sender,
        "receiver":       receiver,
        "amount":         amount,
        "denom":          denom,
        "timeoutHeight":  timeout,
        "memo":           memo,
        "evm_precompile": {
            "address":  "0x000000000000000000000000000000000000000b",
            "calldata": "Use xcl_send(channel, receiver, amount, timeout_height)"
        },
        "note": "Submit via eth_sendRawTransaction calling the XCL precompile at 0x0b."
    }))
}

/// `zbx_xcl_getPacketStatus` — check the status of a sent packet.
///
/// Params: `[channel_id_hex, sequence]`
fn xcl_get_packet_status(params: &Value) -> Result<Value, RpcError> {
    let channel = params.get(0)
        .and_then(Value::as_str)
        .ok_or_else(|| RpcError::InvalidParams("missing channel_id".into()))?;
    let sequence = params.get(1)
        .and_then(Value::as_u64)
        .ok_or_else(|| RpcError::InvalidParams("missing sequence".into()))?;

    Ok(json!({
        "channelId": channel,
        "sequence":  sequence,
        "status":    "Unknown",
        "note":      "Full packet tracking available after XCL state is initialized."
    }))
}

/// `zbx_xcl_getRelayStats` — relay queue statistics.
fn xcl_get_relay_stats() -> Result<Value, RpcError> {
    Ok(json!({
        "pendingRecv":    0,
        "pendingAck":     0,
        "pendingTimeout": 0,
        "totalRelayed":   0,
        "note": "Permissionless relay — any full node can relay proofs."
    }))
}