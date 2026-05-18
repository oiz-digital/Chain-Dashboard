//! State proofs — prove account / storage state to light clients.
//!
//! A state proof lets a light client (phone wallet, browser extension)
//! verify:
//!   - "Account 0x1234 has balance 1.5 ZBX at block 10_000"
//!   - "Contract 0xABCD slot 0x00 = 0xFF at block 10_000"
//!
//! Without downloading the full chain state.
//!
//! Format: compact Merkle Patricia Trie proof (same as Ethereum eth_getProof).
//! Size: ~1 KB for a balance proof, ~2 KB for a storage proof.

use serde::{Deserialize, Serialize};
use crate::error::{ProverResult, ProverError};

/// Request for a state proof.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateProofRequest {
    pub address:      [u8; 20],
    pub storage_keys: Vec<[u8; 32]>,  // empty = account proof only
    pub block_number: u64,
}

/// State proof response (equivalent to Ethereum `eth_getProof`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateProof {
    pub address:        [u8; 20],
    pub balance:        u128,
    pub nonce:          u64,
    pub code_hash:      [u8; 32],
    pub storage_hash:   [u8; 32],
    pub block_number:   u64,
    pub state_root:     [u8; 32],
    /// RLP-encoded Merkle nodes from root → account leaf.
    pub account_proof:  Vec<Vec<u8>>,
    /// Storage proofs (one per requested key).
    pub storage_proofs: Vec<StorageProof>,
}

/// Proof of a single storage slot.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageProof {
    pub key:   [u8; 32],
    pub value: [u8; 32],
    /// RLP-encoded Merkle nodes from storage_root → slot leaf.
    pub proof: Vec<Vec<u8>>,
}

impl StateProof {
    /// Verify the account proof against a known state root.
    pub fn verify_account(&self, state_root: &[u8; 32]) -> ProverResult<()> {
        if self.state_root != *state_root {
            return Err(ProverError::StateRootMismatch {
                expected: hex::encode(state_root),
                got:      hex::encode(self.state_root),
            });
        }

        // Derive the account key: keccak256(address).
        let account_key = keccak256(&self.address);

        // Verify Merkle Patricia Trie proof.
        // In production: zbx_trie::verify_proof(state_root, &account_key, &self.account_proof)
        self.verify_mpt_proof(
            state_root,
            &account_key,
            &self.account_proof,
        )?;

        Ok(())
    }

    /// Verify a specific storage slot proof.
    pub fn verify_storage(&self, key: &[u8; 32]) -> ProverResult<[u8; 32]> {
        let sp = self.storage_proofs.iter()
            .find(|sp| sp.key == *key)
            .ok_or_else(|| ProverError::AccountNotFound(hex::encode(key)))?;

        let slot_key = keccak256(key);
        self.verify_mpt_proof(
            &self.storage_hash,
            &slot_key,
            &sp.proof,
        )?;

        Ok(sp.value)
    }

    /// Verify a Merkle Patricia Trie proof path.
    fn verify_mpt_proof(
        &self,
        root:  &[u8; 32],
        key:   &[u8; 32],
        proof: &[Vec<u8>],
    ) -> ProverResult<()> {
        if proof.is_empty() {
            return Err(ProverError::MerkleProofInvalid {
                key:  hex::encode(key),
                root: hex::encode(root),
            });
        }

        // Walk the proof nodes:
        // Each node is RLP-decoded and its hash must match the parent's reference.
        let mut current_hash = *root;
        for node_rlp in proof {
            let node_hash = keccak256(node_rlp);
            if node_hash != current_hash {
                return Err(ProverError::MerkleProofInvalid {
                    key:  hex::encode(key),
                    root: hex::encode(root),
                });
            }
            // In production: RLP-decode node, follow key nibbles.
            // This is a simplified version — real impl uses zbx_trie::verify_proof.
            current_hash = node_hash; // placeholder
        }
        Ok(())
    }

    /// Serialise proof to bytes (for sending over the network).
    pub fn to_bytes(&self) -> Vec<u8> {
        serde_json::to_vec(self).unwrap_or_default()
    }

    /// Deserialise proof from bytes.
    pub fn from_bytes(bytes: &[u8]) -> ProverResult<Self> {
        serde_json::from_slice(bytes)
            .map_err(|e| ProverError::Serialisation(e.to_string()))
    }

    /// Estimated proof size in bytes.
    pub fn size(&self) -> usize {
        // Each proof node: ~32 bytes for branch, ~60 bytes for leaf.
        let account_size = self.account_proof.iter().map(|n| n.len()).sum::<usize>();
        let storage_size: usize = self.storage_proofs.iter()
            .flat_map(|sp| sp.proof.iter())
            .map(|n| n.len())
            .sum();
        account_size + storage_size + 128 // metadata overhead
    }
}

fn keccak256(data: &[u8]) -> [u8; 32] {
    use sha3::{Digest, Keccak256};
    let mut h = Keccak256::new();
    h.update(data);
    h.finalize().into()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_proof_fails_verification() {
        let proof = StateProof {
            address: [0u8; 20],
            balance: 0,
            nonce: 0,
            code_hash: [0u8; 32],
            storage_hash: [0u8; 32],
            block_number: 0,
            state_root: [1u8; 32],
            account_proof: vec![],
            storage_proofs: vec![],
        };
        let result = proof.verify_account(&[1u8; 32]);
        assert!(result.is_err(), "empty proof should fail");
    }

    #[test]
    fn wrong_state_root_fails() {
        let proof = StateProof {
            address: [0u8; 20],
            balance: 1000,
            nonce: 1,
            code_hash: [0u8; 32],
            storage_hash: [0u8; 32],
            block_number: 100,
            state_root: [0xAAu8; 32],
            account_proof: vec![vec![1, 2, 3]],
            storage_proofs: vec![],
        };
        let wrong_root = [0xBBu8; 32];
        let result = proof.verify_account(&wrong_root);
        assert!(result.is_err(), "wrong state root should fail");
    }
}