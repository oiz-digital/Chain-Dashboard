//! EVM precompiled contracts (addresses 0x01–0x0a).

use zbx_types::{Address, U256};
use sha2::{Sha256, Digest as Sha2Digest};
use sha3::Keccak256;
use ripemd::Ripemd160;

/// Result of a precompile execution.
pub type PrecompileResult = Result<(u64, Vec<u8>), PrecompileError>;

#[derive(Debug, thiserror::Error)]
pub enum PrecompileError {
    #[error("out of gas")]
    OutOfGas,
    #[error("invalid input")]
    InvalidInput,
    #[error("bn128 pairing failed")]
    BnPairingFailed,
    /// Precompile address dispatched to a function whose real implementation
    /// has not been written yet. Audit-2026-05-01 S7-VM3: previously the
    /// stub returned plausible-looking constants (zero curve points, `1`
    /// for pairing, zero-bytes for blake2f), which silently lied to every
    /// caller. Returning this variant makes the contract revert loudly so
    /// integrators cannot accidentally rely on fake output.
    #[error("precompile not implemented: {0}")]
    NotImplemented(&'static str),
}

/// Dispatch a precompile call by address.
pub fn call_precompile(
    address: Address,
    input: &[u8],
    gas_limit: u64,
) -> Option<PrecompileResult> {
    let addr_byte = address.as_bytes()[19];
    if address.as_bytes()[..19] != [0u8; 19] {
        return None; // Not a precompile.
    }
    match addr_byte {
        0x01 => Some(precompile_ecrecover(input, gas_limit)),
        0x02 => Some(precompile_sha256(input, gas_limit)),
        0x03 => Some(precompile_ripemd160(input, gas_limit)),
        0x04 => Some(precompile_identity(input, gas_limit)),
        0x05 => Some(precompile_modexp(input, gas_limit)),
        0x06 => Some(precompile_bn128_add(input, gas_limit)),
        0x07 => Some(precompile_bn128_mul(input, gas_limit)),
        0x08 => Some(precompile_bn128_pairing(input, gas_limit)),
        0x09 => Some(precompile_blake2f(input, gas_limit)),
        0x0a => Some(precompile_kzg_point_eval(input, gas_limit)), // EIP-4844
        _    => None,
    }
}

/// 0x01: ecrecover — signature recovery.
///
/// Audit-2026-05-01 S7-VM1: previous body parsed `hash/v/r/s` and then
/// returned `vec![0u8; 32]` regardless. Every Solidity contract on the
/// production VM that called precompile 0x01 received `address(0)`,
/// universally breaking `require(ecrecover(...) == owner)` and silently
/// failing-open whenever `owner` defaulted to zero (uninitialised storage,
/// pre-initialise admin slots, etc.). Wired through to
/// `zbx_crypto::secp256k1::recover_signer` — the same path zbx-evm uses.
/// Per the EVM spec, an invalid signature returns 32 zero bytes (and
/// charges the full 3000 gas) rather than reverting.
fn precompile_ecrecover(input: &[u8], gas_limit: u64) -> PrecompileResult {
    const GAS: u64 = 3_000;
    if gas_limit < GAS { return Err(PrecompileError::OutOfGas); }
    // EVM ecrecover input is right-padded to 128 bytes; per spec we treat
    // a short input as zero-padded, then validate the recovered key. If
    // anything is off (bad v, malformed sig, hash-to-key fails) we return
    // 32 zero bytes — this is observable behaviour real contracts depend on.
    let mut padded = [0u8; 128];
    let n = input.len().min(128);
    padded[..n].copy_from_slice(&input[..n]);

    let hash = zbx_types::H256::from_slice(&padded[0..32]);
    let v_byte = padded[63];
    // High 31 bytes of `v` must be zero per spec; if not, return zero.
    if padded[32..63].iter().any(|&b| b != 0) {
        return Ok((GAS, vec![0u8; 32]));
    }
    let r = zbx_types::H256::from_slice(&padded[64..96]);
    let s = zbx_types::H256::from_slice(&padded[96..128]);

    // Accept legacy {27, 28} and raw {0, 1}. Reject anything else.
    //
    // EVM-strict precompile 0x01 only accepts v in {27, 28}. We additionally
    // accept raw {0, 1} as a deliberate compatibility extension for callers
    // that produce un-shifted recovery ids; this is observable but cannot
    // increase the set of recoverable signatures (every (h,r,s,0/1) pair is
    // already recoverable as (h,r,s,27/28)) so it is a relaxation, not a
    // security regression. EIP-155 chain-id-encoded v is intentionally NOT
    // accepted here: at the precompile boundary, transaction-level chain-id
    // normalisation has already happened upstream in zbx-tx.
    let v_norm: u8 = match v_byte {
        27 | 28 => v_byte - 27,
        0 | 1   => v_byte,
        _       => return Ok((GAS, vec![0u8; 32])),
    };

    let sig = zbx_crypto::Signature { v: v_norm, r, s };
    match zbx_crypto::recover_signer(&hash, &sig) {
        Ok(addr) => {
            let mut out = vec![0u8; 32];
            out[12..].copy_from_slice(addr.as_bytes());
            Ok((GAS, out))
        }
        Err(_) => Ok((GAS, vec![0u8; 32])),
    }
}

/// 0x02: sha256 hash.
fn precompile_sha256(input: &[u8], gas_limit: u64) -> PrecompileResult {
    let gas = 60 + 12 * ((input.len() as u64 + 31) / 32);
    if gas_limit < gas { return Err(PrecompileError::OutOfGas); }
    let digest = Sha256::digest(input);
    Ok((gas, digest.to_vec()))
}

/// 0x03: ripemd160 hash.
fn precompile_ripemd160(input: &[u8], gas_limit: u64) -> PrecompileResult {
    let gas = 600 + 120 * ((input.len() as u64 + 31) / 32);
    if gas_limit < gas { return Err(PrecompileError::OutOfGas); }
    let digest = Ripemd160::digest(input);
    let mut out = vec![0u8; 32];
    out[12..32].copy_from_slice(&digest);
    Ok((gas, out))
}

/// 0x04: identity (data copy).
fn precompile_identity(input: &[u8], gas_limit: u64) -> PrecompileResult {
    let gas = 15 + 3 * ((input.len() as u64 + 31) / 32);
    if gas_limit < gas { return Err(PrecompileError::OutOfGas); }
    Ok((gas, input.to_vec()))
}

// ---------------------------------------------------------------------------
// Audit-2026-05-01 S7-VM3 — fail-explicit until real implementations land.
//
// Runtime gas semantics (see `interpreter.rs` precompile branch around line
// 147): on `Err(_)` the interpreter sets `gas_used = gas` (i.e. it consumes
// **all forwarded gas**, the standard EVM convention for precompile failures).
// Returning `Err(NotImplemented)` therefore costs the caller every wei of
// forwarded gas, which is strictly safe — there is no incentive to call an
// unimplemented precompile and no way to learn anything from a partial result.
// The early `gas_limit < cost` checks below still serve a purpose: they make
// the failure look like an `OutOfGas` revert when the caller could not have
// afforded the canonical cost in the first place, matching what they would
// see once the real implementation lands and reverts on the same condition.
//
// The pre-audit stubs returned plausible-looking values:
//
//   modexp        → vec![0u8; m_len]   (i.e. `0` mod m, accidentally correct
//                                        for some inputs, wrong for the rest)
//   bn128_add     → vec![0u8; 64]      (point at infinity for ANY input)
//   bn128_mul     → vec![0u8; 64]      (point at infinity for ANY input)
//   bn128_pairing → 32 bytes ending 01 (true for ANY input — every Groth16 /
//                                        zk-SNARK verifier on this VM accepted
//                                        every proof; CRITICAL silent fail-open)
//   blake2f       → vec![0u8; 64]      (plausible 64-byte hash, totally wrong)
//   kzg_eval      → vec![0u8; 64]      (would silently authorise blob txs)
//
// The replacements below all use `PrecompileError::NotImplemented`, which the
// VM surfaces as a contract revert. Real implementations are tracked in
// AUDIT_2026-04-30.md and require additional crates (substrate-bn / arkworks
// for bn128, num-bigint for modexp, blake2 for blake2f, c-kzg-4844 for KZG).
// ---------------------------------------------------------------------------

/// 0x05: modular exponentiation (EIP-198) — fail-explicit, see S7-VM3 above.
fn precompile_modexp(input: &[u8], gas_limit: u64) -> PrecompileResult {
    // EIP-2565 simplified gas: at least 200, scaled with input sizes when known.
    let gas = if input.len() < 96 {
        200u64
    } else {
        let b_len = usize::from_be_bytes(input[24..32].try_into().unwrap_or([0u8; 8])) as u64;
        let e_len = usize::from_be_bytes(input[56..64].try_into().unwrap_or([0u8; 8])) as u64;
        let m_len = usize::from_be_bytes(input[88..96].try_into().unwrap_or([0u8; 8])) as u64;
        ((b_len.max(m_len) + 7) / 8).pow(2).saturating_mul(e_len) / 3
    }
    .max(200);
    if gas_limit < gas { return Err(PrecompileError::OutOfGas); }
    Err(PrecompileError::NotImplemented("modexp (0x05)"))
}

/// 0x06: bn128 point addition (EIP-196) — fail-explicit, see S7-VM3 above.
fn precompile_bn128_add(_input: &[u8], gas_limit: u64) -> PrecompileResult {
    const GAS: u64 = 150;
    if gas_limit < GAS { return Err(PrecompileError::OutOfGas); }
    Err(PrecompileError::NotImplemented("bn128_add (0x06)"))
}

/// 0x07: bn128 scalar multiplication (EIP-196) — fail-explicit, see S7-VM3 above.
fn precompile_bn128_mul(_input: &[u8], gas_limit: u64) -> PrecompileResult {
    const GAS: u64 = 6_000;
    if gas_limit < GAS { return Err(PrecompileError::OutOfGas); }
    Err(PrecompileError::NotImplemented("bn128_mul (0x07)"))
}

/// 0x08: bn128 pairing check (EIP-197) — fail-explicit, see S7-VM3 above.
///
/// **Why this matters most:** the previous stub returned `1` (true) for every
/// input, so any zk-SNARK / Groth16 verifier built on EIP-197 would accept
/// **every** proof as valid. Returning `NotImplemented` reverts those calls.
fn precompile_bn128_pairing(input: &[u8], gas_limit: u64) -> PrecompileResult {
    let pairs = input.len() as u64 / 192;
    let gas = 45_000u64.saturating_add(34_000u64.saturating_mul(pairs));
    if gas_limit < gas { return Err(PrecompileError::OutOfGas); }
    Err(PrecompileError::NotImplemented("bn128_pairing (0x08)"))
}

/// 0x09: BLAKE2F (EIP-152) — fail-explicit, see S7-VM3 above.
fn precompile_blake2f(input: &[u8], gas_limit: u64) -> PrecompileResult {
    if input.len() != 213 { return Err(PrecompileError::InvalidInput); }
    let rounds = u32::from_be_bytes(input[0..4].try_into().unwrap_or_default());
    let gas = rounds as u64;
    if gas_limit < gas { return Err(PrecompileError::OutOfGas); }
    Err(PrecompileError::NotImplemented("blake2f (0x09)"))
}

/// 0x0a: KZG point evaluation (EIP-4844) — fail-explicit, see S7-VM3 above.
fn precompile_kzg_point_eval(input: &[u8], gas_limit: u64) -> PrecompileResult {
    const GAS: u64 = 50_000;
    if gas_limit < GAS { return Err(PrecompileError::OutOfGas); }
    if input.len() != 192 { return Err(PrecompileError::InvalidInput); }
    Err(PrecompileError::NotImplemented("kzg_point_eval (0x0a)"))
}