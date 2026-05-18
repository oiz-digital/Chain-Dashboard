//! EIP-2981 compatible royalty registry for ZEP-721/ZEP-1155 collections.

use std::collections::HashMap;
use zbx_types::address::Address;
use crate::mint::TokenId;

/// Basis points denominator (100% = 10_000 bps).
pub const BPS_DENOM: u64 = 10_000;

/// Per-token or per-collection royalty configuration.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RoyaltyInfo {
    /// Recipient of royalty payments.
    pub receiver: Address,
    /// Royalty rate in basis points (e.g. 250 = 2.5%).
    pub bps:      u64,
}

/// Royalty registry — supports collection-level and per-token overrides.
#[derive(Debug, Default)]
pub struct RoyaltyRegistry {
    /// Collection-level default royalty.
    default_royalty: Option<RoyaltyInfo>,
    /// Per-token royalty overrides.
    token_royalties: HashMap<TokenId, RoyaltyInfo>,
}

impl RoyaltyRegistry {
    pub fn new() -> Self { Self::default() }

    pub fn set_default_royalty(&mut self, receiver: Address, bps: u64) -> Result<(), &'static str> {
        if bps > BPS_DENOM { return Err("royalty exceeds 100%"); }
        self.default_royalty = Some(RoyaltyInfo { receiver, bps });
        Ok(())
    }

    pub fn set_token_royalty(&mut self, token_id: TokenId, receiver: Address, bps: u64) -> Result<(), &'static str> {
        if bps > BPS_DENOM { return Err("royalty exceeds 100%"); }
        self.token_royalties.insert(token_id, RoyaltyInfo { receiver, bps });
        Ok(())
    }

    /// Returns `(receiver, royalty_amount)` for a sale of `sale_price`.
    pub fn royalty_info(&self, token_id: TokenId, sale_price: u128) -> Option<(Address, u128)> {
        let info = self.token_royalties.get(&token_id)
            .or(self.default_royalty.as_ref())?;
        let amount = sale_price * info.bps as u128 / BPS_DENOM as u128;
        Some((info.receiver, amount))
    }
}
