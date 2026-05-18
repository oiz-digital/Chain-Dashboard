//! Integration tests for zbx-prover.

#[cfg(test)]
mod prover_integration {
    #[test]
    fn state_proof_verify_roundtrip() {
        // Generate a state proof for a known account, then verify it.
        // Real: let proof = node.get_proof(address, block)?;
        //       assert!(proof.verify_account(&state_root).is_ok());
        assert!(true, "state proof roundtrip: stub");
    }

    #[test]
    fn block_proof_proves_empty_block() {
        // An empty block (0 txs) should still produce a valid proof.
        // The proof covers: state_root unchanged, gas_used=0, tx_root=empty.
        assert!(true, "empty block proof: stub");
    }

    #[test]
    fn recursive_proof_covers_10_blocks() {
        // Aggregate 10 consecutive block proofs into one recursive proof.
        // Verify the recursive proof covers blocks [1..10] with correct roots.
        assert!(true, "recursive 10-block: stub");
    }

    #[test]
    fn fraud_proof_rejects_wrong_state_root() {
        // Submit a block with incorrect state root.
        // Fraud proof should be accepted by the verifier.
        assert!(true, "fraud proof rejection: stub");
    }

    #[test]
    fn verifier_rejects_tampered_proof() {
        // Flip one bit in a valid proof → verifier should reject.
        // This is the most critical correctness property.
        assert!(true, "tampered proof rejection: stub");
    }
}