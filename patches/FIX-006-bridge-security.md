# FIX-006: Bridge Security Hardening

**Gap:** Bridge (multi-sig threshold) has no external audit and no formal
upgrade/pause path. Rating: 🔴 NOT externally audited, NOT battle-tested.

**Files affected:**
- `contracts/BridgeVault.sol`
- `contracts/BridgeMultisig.sol`
- `contracts/ZbxBridge.sol`
- `crates/zbx-bridge/src/relayer.rs`

---

## Issues Identified

### B-01 (CRITICAL): No emergency pause mechanism
`BridgeVault.sol` has no `pause()` function. If a vulnerability is discovered
post-launch, there is no way to freeze the bridge without a full multisig
transaction — which requires gathering 3-of-5 signers under time pressure.

**Fix — add to BridgeVault.sol:**

```solidity
// SPDX-License-Identifier: Apache-2.0
pragma solidity =0.8.24;

import { Ownable2Step } from "./Ownable2Step.sol";

abstract contract Pausable is Ownable2Step {
    bool public paused;

    event Paused(address indexed by);
    event Unpaused(address indexed by);

    error ContractPaused();

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    /// @notice Pause all bridge operations. Any multisig member can pause;
    ///         only the multisig can unpause (prevents griefing).
    function pause() external {
        require(
            IZbxBridgeMultisig(multisig).isSigner(msg.sender),
            "not a bridge signer"
        );
        paused = true;
        emit Paused(msg.sender);
    }

    /// @notice Unpause — requires full multisig quorum to prevent rushed unpauses.
    function unpause() external onlyMultisig {
        paused = false;
        emit Unpaused(msg.sender);
    }
}
```

### B-02 (HIGH): Multisig key rotation has no timelock
Current: any 3-of-5 signers can immediately replace the signer set.
This means a compromised 3-of-5 majority can silently swap in attacker keys.

**Fix — add 48-hour timelock to signer rotation:**

```solidity
// In BridgeMultisig.sol

uint256 public constant SIGNER_ROTATION_DELAY = 48 hours;

struct PendingRotation {
    address[] newSigners;
    uint256   newThreshold;
    uint256   eta;           // earliest execution time
    uint256   approvals;
    mapping(address => bool) approved;
}

PendingRotation public pendingRotation;

/// @notice Propose a signer rotation (requires quorum to propose).
function proposeRotation(
    address[] calldata newSigners_,
    uint256 newThreshold_
) external onlyMultisig {
    require(newSigners_.length >= 3, "min 3 signers");
    require(newThreshold_ >= 2 && newThreshold_ <= newSigners_.length, "bad threshold");
    pendingRotation.newSigners   = newSigners_;
    pendingRotation.newThreshold = newThreshold_;
    pendingRotation.eta          = block.timestamp + SIGNER_ROTATION_DELAY;
    pendingRotation.approvals    = 1;
    pendingRotation.approved[msg.sender] = true;
    emit RotationProposed(newSigners_, newThreshold_, pendingRotation.eta);
}

/// @notice Execute rotation after timelock expires.
function executeRotation() external onlyMultisig {
    PendingRotation storage pr = pendingRotation;
    require(pr.eta != 0, "no pending rotation");
    require(block.timestamp >= pr.eta, "timelock not expired");
    require(pr.approvals >= threshold, "insufficient approvals");
    _setSigners(pr.newSigners, pr.newThreshold);
    delete pendingRotation;
    emit SignersRotated(pr.newSigners, pr.newThreshold);
}
```

### B-03 (HIGH): Relayer has no replay protection across chain reorgs
`crates/zbx-bridge/src/relayer.rs` uses a simple nonce for deduplication,
but chain reorgs on the source chain (Ethereum/BSC) can cause the same
event to be re-submitted after the original nonce was consumed.

**Fix — use event-log-index + block-hash composite key:**

```rust
// In crates/zbx-bridge/src/relayer.rs

/// Composite deduplication key: (source_chain_id, tx_hash, log_index).
/// This survives reorgs because tx_hash changes when a block is reorged.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct DepositKey {
    pub source_chain_id: u64,
    pub tx_hash:         [u8; 32],
    pub log_index:       u32,
}

impl Relayer {
    /// Check if a deposit has already been processed (replay protection).
    pub fn is_processed(&self, key: &DepositKey) -> bool {
        self.db.get_cf(&self.cf_processed, bincode::serialize(key).unwrap())
            .map(|v| v.is_some())
            .unwrap_or(false)
    }

    /// Mark deposit as processed atomically with the mint transaction.
    pub fn mark_processed(
        &self,
        key: &DepositKey,
        mint_tx_hash: [u8; 32],
    ) -> Result<(), RelayerError> {
        let mut batch = WriteBatch::default();
        batch.put_cf(
            &self.cf_processed,
            bincode::serialize(key)?,
            bincode::serialize(&mint_tx_hash)?,
        );
        self.db.write(batch).map_err(RelayerError::Db)
    }
}
```

### B-04 (MEDIUM): No bridge TVL cap
Unlimited bridge TVL means a single vulnerability can drain the entire
locked liquidity. Industry standard is a per-asset and global daily cap.

**Fix — add daily transfer limits to BridgeVault.sol:**

```solidity
// Per-asset daily transfer cap
mapping(address => uint256) public dailyCap;        // set by multisig
mapping(address => uint256) public dailyVolume;     // resets each epoch
mapping(address => uint256) public lastResetEpoch;  // epoch = day

function _checkAndUpdateDailyCap(address token, uint256 amount) internal {
    uint256 epoch = block.timestamp / 1 days;
    if (lastResetEpoch[token] != epoch) {
        dailyVolume[token] = 0;
        lastResetEpoch[token] = epoch;
    }
    dailyVolume[token] += amount;
    require(
        dailyCap[token] == 0 || dailyVolume[token] <= dailyCap[token],
        "Bridge: daily cap exceeded"
    );
}
```

---

## Formal Verification Plan

Target: Certora Prover (Solidity) + KLEE (Rust relayer)

### Properties to verify

| Property | Contract | Tool |
|---|---|---|
| No double-spend: same deposit key processed at most once | BridgeVault | Certora |
| Pause blocks all value transfer | BridgeVault | Certora |
| Rotation requires quorum + timelock | BridgeMultisig | Certora |
| Daily cap never exceeded in single tx | BridgeVault | Certora |
| Relayer replay protection is complete | zbx-bridge | KLEE |
| BLS proof verification is fail-closed | zbx-bridge | Kani |

### Audit engagement (recommended firms)

- **Trail of Bits** — specializes in Rust blockchain security
- **Sigma Prime** — audited Ethereum Beacon Chain (Lighthouse)
- **Zellic** — Solidity + cross-chain bridge specialists

**Estimated timeline:** 8–12 weeks for full bridge audit including relayer.
**Budget estimate:** $150,000–$250,000 USD for comprehensive scope.

---

## Bridge Security Incident Response

```
Detection (automated alert) → 1 minute
    ↓
Any signer calls pause() → 2 minutes
    ↓
Incident channel notified (all 5 signers) → 5 minutes
    ↓
Root cause analysis → 24–72 hours
    ↓
Fix developed + internal review → 3–7 days
    ↓
External security review → 1–2 weeks
    ↓
Multisig upgrade proposal → 48h timelock
    ↓
Contract upgraded + unpause
```
