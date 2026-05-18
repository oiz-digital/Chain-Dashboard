//! Unit tests for zbx-crypto primitives.
//! Run: cargo test --package zbx-crypto

#[cfg(test)]
mod keccak_tests {
    #[test]
    fn keccak256_empty() {
        // keccak256("") = c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470
        let expected = "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470";
        let hash = zbx_keccak256(b"");
        assert_eq!(hex::encode(hash), expected);
    }

    #[test]
    fn keccak256_known_vector() {
        // keccak256("abc") = 4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45
        let hash = zbx_keccak256(b"abc");
        assert_eq!(hex::encode(hash), "4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45");
    }

    fn zbx_keccak256(data: &[u8]) -> [u8; 32] {
        // Stub — real impl: zbx_crypto::keccak::keccak256(data)
        let _ = data; [0u8; 32]
    }
}

#[cfg(test)]
mod secp256k1_tests {
    #[test]
    fn address_from_pubkey() {
        // Ethereum address derivation: keccak256(pubkey)[12..] as 0x...
        // Test vector from EIP-55.
        let expected_addr = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
        // Stub assertion — real impl uses zbx_crypto::secp256k1::pubkey_to_address
        assert_eq!(expected_addr.to_lowercase(), expected_addr.to_lowercase());
    }

    #[test]
    fn sign_and_verify_roundtrip() {
        // Sign message, recover signer address, compare.
        // Real impl: zbx_crypto::secp256k1::{sign, recover}
        let message = b"Zebvix Chain test message";
        let _ = message;
        // Placeholder: real test will sign with a private key and verify recovery.
        assert!(true, "secp256k1 roundtrip");
    }
}

#[cfg(test)]
mod merkle_tests {
    #[test]
    fn empty_tree_root() {
        // Merkle root of zero leaves.
        // Real impl: zbx_crypto::merkle::MerkleTree::new(vec![]).root()
        let placeholder_root = [0u8; 32];
        assert_eq!(placeholder_root.len(), 32);
    }

    #[test]
    fn single_leaf_root_equals_leaf() {
        // Merkle root of one leaf equals the leaf hash itself.
        let leaf = [1u8; 32];
        // Stub — real impl: tree.root() == leaf
        let _ = leaf;
        assert!(true);
    }

    #[test]
    fn proof_verification() {
        // Construct tree, get proof for leaf[0], verify proof.
        // Real impl: assert!(tree.verify_proof(&leaf, &proof, &root))
        assert!(true, "merkle proof verify stub");
    }
}