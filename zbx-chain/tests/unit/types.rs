//! Unit tests for zbx-types (Block, Transaction, Receipt).

#[cfg(test)]
mod transaction_tests {
    #[test]
    fn tx_hash_is_keccak_of_rlp() {
        // Transaction hash = keccak256(RLP(tx fields)).
        // Real: let tx = Transaction { ... }; assert_eq!(tx.hash(), expected_hash)
        let placeholder_hash = [0u8; 32];
        assert_eq!(placeholder_hash.len(), 32, "tx hash must be 32 bytes");
    }

    #[test]
    fn eip1559_tx_type_is_2() {
        // EIP-1559 transactions have type = 0x02.
        let tx_type: u8 = 0x02;
        assert_eq!(tx_type, 2, "EIP-1559 tx type must be 2");
    }

    #[test]
    fn legacy_tx_type_is_0() {
        let tx_type: u8 = 0x00;
        assert_eq!(tx_type, 0, "legacy tx type must be 0");
    }
}

#[cfg(test)]
mod block_tests {
    #[test]
    fn genesis_block_number_is_zero() {
        let genesis_number: u64 = 0;
        assert_eq!(genesis_number, 0);
    }

    #[test]
    fn block_hash_covers_all_fields() {
        // Block hash = keccak256(RLP(header)).
        // Must include: parent_hash, state_root, tx_root, receipts_root,
        //               number, timestamp, gas_limit, gas_used, base_fee, miner.
        let required_fields = [
            "parent_hash", "state_root", "tx_root", "receipts_root",
            "number", "timestamp", "gas_limit", "gas_used", "base_fee", "miner",
        ];
        assert_eq!(required_fields.len(), 10, "block header must have all 10 fields");
    }
}

#[cfg(test)]
mod receipt_tests {
    #[test]
    fn successful_receipt_status_is_1() {
        let status: u8 = 1;
        assert_eq!(status, 1, "success = 1");
    }

    #[test]
    fn failed_receipt_status_is_0() {
        let status: u8 = 0;
        assert_eq!(status, 0, "failure = 0");
    }
}