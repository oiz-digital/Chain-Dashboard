//! High-level transaction signing convenience API.
//!
//! `signing.rs` wraps the low-level `TxSigner` in `signer.rs` and provides:
//!
//! * `SigningContext` — immutable per-chain parameters (chain_id, gas_token
//!   defaults) used to construct signing envelopes without boilerplate.
//! * `sign_transfer` / `sign_contract_call` / `sign_deploy` helpers that
//!   produce a ready-to-broadcast `SignedTx` in a single call.
//! * `batch_sign` — sign multiple transactions with monotonically-increasing
//!   nonces so wallets can queue without re-querying the mempool.
//!
//! ## Chain IDs
//!
//! | Network  | Chain ID |
//! |----------|----------|
//! | Mainnet  | 8989     |
//! | Testnet  | 8990     |
//!
//! These match the genesis `chainId` and are enforced in EIP-155 replay
//! protection (Transaction::chain_id field).

use crate::{
    error::TxError,
    signer::TxSigner,
    types::{AccessListEntry, GasToken, SignedTx, Transaction, TxType},
};
use zbx_crypto::secp256k1::PrivKey;
use zbx_types::address::Address;

// ── Chain IDs ─────────────────────────────────────────────────────────────────

pub const CHAIN_ID_MAINNET: u64 = 8989;
pub const CHAIN_ID_TESTNET: u64 = 8990;

// ── SigningContext ─────────────────────────────────────────────────────────────

/// Immutable signing context for one chain.
#[derive(Debug, Clone)]
pub struct SigningContext {
    pub chain_id: u64,
    /// Default gas token for new transactions.
    pub default_gas_token: GasToken,
    /// Default max_priority_fee_per_gas (EIP-1559, in wei).
    pub default_priority_fee: u64,
    /// Default max_fee_per_gas (EIP-1559, in wei).
    pub default_max_fee: u64,
}

impl SigningContext {
    pub fn mainnet() -> Self {
        SigningContext {
            chain_id: CHAIN_ID_MAINNET,
            default_gas_token: GasToken::Zbx,
            default_priority_fee: 1_000_000_000,        // 1 Gwei
            default_max_fee: 10_000_000_000,             // 10 Gwei
        }
    }

    pub fn testnet() -> Self {
        SigningContext {
            chain_id: CHAIN_ID_TESTNET,
            default_gas_token: GasToken::Zbx,
            default_priority_fee: 1_000_000_000,
            default_max_fee: 10_000_000_000,
        }
    }

    /// Sign a ZBX transfer (value send, no data).
    pub fn sign_transfer(
        &self,
        key: &PrivKey,
        from: Address,
        to: Address,
        value: u128,
        nonce: u64,
        gas_limit: u64,
    ) -> Result<SignedTx, TxError> {
        self.sign_raw(key, from, Some(to), value, nonce, gas_limit, vec![], vec![])
    }

    /// Sign a contract call (to = contract address, data = calldata).
    pub fn sign_contract_call(
        &self,
        key: &PrivKey,
        from: Address,
        to: Address,
        value: u128,
        nonce: u64,
        gas_limit: u64,
        data: Vec<u8>,
    ) -> Result<SignedTx, TxError> {
        self.sign_raw(key, from, Some(to), value, nonce, gas_limit, data, vec![])
    }

    /// Sign a contract deployment (to = None).
    pub fn sign_deploy(
        &self,
        key: &PrivKey,
        from: Address,
        value: u128,
        nonce: u64,
        gas_limit: u64,
        init_code: Vec<u8>,
    ) -> Result<SignedTx, TxError> {
        self.sign_raw(key, from, None, value, nonce, gas_limit, init_code, vec![])
    }

    /// Sign a contract call with an access list (EIP-2930 / Type-1).
    pub fn sign_with_access_list(
        &self,
        key: &PrivKey,
        from: Address,
        to: Option<Address>,
        value: u128,
        nonce: u64,
        gas_limit: u64,
        data: Vec<u8>,
        access_list: Vec<AccessListEntry>,
    ) -> Result<SignedTx, TxError> {
        let tx = Transaction {
            tx_type: TxType::Eip2930,
            chain_id: Some(self.chain_id),
            nonce,
            gas_price: Some(self.default_max_fee),
            max_priority_fee_per_gas: None,
            max_fee_per_gas: None,
            gas_limit,
            to,
            value,
            data,
            access_list,
            gas_token: self.default_gas_token,
        };
        TxSigner::sign_transaction(tx, key)
    }

    /// Sign multiple transactions with sequential nonces starting at `base_nonce`.
    ///
    /// Useful for wallet batch operations — each tx increments the nonce by 1.
    /// Returns an error on the first signing failure; successful txs up to
    /// that point are returned in `ok`.
    pub fn batch_sign(
        &self,
        key: &PrivKey,
        from: Address,
        base_nonce: u64,
        requests: Vec<BatchSignRequest>,
    ) -> BatchSignResult {
        let mut ok = Vec::with_capacity(requests.len());
        let mut err = None;
        for (i, req) in requests.into_iter().enumerate() {
            let nonce = base_nonce + i as u64;
            let result = self.sign_raw(
                key,
                from.clone(),
                req.to,
                req.value,
                nonce,
                req.gas_limit,
                req.data,
                vec![],
            );
            match result {
                Ok(signed) => ok.push(signed),
                Err(e) => {
                    err = Some((nonce, e));
                    break;
                }
            }
        }
        BatchSignResult { signed: ok, error: err }
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    fn sign_raw(
        &self,
        key: &PrivKey,
        from: Address,
        to: Option<Address>,
        value: u128,
        nonce: u64,
        gas_limit: u64,
        data: Vec<u8>,
        access_list: Vec<AccessListEntry>,
    ) -> Result<SignedTx, TxError> {
        let tx = Transaction {
            tx_type: TxType::Eip1559,
            chain_id: Some(self.chain_id),
            nonce,
            gas_price: None,
            max_priority_fee_per_gas: Some(self.default_priority_fee),
            max_fee_per_gas: Some(self.default_max_fee),
            gas_limit,
            to,
            value,
            data,
            access_list,
            gas_token: self.default_gas_token,
        };
        TxSigner::sign_transaction(tx, key)
    }
}

// ── Batch helpers ─────────────────────────────────────────────────────────────

/// One request in a batch signing call.
pub struct BatchSignRequest {
    pub to: Option<Address>,
    pub value: u128,
    pub gas_limit: u64,
    pub data: Vec<u8>,
}

/// Result of `batch_sign`.
pub struct BatchSignResult {
    /// Successfully signed transactions (in nonce order).
    pub signed: Vec<SignedTx>,
    /// The first failure: `(nonce, error)`.  `None` if all succeeded.
    pub error: Option<(u64, TxError)>,
}

impl BatchSignResult {
    pub fn all_ok(&self) -> bool { self.error.is_none() }
}

// ── Signature verification helpers ───────────────────────────────────────────

/// Recover the signer address from a raw signed transaction (EIP-2718 bytes).
///
/// Convenience wrapper around `TxSigner::decode_and_recover`.
pub fn recover_signer(raw_tx: &[u8]) -> Result<Address, TxError> {
    TxSigner::decode_and_recover(raw_tx)
}

/// Verify that the signer of `raw_tx` matches `expected_from`.
pub fn verify_sender(raw_tx: &[u8], expected_from: &Address) -> Result<(), TxError> {
    let recovered = recover_signer(raw_tx)?;
    if &recovered != expected_from {
        return Err(TxError::InvalidSignature);
    }
    Ok(())
}
