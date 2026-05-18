//! Smart contract interaction: ABI encoding, call, send, deploy, events.

use crate::{
    error::SdkError,
    provider::Provider,
    wallet::Wallet,
    transaction::TransactionRequest,
    filter::{FilterBuilder, LogFilter},
    abi::{AbiFunction, AbiParam, encode_call, decode_output},
};
use zbx_types::{Address, U256, H256};
use serde_json::Value;

/// A deployed contract instance.
///
/// ```rust,no_run
/// use zbx_sdk::{Provider, Wallet, Contract};
/// use zbx_sdk::abi::Token;
///
/// let abi_json = include_str!("../../../contracts/ZbxStaking.abi.json");
/// let contract = Contract::new(
///     "0xStakingAddress",
///     abi_json,
///     provider.clone(),
/// );
/// let result = contract.call("totalStaked", vec![], None).await?;
/// ```
pub struct Contract {
    address:  Address,
    abi:      Vec<AbiFunction>,
    provider: Provider,
}

impl Contract {
    /// Create a new contract handle from an address and ABI JSON string.
    pub fn new(
        address:  impl Into<String>,
        abi_json: impl Into<String>,
        provider: Provider,
    ) -> Result<Self, SdkError> {
        let addr = parse_addr(address.into())?;
        let abi  = parse_abi(abi_json.into())?;
        Ok(Self { address: addr, abi, provider })
    }

    /// Deploy a contract and return the deployed `Contract` handle.
    pub async fn deploy(
        bytecode:    Vec<u8>,
        abi_json:    impl Into<String>,
        constructor: Vec<Token>,
        provider:    Provider,
        wallet:      &Wallet,
    ) -> Result<Self, SdkError> {
        let abi     = parse_abi(abi_json.into())?;
        // Append ABI-encoded constructor args.
        let mut data = bytecode;
        if !constructor.is_empty() {
            data.extend_from_slice(&encode_constructor(&constructor));
        }
        let tx = TransactionRequest::deploy(data);
        let receipt = provider.send(tx, wallet).await?
            .wait_confirmations(1).await?;
        let addr_hex = receipt["contractAddress"].as_str()
            .ok_or_else(|| SdkError::Other("no contractAddress in deploy receipt".into()))?;
        let address = parse_addr(addr_hex.into())?;
        Ok(Self { address, abi, provider })
    }

    pub fn address(&self) -> Address { self.address }

    // ── Read calls ────────────────────────────────────────────────────────────

    /// Call a `view`/`pure` function and decode the output.
    pub async fn call(
        &self,
        function: &str,
        args:     Vec<Token>,
        block:    Option<u64>,
    ) -> Result<Vec<Token>, SdkError> {
        let func     = self.find_function(function)?;
        let calldata = encode_call(&func.selector(), &args, &func.inputs)?;
        let tx = TransactionRequest::call(self.address, calldata);
        let raw_output = self.provider.call(&tx).await?;
        decode_output(&raw_output, &func.outputs)
    }

    /// Call a function and return the first decoded output token.
    pub async fn call_one(
        &self,
        function: &str,
        args:     Vec<Token>,
    ) -> Result<Token, SdkError> {
        let mut tokens = self.call(function, args, None).await?;
        tokens.into_iter().next()
            .ok_or_else(|| SdkError::Abi("function returned no values".into()))
    }

    // ── Write transactions ────────────────────────────────────────────────────

    /// Send a state-changing transaction.  Fills gas and nonce automatically.
    pub async fn send(
        &self,
        function: &str,
        args:     Vec<Token>,
        value:    Option<U256>,
        wallet:   &Wallet,
    ) -> Result<H256, SdkError> {
        let func     = self.find_function(function)?;
        let calldata = encode_call(&func.selector(), &args, &func.inputs)?;
        let tx = TransactionRequest::call(self.address, calldata)
            .value(value.unwrap_or_default())
            .eip1559();
        let signed_hash = self.provider.send(tx, wallet).await?.hash;
        Ok(signed_hash)
    }

    /// Send and wait for 1 confirmation.
    pub async fn send_and_wait(
        &self,
        function: &str,
        args:     Vec<Token>,
        value:    Option<U256>,
        wallet:   &Wallet,
    ) -> Result<Value, SdkError> {
        let func     = self.find_function(function)?;
        let calldata = encode_call(&func.selector(), &args, &func.inputs)?;
        let tx = TransactionRequest::call(self.address, calldata)
            .value(value.unwrap_or_default())
            .eip1559();
        self.provider.send(tx, wallet).await?
            .wait_confirmations(1).await
    }

    // ── Event subscription ────────────────────────────────────────────────────

    /// Build a log filter for an event emitted by this contract.
    pub fn events(&self, event_name: &str) -> FilterBuilder {
        let addr: Address = self.address;
        let sig: H256     = keccak_event_sig(event_name);
        let f: FilterBuilder = FilterBuilder::new();
        let f: FilterBuilder = FilterBuilder::address(f, addr);
        FilterBuilder::event_signature(f, sig)
    }

    // ── Utils ─────────────────────────────────────────────────────────────────

    fn find_function(&self, name: &str) -> Result<&AbiFunction, SdkError> {
        self.abi.iter().find(|f| f.name == name)
            .ok_or_else(|| SdkError::FunctionNotFound(name.into()))
    }
}

fn keccak_event_sig(sig: &str) -> H256 {
    use sha3::{Digest, Keccak256};
    let hash = Keccak256::digest(sig.as_bytes());
    let mut out = [0u8; 32];
    out.copy_from_slice(&hash);
    H256(out)
}

fn parse_addr(s: String) -> Result<Address, SdkError> {
    let clean = s.trim_start_matches("0x");
    let bytes  = hex::decode(clean).map_err(SdkError::Hex)?;
    if bytes.len() != 20 {
        return Err(SdkError::Other("address must be 20 bytes".into()));
    }
    let mut arr = [0u8; 20];
    arr.copy_from_slice(&bytes);
    Ok(Address(arr))
}

fn parse_abi(_json: String) -> Result<Vec<AbiFunction>, SdkError> {
    // In production: deserialize full ABI JSON array.
    Ok(Vec::new())
}

fn encode_constructor(_args: &[Token]) -> Vec<u8> {
    Vec::new() // placeholder
}

// Re-export Token for users of this module.
pub use crate::abi::Token;