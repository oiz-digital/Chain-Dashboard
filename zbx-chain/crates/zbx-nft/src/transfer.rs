//! NFT transfer logic with approval tracking (ZEP-721 compatible).

use std::collections::{HashMap, HashSet};
use zbx_types::address::Address;
use crate::mint::TokenId;

/// Manages ownership transfers and approvals for an NFT collection.
#[derive(Debug, Default)]
pub struct NftTransfer {
    /// token_id → owner
    owners: HashMap<TokenId, Address>,
    /// token_id → approved address
    approvals: HashMap<TokenId, Address>,
    /// owner → set of operators approved for all tokens
    operators: HashMap<Address, HashSet<Address>>,
    /// owner → token_count
    balances: HashMap<Address, u64>,
}

impl NftTransfer {
    pub fn new() -> Self { Self::default() }

    /// Register a newly minted token.
    pub fn register(&mut self, token_id: TokenId, owner: Address) {
        self.owners.insert(token_id, owner);
        *self.balances.entry(owner).or_insert(0) += 1;
    }

    pub fn owner_of(&self, token_id: TokenId) -> Option<Address> {
        self.owners.get(&token_id).copied()
    }

    pub fn approve(&mut self, caller: &Address, to: Address, token_id: TokenId) -> Result<(), &'static str> {
        if self.owners.get(&token_id) != Some(caller) { return Err("not owner"); }
        self.approvals.insert(token_id, to);
        Ok(())
    }

    pub fn set_approval_for_all(&mut self, owner: Address, operator: Address, approved: bool) {
        if approved {
            self.operators.entry(owner).or_default().insert(operator);
        } else if let Some(ops) = self.operators.get_mut(&owner) {
            ops.remove(&operator);
        }
    }

    pub fn transfer_from(&mut self, caller: &Address, from: Address, to: Address, token_id: TokenId) -> Result<(), &'static str> {
        let owner = self.owners.get(&token_id).copied().ok_or("token not found")?;
        if owner != from { return Err("from is not owner"); }
        let approved = self.approvals.get(&token_id).copied() == Some(*caller);
        let is_operator = self.operators.get(&from).map(|ops| ops.contains(caller)).unwrap_or(false);
        if caller != &from && !approved && !is_operator {
            return Err("not authorised");
        }
        self.owners.insert(token_id, to);
        self.approvals.remove(&token_id);
        *self.balances.entry(from).or_insert(1) -= 1;
        *self.balances.entry(to).or_insert(0) += 1;
        Ok(())
    }

    pub fn balance_of(&self, owner: &Address) -> u64 {
        self.balances.get(owner).copied().unwrap_or(0)
    }
}
