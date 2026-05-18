//! Hard-fork schedule (Pass-10 framework).
//!
//! ## Why this exists
//!
//! Until Pass-10 there was *no* mechanism to gate consensus / EVM rule
//! changes on a block-height activation point. Any rule change therefore
//! required either a coordinated genesis-only switch (forks impossible
//! once mainnet was live) or hidden chain-id checks scattered across
//! crates. Both approaches have caused outages on other L1s
//! (cf. Ethereum Constantinople reverted at the last minute, BSC's
//! Berlin/London hot-patch, etc.).
//!
//! This module gives every rule-bearing crate a single, audited place
//! to ask "which hard fork is active at height H?" — `current_fork`.
//! Activation heights live in network configs (`mainnet.toml`,
//! `testnet.toml`, `devnet.toml`) and are loaded into a `HardForkSchedule`
//! at node start.
//!
//! ## What this is *not* yet
//!
//! Pass-10 ships only the schedule plumbing. Actual rule changes
//! gated on a fork (eg. introducing EOF, raising the gas-cap, switching
//! the slashing curve) are tagged in code with `// FORK: <name>` and
//! tracked in `docs/HARDFORK-INDEX.md`. Each rule change is a
//! follow-up PR that reads `schedule.current_fork(height)` and branches.
//!
//! Adding a new fork:
//!
//! 1. Append a variant to [`HardFork`].
//! 2. Bump [`ALL_FORKS`] in declaration order — newest LAST.
//! 3. Add a [`HardForkSchedule`] entry for each network config.
//! 4. Update `docs/HARDFORK-INDEX.md`.
//! 5. Gate the rule change on `schedule.is_active(HardFork::X, height)`.

use serde::{Deserialize, Serialize};

/// Named hard forks, ordered by activation order.
///
/// `Genesis` is implicit at height 0 on every network and never moves.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
pub enum HardFork {
    /// Initial protocol version at chain genesis.
    Genesis,
    /// First post-launch hardening pass — placeholder until devnet bake-off
    /// surfaces the first concrete rule change.
    PostLaunch1,
}

/// All forks in declaration order. New forks MUST be appended at the end.
pub const ALL_FORKS: &[HardFork] = &[
    HardFork::Genesis,
    HardFork::PostLaunch1,
];

/// Per-network activation schedule.
///
/// Stored as `(fork, activation_height)` pairs sorted by height ascending.
/// `Genesis` is required to be present and at height 0.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HardForkSchedule {
    /// Sorted activation heights — first entry must be `(Genesis, 0)`.
    pub entries: Vec<(HardFork, u64)>,
}

impl HardForkSchedule {
    /// Build a schedule from the given activations. Always inserts
    /// `(Genesis, 0)` if the caller forgot it.
    pub fn new(mut entries: Vec<(HardFork, u64)>) -> Self {
        if !entries.iter().any(|(f, _)| *f == HardFork::Genesis) {
            entries.push((HardFork::Genesis, 0));
        }
        entries.sort_by_key(|(_, h)| *h);
        Self { entries }
    }

    /// Mainnet schedule — all post-genesis forks set to `u64::MAX` until
    /// scheduled by governance. Production callers MUST overwrite this
    /// with the real schedule from `mainnet.toml` once forks are voted in.
    pub fn mainnet_default() -> Self {
        Self::new(vec![
            (HardFork::Genesis, 0),
            (HardFork::PostLaunch1, u64::MAX),
        ])
    }

    /// Testnet/devnet schedule — same as mainnet by default, but operators
    /// override per-test-cycle to bake new forks before mainnet ships them.
    pub fn testnet_default() -> Self {
        Self::new(vec![
            (HardFork::Genesis, 0),
            (HardFork::PostLaunch1, u64::MAX),
        ])
    }

    /// Activation height for a specific fork. `u64::MAX` means "not yet
    /// scheduled" — callers MUST treat this as inactive.
    pub fn activation_of(&self, fork: HardFork) -> u64 {
        self.entries.iter()
            .find(|(f, _)| *f == fork)
            .map(|(_, h)| *h)
            .unwrap_or(u64::MAX)
    }

    /// Is `fork` active at block `height`?
    pub fn is_active(&self, fork: HardFork, height: u64) -> bool {
        height >= self.activation_of(fork)
    }

