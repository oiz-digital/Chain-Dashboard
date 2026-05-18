// FIX-001: transactions_root — SHA-256 flat hash → Keccak-256 MPT root
//
// Bug: S7-PROD1 (OPEN)
// File: node/src/block_producer.rs + crates/zbx-block/src/builder.rs
// Impact: CRITICAL — tx_root is Ethereum-incompatible; light clients /
//         SPV proofs / bridge relayers cannot verify inclusion proofs.
//
// Root cause:
//   build_candidate() emits transactions_root: H256([0u8; 32]) as a
//   placeholder.  execute_and_commit_inner() patches state_root and
//   receipts_root from the executor output, but was computing
//   transactions_root as:
//
//     sha2::Sha256::digest(rlp_encode_list(&txs))
//
//   which (a) uses SHA-256 instead of Keccak-256, and (b) hashes the
//   entire list as a flat blob instead of constructing a Merkle Patricia
//   Trie keyed by RLP-encoded tx index.
//
// Fix:
//   Replace the flat SHA-256 call with a proper Ethereum-compatible
//   transactions MPT root. The algorithm:
//
//     for (i, tx) in block.body.transactions.iter().enumerate() {
//         let key   = rlp::encode(&i);          // RLP of tx index (0, 1, 2, …)
//         let value = rlp::encode(tx);           // RLP of full SignedTransaction
//         trie.insert(key, value);
//     }
//     transactions_root = H256(trie.root_hash());  // Keccak-256 MPT root
//
// Patch — add to crates/zbx-block/src/builder.rs:

use zbx_rlp::encode as rlp_encode;
use zbx_trie::Trie;
use zbx_primitives::H256;

/// Compute the Ethereum-compatible transactions MPT root.
///
/// Each transaction is keyed by its RLP-encoded sequential index
/// (matching Ethereum Yellow Paper §4.3.2).
pub fn compute_transactions_root(txs: &[zbx_tx::SignedTransaction]) -> H256 {
    if txs.is_empty() {
        // Empty transactions root — fixed well-known Keccak-256 of empty MPT.
        // 0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421
        return H256([
            0x56, 0xe8, 0x1f, 0x17, 0x1b, 0xcc, 0x55, 0xa6,
            0xff, 0x83, 0x45, 0xe6, 0x92, 0xc0, 0xf8, 0x6e,
            0x5b, 0x48, 0xe0, 0x1b, 0x99, 0x6c, 0xad, 0xc0,
            0x01, 0x62, 0x2f, 0xb5, 0xe3, 0x63, 0xb4, 0x21,
        ]);
    }

    let mut trie = Trie::new();
    for (i, tx) in txs.iter().enumerate() {
        // Key: RLP-encoded transaction index (i = 0, 1, 2, …)
        let key = rlp_encode(&i);
        // Value: RLP-encoded full signed transaction
        let value = rlp_encode(tx);
        trie.insert(key, value)
            .expect("trie insert cannot fail for sequential keys");
    }
    H256(trie.root_hash())
}

// Patch — in node/src/block_producer.rs, fn execute_and_commit_inner():
//
// BEFORE (wrong):
//   use sha2::{Sha256, Digest};
//   let tx_bytes: Vec<u8> = block.body.transactions.iter()
//       .flat_map(|t| rlp_encode(t))
//       .collect();
//   block.header.transactions_root = H256(Sha256::digest(&tx_bytes).into());
//
// AFTER (correct):
//   block.header.transactions_root =
//       zbx_block::builder::compute_transactions_root(&block.body.transactions);
//
// The receipts_root fix follows the same pattern (keyed by index → receipt RLP):

pub fn compute_receipts_root(receipts: &[zbx_execution::Receipt]) -> H256 {
    if receipts.is_empty() {
        return H256([
            0x56, 0xe8, 0x1f, 0x17, 0x1b, 0xcc, 0x55, 0xa6,
            0xff, 0x83, 0x45, 0xe6, 0x92, 0xc0, 0xf8, 0x6e,
            0x5b, 0x48, 0xe0, 0x1b, 0x99, 0x6c, 0xad, 0xc0,
            0x01, 0x62, 0x2f, 0xb5, 0xe3, 0x63, 0xb4, 0x21,
        ]);
    }
    let mut trie = Trie::new();
    for (i, receipt) in receipts.iter().enumerate() {
        trie.insert(rlp_encode(&i), rlp_encode(receipt))
            .expect("trie insert cannot fail");
    }
    H256(trie.root_hash())
}

// Tests — add to crates/zbx-block/src/tests/tx_root.rs:
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_transactions_root_is_well_known_value() {
        let root = compute_transactions_root(&[]);
        assert_eq!(
            hex::encode(root.0),
            "56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421",
            "empty tx root must match Ethereum canonical value"
        );
    }

    #[test]
    fn transactions_root_is_order_sensitive() {
        let tx_a = make_test_tx(1);
        let tx_b = make_test_tx(2);
        let root_ab = compute_transactions_root(&[tx_a.clone(), tx_b.clone()]);
        let root_ba = compute_transactions_root(&[tx_b, tx_a]);
        assert_ne!(root_ab, root_ba, "tx order must affect MPT root");
    }

    #[test]
    fn single_tx_root_is_deterministic() {
        let tx = make_test_tx(42);
        let r1 = compute_transactions_root(&[tx.clone()]);
        let r2 = compute_transactions_root(&[tx]);
        assert_eq!(r1, r2);
    }
}
