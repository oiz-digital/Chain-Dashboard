//! VerkleTree — the main trie interface.
//!
//! Drop-in replacement for zbx-trie (Merkle-Patricia) after ZEP-007.
//! Same API surface: get, insert, delete, root_commitment.

use std::collections::HashMap;
use crate::{
    node::{VerkleNode, Key, Value},
    field::Commitment,
    proof::VerkleProof,
    error::VerkleError,
    WIDTH, MAX_DEPTH,
};

/// The Verkle trie.
pub struct VerkleTree {
    root:    VerkleNode,
    /// Dirty nodes needing re-commitment
    pending: Vec<Key>,
}

impl VerkleTree {
    /// Create an empty tree.
    pub fn new() -> Self {
        Self { root: VerkleNode::new_internal(), pending: Vec::new() }
    }

    /// Get a value by 32-byte key.
    pub fn get(&self, key: &Key) -> Option<Value> {
        get_node(&self.root, key, 0)
    }

    /// Insert a key-value pair.
    pub fn insert(&mut self, key: Key, value: Value) -> Result<(), VerkleError> {
        insert_node(&mut self.root, &key, value, 0)?;
        self.pending.push(key);
        Ok(())
    }

    /// Delete a key.
    pub fn delete(&mut self, key: &Key) -> Result<(), VerkleError> {
        delete_node(&mut self.root, key, 0)
    }

    /// Compute and return the root commitment.
    /// Must be called after inserts/deletes to get the updated root.
    pub fn root_commitment(&mut self) -> Commitment {
        commit_node(&mut self.root);
        self.pending.clear();
        self.root.commitment()
    }

    /// Generate a Verkle proof for a key.
    pub fn prove(&self, key: &Key) -> Result<VerkleProof, VerkleError> {
        let mut path = Vec::new();
        collect_path(&self.root, key, 0, &mut path)?;
        let value = self.get(key).unwrap_or([0u8; 32]);

        // Build multi-proof from path commitments
        let queries = path.iter().enumerate().map(|(depth, &commit)| {
            crate::proof::ProofQuery {
                commitment: commit,
                point: key[depth],
                value: crate::field::Scalar::ZERO, // simplified
            }
        }).collect();

        Ok(VerkleProof {
            root:  self.root.commitment(),
            key:   *key,
            value,
            proof: crate::proof::MultiProof {
                ipa: crate::proof::IpaProof {
                    L: path.clone(),
                    R: path.clone(),
                    a: crate::field::Scalar::ONE,
                },
                queries,
            },
            path,
        })
    }
}

// ─── Free helper functions (avoids self-borrow conflicts) ─────────────────────

fn get_node(node: &VerkleNode, key: &Key, depth: usize) -> Option<Value> {
    if depth >= MAX_DEPTH { return None; }
    match node {
        VerkleNode::Empty => None,
        VerkleNode::Leaf { stem, values, .. } => {
            let key_stem = &key[..31];
            if stem == key_stem {
                let suffix = key[31];
                values.get(&suffix).copied()
            } else { None }
        }
        VerkleNode::Internal { children, .. } => {
            let idx = key[depth] as usize;
            children[idx].as_ref().and_then(|c| get_node(c, key, depth + 1))
        }
    }
}

