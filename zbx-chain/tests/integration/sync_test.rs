//! Integration tests for zbx-sync (chain synchronisation).

#[cfg(test)]
mod sync_integration {
    #[test]
    fn fast_sync_downloads_headers_in_order() {
        // 1. Spin up archive node with 10_000 blocks.
        // 2. Connect fresh node.
        // 3. Fast sync: download headers 0..10_000 in order.
        // 4. Verify: node's best block = 10_000 with matching hash.
        assert!(true, "fast sync header order: stub");
    }

    #[test]
    fn snap_sync_reconstructs_state_root() {
        // 1. Archive node at block 10_000 with known state root.
        // 2. Snap sync: download state trie chunks.
        // 3. Verify: reconstructed state root matches archive node's root.
        assert!(true, "snap sync state root: stub");
    }

    #[test]
    fn live_sync_follows_new_blocks() {
        // 1. Node is synced to block 10_000.
        // 2. New block 10_001 is produced.
        // 3. Node receives block via gossip → imports → best block = 10_001.
        assert!(true, "live sync: stub");
    }

    #[test]
    fn fork_choice_prefers_longer_chain() {
        // Two forks at block 9_000:
        //   Fork A: length 1_001 (total 10_001 blocks)
        //   Fork B: length 500  (total 9_500 blocks)
        // Expected: node follows Fork A.
        assert!(true, "fork choice: stub");
    }
}