//! Block sealer — executes the assembled block and computes final roots.

use crate::{block_builder::AssembledBlock, error::SequencerError};

/// A fully sealed block (ready for consensus).
#[derive(Debug, Clone)]
pub struct SealedBlock {
    pub assembled:     AssembledBlock,
    pub state_root:    [u8; 32],
    pub receipts_root: [u8; 32],
    pub block_hash:    [u8; 32],
    /// Proposer's signature over block_hash.
    pub proposer_sig:  [u8; 65],
}

/// Seals a block: executes txs, computes state/receipts root, hashes.
pub struct BlockSealer {
    chain_id: u64,
}

impl BlockSealer {
    pub fn new(chain_id: u64) -> Self { Self { chain_id } }

    pub fn seal(
        &self,
        mut block: AssembledBlock,
        proposer_key: &[u8; 32],
    ) -> Result<SealedBlock, SequencerError> {
        // 1. Execute all transactions (via zbx-execution).
        // Real impl: executor.execute_block(&block.txs, state)
        let state_root    = self.mock_execute(&block.txs);
        let receipts_root = [0xBEu8; 32]; // placeholder

        block.state_root    = Some(state_root);
        block.receipts_root = Some(receipts_root);

        // 2. Compute block hash = keccak256(RLP(block_header)).
        let block_hash = self.compute_block_hash(&block, &state_root, &receipts_root);

        // 3. Proposer signs block hash.
        let proposer_sig = self.sign(proposer_key, &block_hash);

        Ok(SealedBlock {
            assembled: block,
            state_root,
            receipts_root,
            block_hash,
            proposer_sig,
        })
    }

    fn mock_execute(&self, _txs: &[Vec<u8>]) -> [u8; 32] {
        // Real impl: dispatch to zbx_execution::Executor
        [0xAAu8; 32]
    }

    fn compute_block_hash(
        &self,
        block: &AssembledBlock,
        state_root: &[u8; 32],
        receipts_root: &[u8; 32],
    ) -> [u8; 32] {
        use sha3::{Digest, Keccak256};
        let mut h = Keccak256::new();
        h.update(block.parent_hash);
        h.update(block.number.to_be_bytes());
        h.update(state_root);
        h.update(receipts_root);
        h.update(block.tx_root);
        h.finalize().into()
    }

    fn sign(&self, _key: &[u8; 32], _hash: &[u8; 32]) -> [u8; 65] {
        // Real impl: secp256k1 ECDSA sign
        [0u8; 65]
    }
}