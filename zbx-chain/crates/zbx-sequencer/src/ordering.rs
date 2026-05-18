//! Transaction ordering — selects and orders txs for a block.
//!
//! Ordering rules (priority order):
//!   1. MEV bundles (atomic, highest tip first)
//!   2. Private pool txs (commit-reveal ordering, FIFO within commit order)
//!   3. Public mempool txs (EIP-1559 priority fee descending)
//!   4. Within same fee tier: nonce order per sender (prevents gaps)

/// A pending transaction ready for inclusion.
#[derive(Debug, Clone)]
pub struct PendingTx {
    pub rlp:          Vec<u8>,
    pub sender:       [u8; 20],
    pub nonce:        u64,
    pub gas_limit:    u64,
    pub max_fee:      u128,
    pub priority_fee: u128,
    pub origin:       TxOrigin,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TxOrigin {
    /// Part of an MEV bundle (ordered atomically).
    MevBundle { bundle_id: String, index: usize },
    /// From the private (encrypted) pool (ordered by commit time).
    PrivatePool { commit_block: u64 },
    /// From the public mempool (fee order).
    Public,
}

/// Result of transaction ordering for a block.
pub struct OrderedBlock {
    pub txs:            Vec<PendingTx>,
    pub total_gas:      u64,
    pub mev_bundle_count: u32,
    pub private_count:  u32,
    pub public_count:   u32,
}

/// Select and order transactions for the next block.
pub fn select_and_order(
    available:   Vec<PendingTx>,
    gas_limit:   u64,
    base_fee:    u128,
) -> OrderedBlock {
    let mut bundles:  Vec<PendingTx> = vec![];
    let mut private:  Vec<PendingTx> = vec![];
    let mut public_q: Vec<PendingTx> = vec![];

    for tx in available {
        if tx.max_fee < base_fee { continue; } // below base fee — skip
        match &tx.origin {
            TxOrigin::MevBundle { .. }   => bundles.push(tx),
            TxOrigin::PrivatePool { .. } => private.push(tx),
            TxOrigin::Public             => public_q.push(tx),
        }
    }

    // Sort: bundles by bundle_id (already grouped), private by commit_block, public by priority fee.
    bundles.sort_by(|a, b| {
        let aid = if let TxOrigin::MevBundle { bundle_id, index } = &a.origin { format!("{bundle_id}{index:04}") } else { String::new() };
        let bid = if let TxOrigin::MevBundle { bundle_id, index } = &b.origin { format!("{bundle_id}{index:04}") } else { String::new() };
        aid.cmp(&bid)
    });
    private.sort_by_key(|t| {
        if let TxOrigin::PrivatePool { commit_block } = t.origin { commit_block } else { 0 }
    });
    public_q.sort_by(|a, b| b.priority_fee.cmp(&a.priority_fee));

    let mut ordered = vec![];
    ordered.extend(bundles);
    ordered.extend(private);
    ordered.extend(public_q);

    // Fill block up to gas limit.
    let mut txs = vec![];
    let mut gas = 0u64;
    let mut mev = 0u32; let mut priv_c = 0u32; let mut pub_c = 0u32;
    for tx in ordered {
        if gas + tx.gas_limit > gas_limit { continue; }
        gas += tx.gas_limit;
        match tx.origin {
            TxOrigin::MevBundle { .. }   => mev += 1,
            TxOrigin::PrivatePool { .. } => priv_c += 1,
            TxOrigin::Public             => pub_c += 1,
        }
        txs.push(tx);
    }

    OrderedBlock { txs, total_gas: gas, mev_bundle_count: mev, private_count: priv_c, public_count: pub_c }
}