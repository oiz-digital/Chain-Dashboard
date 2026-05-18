//! Staking write-set deferred until block commit.
//!
//! `dispatch_staking_tx` accumulates persistence operations into a
//! `StakingDelta` instead of writing directly to RocksDB. The executor
//! returns the delta as part of `ExecutionResult`. The block producer
//! flushes the delta via `ZbxDb::apply_staking_delta` only after the
//! reorg pre-commit check passes and the block has been persisted —
//! so a dropped candidate block can never leave staking-side state
//! drift on disk.
//!
//! Reads (`get_delegation`, `get_unbonding_entry`,
//! `iter_matured_unbondings_for`) are overlaid: pending ops within
//! the same block take precedence over the on-disk view, so a
//! `Delegate` followed by `Undelegate` in the same block sees the
//! right intermediate balance.

use crate::error::StakingError;
use std::collections::{HashMap, HashSet};
use zbx_storage::ZbxDb;
use zbx_types::address::Address;

#[derive(Debug, Default, Clone)]
pub struct StakingDelta {
    delegations: HashMap<(Address, Address), u128>,
    unbonding_puts: HashMap<(u64, Address, Address), u128>,
    unbonding_deletes: HashSet<(u64, Address, Address)>,
}

impl StakingDelta {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn is_empty(&self) -> bool {
        self.delegations.is_empty()
            && self.unbonding_puts.is_empty()
            && self.unbonding_deletes.is_empty()
    }

    pub fn delegation_overrides(&self) -> &HashMap<(Address, Address), u128> {
        &self.delegations
    }
    pub fn unbonding_put_overrides(&self) -> &HashMap<(u64, Address, Address), u128> {
        &self.unbonding_puts
    }
    pub fn unbonding_delete_overrides(&self) -> &HashSet<(u64, Address, Address)> {
        &self.unbonding_deletes
    }

    pub fn get_delegation(
        &self,
        db: &ZbxDb,
        validator: &Address,
        delegator: &Address,
    ) -> Result<u128, StakingError> {
        if let Some(v) = self.delegations.get(&(*validator, *delegator)) {
            return Ok(*v);
        }
        db.get_delegation(validator, delegator)
            .map_err(|e| StakingError::Persistence(e.to_string()))
    }

    pub fn put_delegation(&mut self, validator: Address, delegator: Address, amount: u128) {
        self.delegations.insert((validator, delegator), amount);
    }

    pub fn get_unbonding_entry(
        &self,
        db: &ZbxDb,
        unlock: u64,
        delegator: &Address,
        validator: &Address,
    ) -> Result<u128, StakingError> {
        let key = (unlock, *delegator, *validator);
        if self.unbonding_deletes.contains(&key) {
            return Ok(self.unbonding_puts.get(&key).copied().unwrap_or(0));
        }
        if let Some(v) = self.unbonding_puts.get(&key) {
            return Ok(*v);
        }
        db.get_unbonding_entry(unlock, delegator, validator)
            .map_err(|e| StakingError::Persistence(e.to_string()))
    }

    pub fn put_unbonding_entry(
        &mut self,
        unlock: u64,
        delegator: Address,
        validator: Address,
        amount: u128,
    ) {
        let key = (unlock, delegator, validator);
        self.unbonding_deletes.remove(&key);
        self.unbonding_puts.insert(key, amount);
    }

    pub fn iter_matured_unbondings_for(
        &self,
        db: &ZbxDb,
        who: &Address,
        current_height: u64,
    ) -> Result<Vec<(u64, Address, u128)>, StakingError> {
        let mut on_disk = db
            .iter_matured_unbondings_for(who, current_height)
            .map_err(|e| StakingError::Persistence(e.to_string()))?;
        // Apply deletes + put-overrides on the on-disk view.
        on_disk.retain(|(h, v, _)| !self.unbonding_deletes.contains(&(*h, *who, *v)));
        for (h, v, amt) in on_disk.iter_mut() {
            if let Some(over) = self.unbonding_puts.get(&(*h, *who, *v)) {
                *amt = *over;
            }
        }
        // Add brand-new puts whose unlock <= current_height and that
        // were not already in the on-disk vec.
        let mut seen: HashSet<(u64, Address)> = on_disk
            .iter()
            .map(|(h, v, _)| (*h, *v))
            .collect();
        for ((unlock, delegator, validator), amt) in &self.unbonding_puts {
            if delegator != who {
                continue;
            }
            if *unlock > current_height {
                continue;
            }
            if seen.insert((*unlock, *validator)) {
                on_disk.push((*unlock, *validator, *amt));
            }
        }
        Ok(on_disk)
    }

    pub fn delete_unbonding_entry(
        &mut self,
        unlock: u64,
        delegator: Address,
        validator: Address,
    ) {
        let key = (unlock, delegator, validator);
        self.unbonding_puts.remove(&key);
        self.unbonding_deletes.insert(key);
    }

    pub fn delete_unbonding_entries(&mut self, delegator: Address, entries: &[(u64, Address)]) {
        for (h, v) in entries {
            self.delete_unbonding_entry(*h, delegator, *v);
        }
    }
}
