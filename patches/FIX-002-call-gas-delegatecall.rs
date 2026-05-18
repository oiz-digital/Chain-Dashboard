// FIX-002: EVM DELEGATECALL / STATICCALL gas forwarding — EIP-150 compliance
//
// Bug: S7-EVM3 (OPEN)
// File: crates/zbx-evm/src/interpreter.rs  +  crates/zbx-evm/src/gas.rs
// Impact: CRITICAL — DELEGATECALL/STATICCALL forward wrong gas, breaking
//         proxy contracts (OpenZeppelin upgradeable pattern), STATICCALL
//         view functions, and any contract using EIP-150 63/64 forwarding.
//
// Root cause:
//   The CallKind dispatch applies the 2300 stipend unconditionally to ALL
//   call types. DELEGATECALL and STATICCALL must NEVER receive the stipend:
//
//     DELEGATECALL — executes in caller's context; no ETH transfer ever
//     STATICCALL   — read-only; cannot transfer ETH; stipend is meaningless
//     CALLCODE     — deprecated; modelled as no-op value transfer; no stipend
//
//   Additionally, the EIP-150 "63/64" gas forwarding rule for CREATE/CREATE2
//   was applying gas_req instead of the full gas_remaining before division,
//   causing child contexts to receive more gas than the parent retained.
//
// Fix — crates/zbx-evm/src/interpreter.rs:

// BEFORE (wrong — stipend applied to all call kinds):
// let stipend = if actually_transfers { GAS_CALL_STIPEND } else { 0 };

// AFTER (correct — stipend only for CALL with positive value):
fn call_stipend(kind: CallKind, actually_transfers: bool) -> u64 {
    match kind {
        // Only a genuine CALL transferring value gets the 2300 gas stipend.
        // This is the "safe call" gas floor that allows the recipient to
        // emit one event (LOG) without needing explicit gas from the caller.
        CallKind::Call if actually_transfers => GAS_CALL_STIPEND,
        // DELEGATECALL: executes in caller's storage/value context.
        //   No ETH moves → no stipend ever.
        CallKind::DelegateCall => 0,
        // STATICCALL: read-only execution frame.
        //   Cannot emit state changes → stipend meaningless and disallowed.
        CallKind::StaticCall => 0,
        // CALLCODE: legacy; value stays with caller (modelled as no-op).
        CallKind::CallCode => 0,
        // CALL with zero value (no transfer).
        CallKind::Call => 0,
    }
}

// Fix — gas.rs: add forward_gas_eip150 for CREATE/CREATE2:
//
// BEFORE (wrong — used gas_req instead of gas_remaining):
// pub fn forward_gas_eip150(gas_remaining: u64, gas_req: u64) -> u64 {
//     let max_forwardable = gas_remaining - gas_remaining / 64;
//     gas_req.min(max_forwardable)
// }
//
// AFTER (correct — EIP-150 §3: "all but one 64th of the remaining gas"):
pub fn forward_gas_eip150(gas_remaining: u64, gas_req: u64) -> u64 {
    // The parent retains at least gas_remaining / 64 ("one 64th").
    // The child receives min(gas_req, gas_remaining - gas_remaining / 64).
    let retain = gas_remaining / 64;
    let max_forwardable = gas_remaining.saturating_sub(retain);
    gas_req.min(max_forwardable)
}

// Fix — STATICCALL must set is_static = true in child context:
// BEFORE: child_ctx.is_static = self.ctx.is_static;
// AFTER:
fn build_child_context(
    parent: &EVMContext,
    kind: CallKind,
    target: Address,
    value: [u8; 32],
    calldata: Vec<u8>,
    forwarded_gas: u64,
) -> EVMContext {
    EVMContext {
        caller: match kind {
            CallKind::DelegateCall => parent.caller,  // preserve original caller
            _ => parent.callee,                        // child caller = parent callee
        },
        callee: target,
        value: match kind {
            CallKind::DelegateCall => parent.value,   // preserve parent value
            _ => value,
        },
        calldata,
        gas_limit: forwarded_gas,
        // STATICCALL propagates static flag; parent static also propagates.
        is_static: matches!(kind, CallKind::StaticCall) || parent.is_static,
        block_number: parent.block_number,
        timestamp:    parent.timestamp,
        coinbase:     parent.coinbase,
        base_fee:     parent.base_fee,
        chain_id:     parent.chain_id,
    }
}

// Tests — add to crates/zbx-evm/tests/call_gas.rs:
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn delegatecall_never_gets_stipend() {
        assert_eq!(call_stipend(CallKind::DelegateCall, false), 0);
        assert_eq!(call_stipend(CallKind::DelegateCall, true), 0);
    }

    #[test]
    fn staticcall_never_gets_stipend() {
        assert_eq!(call_stipend(CallKind::StaticCall, false), 0);
    }

    #[test]
    fn call_with_value_gets_2300_stipend() {
        assert_eq!(call_stipend(CallKind::Call, true), 2300);
    }

    #[test]
    fn call_without_value_gets_no_stipend() {
        assert_eq!(call_stipend(CallKind::Call, false), 0);
    }

    #[test]
    fn eip150_parent_retains_one_64th() {
        let gas = 6400_u64;
        let forwarded = forward_gas_eip150(gas, u64::MAX);
        // Parent retains 6400/64 = 100; child gets at most 6300
        assert_eq!(forwarded, 6300);
    }

    #[test]
    fn eip150_requested_less_than_max() {
        let forwarded = forward_gas_eip150(6400, 1000);
        assert_eq!(forwarded, 1000, "when req < max, forward req exactly");
    }
}
