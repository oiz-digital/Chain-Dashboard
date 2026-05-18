//! GossipSub peer scoring: reward good peers, penalize bad ones.

use std::collections::HashMap;
use zbx_types::Address;
use std::time::{Duration, Instant};

/// Peer score parameters.
#[derive(Debug, Clone)]
pub struct ScoreParams {
    /// Decay interval for score.
    pub decay_interval: Duration,
    /// Decay factor per interval (e.g. 0.9).
    pub score_decay: f64,
    /// Penalty for delivering duplicate messages.
    pub duplicate_message_penalty: f64,
    /// Penalty for delivering invalid messages.
    pub invalid_message_penalty: f64,
    /// Reward for first delivery.
    pub first_message_deliveries_weight: f64,
    /// Reward for mesh delivery.
    pub mesh_message_deliveries_weight: f64,
    /// Minimum score before peer is pruned.
    pub prune_threshold: f64,
}

impl Default for ScoreParams {
    fn default() -> Self {
        Self {
            decay_interval: Duration::from_secs(1),
            score_decay: 0.9,
            duplicate_message_penalty: -0.5,
            invalid_message_penalty: -50.0,
            first_message_deliveries_weight: 1.0,
            mesh_message_deliveries_weight: 0.5,
            prune_threshold: -100.0,
        }
    }
}

/// Per-topic counters for a single peer.
#[derive(Debug, Default, Clone)]
struct TopicScore {
    first_deliveries: f64,
    mesh_deliveries:  f64,
    invalid_messages: f64,
    duplicates:       f64,
}

/// Peer score tracker.
pub struct PeerScorer {
    scores: HashMap<zbx_types::H256, (f64, HashMap<String, TopicScore>, Instant)>,
    params: ScoreParams,
}

impl PeerScorer {
    pub fn new(params: ScoreParams) -> Self {
        Self { scores: HashMap::new(), params }
    }

    pub fn score(&mut self, peer: zbx_types::H256) -> f64 {
        let entry = self.scores.entry(peer)
            .or_insert_with(|| (0.0, HashMap::new(), Instant::now()));
        // Apply decay.
        let elapsed = entry.2.elapsed();
        let decays = elapsed.as_secs_f64() / self.params.decay_interval.as_secs_f64();
        if decays >= 1.0 {
            entry.0 *= self.params.score_decay.powf(decays.floor());
            entry.2 = Instant::now();
        }
        entry.0
    }

    pub fn on_first_delivery(&mut self, peer: zbx_types::H256, topic: &str) {
        let entry = self.scores.entry(peer)
            .or_insert_with(|| (0.0, HashMap::new(), Instant::now()));
        let topic_score = entry.1.entry(topic.to_string()).or_default();
        topic_score.first_deliveries += 1.0;
        entry.0 += self.params.first_message_deliveries_weight;
    }

    pub fn on_duplicate(&mut self, peer: zbx_types::H256, topic: &str) {
        let entry = self.scores.entry(peer)
            .or_insert_with(|| (0.0, HashMap::new(), Instant::now()));
        entry.0 += self.params.duplicate_message_penalty;
    }

    pub fn on_invalid(&mut self, peer: zbx_types::H256, topic: &str) {
        let entry = self.scores.entry(peer)
            .or_insert_with(|| (0.0, HashMap::new(), Instant::now()));
        entry.0 += self.params.invalid_message_penalty;
    }

    pub fn should_prune(&mut self, peer: zbx_types::H256) -> bool {
        self.score(peer) < self.params.prune_threshold
    }
}