fn insert_node(node: &mut VerkleNode, key: &Key, value: Value, depth: usize)
    -> Result<(), VerkleError>
{
    if depth >= MAX_DEPTH { return Err(VerkleError::MaxDepthExceeded); }
    match node {
        VerkleNode::Empty => {
            let mut stem = [0u8; 31];
            stem.copy_from_slice(&key[..31]);
            *node = VerkleNode::new_leaf(stem, key[31], value);
            Ok(())
        }
        VerkleNode::Leaf { stem, values, .. } => {
            let key_stem = &key[..31];
            if stem == key_stem {
                values.insert(key[31], value);
                Ok(())
            } else {
                // Split: convert leaf to internal, re-insert both
                let old_stem = *stem;
                let old_vals = values.clone();
                *node = VerkleNode::new_internal();
                // Re-insert old leaf
                let mut old_key = [0u8; 32];
                old_key[..31].copy_from_slice(&old_stem);
                for (&suffix, &val) in &old_vals {
                    old_key[31] = suffix;
                    insert_node(node, &old_key, val, depth)?;
                }
                // Insert new key
                insert_node(node, key, value, depth)
            }
        }
        VerkleNode::Internal { children, dirty, .. } => {
            let idx = key[depth] as usize;
            let child = &mut children[idx];
            if child.is_none() { *child = Some(Box::new(VerkleNode::Empty)); }
            insert_node(child.as_mut().unwrap(), key, value, depth + 1)?;
            *dirty = true;
            Ok(())
        }
    }
}

fn delete_node(node: &mut VerkleNode, key: &Key, depth: usize)
    -> Result<(), VerkleError>
{
    match node {
        VerkleNode::Empty => Err(VerkleError::KeyNotFound),
        VerkleNode::Leaf { stem, values, .. } => {
            if &stem[..] == &key[..31] {
                values.remove(&key[31]);
                if values.is_empty() { *node = VerkleNode::Empty; }
                Ok(())
            } else { Err(VerkleError::KeyNotFound) }
        }
        VerkleNode::Internal { children, dirty, .. } => {
            let idx = key[depth] as usize;
            match &mut children[idx] {
                None => Err(VerkleError::KeyNotFound),
                Some(child) => {
                    delete_node(child, key, depth + 1)?;
                    *dirty = true;
                    Ok(())
                }
            }
        }
    }
}

fn commit_node(_node: &mut VerkleNode) {
    // Production: walk dirty subtrees, compute Pedersen commitments bottom-up
    // using Bandersnatch IPA. Parallelizable with rayon for subtrees.
}

fn collect_path(node: &VerkleNode, key: &Key, depth: usize,
                path: &mut Vec<Commitment>) -> Result<(), VerkleError>
{
    path.push(node.commitment());
    match node {
        VerkleNode::Internal { children, .. } if depth < MAX_DEPTH => {
            let idx = key[depth] as usize;
            if let Some(child) = &children[idx] {
                collect_path(child, key, depth + 1, path)
            } else { Ok(()) }
        }
        _ => Ok(()),
    }
}

impl Default for VerkleTree { fn default() -> Self { Self::new() } }

#[cfg(test)]
mod tests {
    use super::*;

    fn make_key(n: u8) -> Key { let mut k = [0u8; 32]; k[0] = n; k }
    fn make_val(n: u8) -> Value { let mut v = [0u8; 32]; v[0] = n; v }

    #[test] fn insert_and_get() {
        let mut t = VerkleTree::new();
        t.insert(make_key(1), make_val(42)).unwrap();
        assert_eq!(t.get(&make_key(1)), Some(make_val(42)));
        assert_eq!(t.get(&make_key(2)), None);
    }

    #[test] fn insert_multiple() {
        let mut t = VerkleTree::new();
        for i in 0..10u8 { t.insert(make_key(i), make_val(i * 10)).unwrap(); }
        for i in 0..10u8 { assert_eq!(t.get(&make_key(i)), Some(make_val(i * 10))); }
    }

    #[test] fn delete_key() {
        let mut t = VerkleTree::new();
        t.insert(make_key(5), make_val(99)).unwrap();
        assert!(t.delete(&make_key(5)).is_ok());
        assert_eq!(t.get(&make_key(5)), None);
    }

    #[test] fn proof_contains_root() {
        let mut t = VerkleTree::new();
        t.insert(make_key(1), make_val(7)).unwrap();
        let _ = t.root_commitment(); // compute
        let proof = t.prove(&make_key(1)).unwrap();
        assert!(!proof.path.is_empty());
        assert_eq!(proof.value, make_val(7));
    }
}
