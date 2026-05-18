//! Oracle scheduler — periodically opens rounds and fetches prices.

use crate::{
    feed::FeedId,
    round::RoundManager,
    fetcher::fetch_price_vwap,
    error::OracleError,
};
use std::time::{SystemTime, UNIX_EPOCH};

fn now_secs() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs()
}

/// Drives one oracle update cycle: open round → fetch prices → close round.
pub async fn run_cycle(
    feed_id: &FeedId,
    manager: &mut RoundManager,
) -> Result<(), OracleError> {
    let now = now_secs();
    let _round_id = manager.new_round(feed_id.clone(), now);

    let _price = fetch_price_vwap(feed_id).await?;

    Ok(())
}
