//! Dispute handling — when a challenger contests a proposal.

use serde::{Serialize, Deserialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum DisputeOutcome {
    /// Proposer was correct — challenger loses bond
    ProposerWon { correct_price: i128 },
    /// Challenger was correct — proposer loses bond
    ChallengerWon { correct_price: i128 },
    /// DVM could not reach consensus — both get bonds back minus fee
    NoContest,
}

/// An active dispute between proposer and challenger.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Dispute {
    pub request_id:      [u8; 32],
    pub proposer:        [u8; 20],
    pub challenger:      [u8; 20],
    pub proposed_price:  i128,
    pub challenger_bond: u128,
    pub disputed_at:     u64,
    pub outcome:         Option<DisputeOutcome>,
}

impl Dispute {
    pub fn new(
        request_id:      [u8; 32],
        proposer:        [u8; 20],
        challenger:      [u8; 20],
        proposed_price:  i128,
        challenger_bond: u128,
        now:             u64,
    ) -> Self {
        tracing::info!(
            request = hex::encode(request_id),
            proposer = hex::encode(proposer),
            challenger = hex::encode(challenger),
            "Optimistic oracle dispute raised"
        );
        Self { request_id, proposer, challenger, proposed_price, challenger_bond, disputed_at: now, outcome: None }
    }

    /// Resolve the dispute with a DVM-voted price.
    pub fn resolve(&mut self, dvm_price: i128, proposer_correct: bool) {
        let outcome = if proposer_correct {
            DisputeOutcome::ProposerWon { correct_price: dvm_price }
        } else {
            DisputeOutcome::ChallengerWon { correct_price: dvm_price }
        };
        tracing::info!(
            request = hex::encode(self.request_id),
            outcome = ?outcome,
            "Optimistic oracle dispute resolved"
        );
        self.outcome = Some(outcome);
    }
}