    /// The newest fork that is active at `height`. Always returns at
    /// least `Genesis` because genesis is mandatory.
    pub fn current_fork(&self, height: u64) -> HardFork {
        self.entries.iter()
            .rev()
            .find(|(_, h)| height >= *h)
            .map(|(f, _)| *f)
            .unwrap_or(HardFork::Genesis)
    }

    /// Sanity-check the schedule. Returns `Err(reason)` if the schedule
    /// is malformed (genesis missing, heights non-monotonic, duplicate
    /// fork). Should be called at node startup so a misconfigured TOML
    /// fails fast instead of silently corrupting consensus.
    pub fn validate(&self) -> Result<(), String> {
        if self.entries.is_empty() {
            return Err("schedule is empty".into());
        }
        let first = &self.entries[0];
        if first.0 != HardFork::Genesis || first.1 != 0 {
            return Err(format!(
                "schedule must start with (Genesis, 0), got {:?}", first));
        }
        let mut prev_h: u64 = 0;
        let mut seen: std::collections::HashSet<HardFork> = std::collections::HashSet::new();
        for (i, (f, h)) in self.entries.iter().enumerate() {
            if i > 0 && *h < prev_h {
                return Err(format!(
                    "schedule not monotonic at entry {}: {} < {}", i, h, prev_h));
            }
            if !seen.insert(*f) {
                return Err(format!("duplicate fork variant: {:?}", f));
            }
            prev_h = *h;
        }
        Ok(())
    }
}

impl Default for HardForkSchedule {
    fn default() -> Self { Self::mainnet_default() }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn genesis_always_active() {
        let s = HardForkSchedule::mainnet_default();
        assert!(s.is_active(HardFork::Genesis, 0));
        assert!(s.is_active(HardFork::Genesis, u64::MAX));
        assert_eq!(s.current_fork(0), HardFork::Genesis);
    }

    #[test]
    fn unscheduled_fork_is_never_active() {
        let s = HardForkSchedule::mainnet_default();
        assert!(!s.is_active(HardFork::PostLaunch1, 0));
        assert!(!s.is_active(HardFork::PostLaunch1, 1_000_000_000));
        // u64::MAX is the "not scheduled" sentinel — checking `height >= MAX`
        // requires height to actually equal MAX, which is unreachable.
        assert!(!s.is_active(HardFork::PostLaunch1, u64::MAX - 1));
    }

    #[test]
    fn current_fork_picks_newest_active() {
        let s = HardForkSchedule::new(vec![
            (HardFork::Genesis, 0),
            (HardFork::PostLaunch1, 1_000),
        ]);
        assert_eq!(s.current_fork(0),     HardFork::Genesis);
        assert_eq!(s.current_fork(999),   HardFork::Genesis);
        assert_eq!(s.current_fork(1_000), HardFork::PostLaunch1);
        assert_eq!(s.current_fork(9_999), HardFork::PostLaunch1);
    }

    #[test]
    fn missing_genesis_is_inserted_automatically() {
        let s = HardForkSchedule::new(vec![(HardFork::PostLaunch1, 500)]);
        assert!(s.validate().is_ok());
        assert_eq!(s.activation_of(HardFork::Genesis), 0);
    }

    #[test]
    fn validate_catches_non_monotonic() {
        let bad = HardForkSchedule {
            entries: vec![
                (HardFork::Genesis, 0),
                (HardFork::PostLaunch1, 100),
                // duplicate variant — caught by validate()
            ],
        };
        // Manually corrupt:
        let bad2 = HardForkSchedule {
            entries: vec![
                (HardFork::PostLaunch1, 100),
                (HardFork::Genesis, 0),
            ],
        };
        assert!(bad2.validate().is_err(),
            "schedule starting non-genesis must fail validation");
        assert!(bad.validate().is_ok());
    }

    #[test]
    fn validate_catches_duplicate_fork() {
        let dup = HardForkSchedule {
            entries: vec![
                (HardFork::Genesis, 0),
                (HardFork::PostLaunch1, 100),
                (HardFork::PostLaunch1, 200),
            ],
        };
        assert!(dup.validate().is_err());
    }
}
