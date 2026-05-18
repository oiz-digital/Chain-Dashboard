//! NFT minting logic (ZEP-721 / ZEP-1155).

use std::collections::HashMap;
use zbx_types::address::Address;

pub type TokenId = u128;

/// Tracks ownership and supply for a single NFT collection.
#[derive(Debug, Default)]
pub struct NftMinter {
    /// token_id → owner
    owners: HashMap<TokenId, Address>,
    /// owner → count
    balances: HashMap<Address, u64>,
    next_id: TokenId,
    /// Maximum supply (0 = unlimited).
    pub max_supply: u128,
    pub minter: Option<Address>,
}

impl NftMinter {
    pub fn new(minter: Address, max_supply: u128) -> Self {
        Self { minter: Some(minter), max_supply, ..Default::default() }
    }

    pub fn mint(&mut self, caller: &Address, to: Address) -> Result<TokenId, &'static str> {
        if Some(*caller) != self.minter { return Err("not minter"); }
        if self.max_supply > 0 && self.next_id >= self.max_supply {
            return Err("max supply reached");
        }
        let token_id = self.next_id;
        self.next_id += 1;
        self.owners.insert(token_id, to);
        *self.balances.entry(to).or_insert(0) += 1;
        Ok(token_id)
    }

    pub fn owner_of(&self, token_id: TokenId) -> Option<Address> {
        self.owners.get(&token_id).copied()
    }

    pub fn balance_of(&self, owner: &Address) -> u64 {
        self.balances.get(owner).copied().unwrap_or(0)
    }

    pub fn total_supply(&self) -> u128 { self.next_id }
}
