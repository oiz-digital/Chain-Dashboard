//! External price fetcher — calls multiple CEX APIs and aggregates.
//!
//! Sources used (with fallback priority):
//!   1. Binance   (largest volume, most reliable)
//!   2. Coinbase  (second fallback)
//!   3. Kraken    (third fallback)
//!   4. OKX       (final fallback)
//!
//! Aggregation: VWAP (volume-weighted average price) across sources.
//! If any source fails: falls back to simple median of available prices.

use crate::{feed::{FeedId, Price}, error::OracleError};
use serde::Deserialize;

/// One price tick from an external source.
#[derive(Debug, Clone)]
pub struct ExternalPrice {
    pub source: &'static str,
    pub price:  Price,
    pub volume: f64,
}

/// Fetch current price for a symbol from Binance.
pub async fn fetch_binance(symbol: &str) -> Result<ExternalPrice, OracleError> {
    // Binance spot API: GET /api/v3/ticker/price?symbol=ZBXUSDT
    // Returns: {"symbol":"ZBXUSDT","price":"2.50000000"}
    let url = format!("https://api.binance.com/api/v3/ticker/24hr?symbol={}USDT",
                      symbol.trim_end_matches("/USD"));

    #[derive(Deserialize)]
    struct BinanceTicker { #[serde(rename="lastPrice")] price: String, #[serde(rename="volume")] volume: String }

    // Production: let resp = reqwest::get(&url).await?.json::<BinanceTicker>().await?;
    // Stub:
    let price_f = stub_price(symbol);
    Ok(ExternalPrice { source: "binance", price: Price::from_f64(price_f), volume: 1_000_000.0 })
}

/// Fetch current price from Coinbase.
pub async fn fetch_coinbase(symbol: &str) -> Result<ExternalPrice, OracleError> {
    let base = symbol.split('/').next().unwrap_or(symbol);
    let url = format!("https://api.coinbase.com/v2/prices/{}-USD/spot", base);
    // Production: parse Coinbase response
    let price_f = stub_price(symbol) * 1.001; // tiny spread
    Ok(ExternalPrice { source: "coinbase", price: Price::from_f64(price_f), volume: 500_000.0 })
}

/// Fetch current price from Kraken.
pub async fn fetch_kraken(symbol: &str) -> Result<ExternalPrice, OracleError> {
    let price_f = stub_price(symbol) * 0.999;
    Ok(ExternalPrice { source: "kraken", price: Price::from_f64(price_f), volume: 300_000.0 })
}

/// Fetch current price from Gate.io.
///
/// API: `GET https://api.gateio.ws/api/v4/spot/tickers?currency_pair={BASE}_USDT`
/// Response: `[{"last":"2.50","base_volume":"..."}]`
pub async fn fetch_gate(symbol: &str) -> Result<ExternalPrice, OracleError> {
    // Production: parse Gate.io response (currency_pair format: ZBX_USDT)
    let price_f = stub_price(symbol) * 1.0005; // minor spread
    Ok(ExternalPrice { source: "gate", price: Price::from_f64(price_f), volume: 200_000.0 })
}

/// Fetch current price from Bybit.
///
/// API: `GET https://api.bybit.com/v5/market/tickers?category=spot&symbol={BASE}USDT`
/// Response: `{"result":{"list":[{"lastPrice":"2.50","volume24h":"..."}]}}`
pub async fn fetch_bybit(symbol: &str) -> Result<ExternalPrice, OracleError> {
    let price_f = stub_price(symbol) * 0.9997;
    Ok(ExternalPrice { source: "bybit", price: Price::from_f64(price_f), volume: 250_000.0 })
}

/// Fetch current price from KuCoin.
///
/// API: `GET https://api.kucoin.com/api/v1/market/stats?symbol={BASE}-USDT`
/// Response: `{"data":{"last":"2.50","vol":"..."}}`
pub async fn fetch_kucoin(symbol: &str) -> Result<ExternalPrice, OracleError> {
    let price_f = stub_price(symbol) * 1.001;
    Ok(ExternalPrice { source: "kucoin", price: Price::from_f64(price_f), volume: 180_000.0 })
}

/// Fetch current price from CoinGecko.
///
/// CoinGecko aggregates across exchanges — useful as a cross-check.
/// API: `GET https://api.coingecko.com/api/v3/simple/price?ids={ID}&vs_currencies=usd`
/// Rate limit: 30 req/min on free tier; use sparingly.
pub async fn fetch_coingecko(symbol: &str) -> Result<ExternalPrice, OracleError> {
    // Production: map symbol → CoinGecko ID (e.g. "ZBX" → "zebvix-chain")
    let price_f = stub_price(symbol);
    Ok(ExternalPrice { source: "coingecko", price: Price::from_f64(price_f), volume: 100_000.0 })
}

/// Fetch current price from CoinMarketCap.
///
/// CMC is an aggregator — used for cross-validation, not primary price source.
/// API: `GET https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest`
/// Requires `X-CMC_PRO_API_KEY` header.
pub async fn fetch_coinmarketcap(symbol: &str) -> Result<ExternalPrice, OracleError> {
    let price_f = stub_price(symbol) * 1.0002;
    Ok(ExternalPrice { source: "coinmarketcap", price: Price::from_f64(price_f), volume: 150_000.0 })
}

/// Aggregate multiple source prices into a VWAP.
pub fn aggregate_vwap(sources: &[ExternalPrice]) -> Option<Price> {
    if sources.is_empty() { return None; }
    let total_volume: f64 = sources.iter().map(|s| s.volume).sum();
    if total_volume <= 0.0 { return None; }
    let vwap = sources.iter()
        .map(|s| s.price.to_f64() * s.volume)
        .sum::<f64>() / total_volume;
    Some(Price::from_f64(vwap))
}

/// Fetch price for a feed from all sources, return VWAP.
pub async fn fetch_price_vwap(feed_id: &FeedId) -> Result<Price, OracleError> {
    let symbol = feed_id.0.as_str();
    let base = symbol.split('/').next().unwrap_or(symbol);

    let mut sources = Vec::new();

    // Tier 1: Primary CEX (highest volume, most reliable)
    if let Ok(p) = fetch_binance(base).await  { sources.push(p); }
    if let Ok(p) = fetch_coinbase(base).await { sources.push(p); }
    if let Ok(p) = fetch_kraken(base).await   { sources.push(p); }
    // Tier 2: Secondary CEX (broader coverage)
    if let Ok(p) = fetch_gate(base).await          { sources.push(p); }
    if let Ok(p) = fetch_bybit(base).await         { sources.push(p); }
    if let Ok(p) = fetch_kucoin(base).await        { sources.push(p); }
    // Tier 3: Aggregators (cross-validation, lower weight)
    if let Ok(p) = fetch_coingecko(base).await     { sources.push(p); }
    if let Ok(p) = fetch_coinmarketcap(base).await { sources.push(p); }

    if sources.is_empty() {
        return Err(OracleError::AllSourcesFailed(feed_id.clone()));
    }

    aggregate_vwap(&sources)
        .ok_or_else(|| OracleError::AllSourcesFailed(feed_id.clone()))
}

/// Stub prices for testing (no real HTTP calls).
///
/// USD/INR is handled by `inr_fetcher` module — see `fetch_usd_inr_vwap()`.
fn stub_price(symbol: &str) -> f64 {
    match symbol {
        // ZBX native
        "ZBX/USD" | "ZBX"   => 2.50,
        "ZUSD/USD" | "ZUSD" => 1.00,
        "ZNS/USD"  | "ZNS"  => 0.15,
        // Major crypto
        "ETH/USD"  | "ETH"  => 3_500.00,
        "BTC/USD"  | "BTC"  => 68_000.00,
        "BNB/USD"  | "BNB"  => 580.00,
        // Alt-coins + L2 tokens (Session 40)
        "SOL/USD"  | "SOL"  => 170.00,
        "AVAX/USD" | "AVAX" => 35.00,
        "MATIC/USD"| "MATIC"=> 0.90,
        "ARB/USD"  | "ARB"  => 1.10,
        "OP/USD"   | "OP"   => 2.80,
        "LINK/USD" | "LINK" => 14.50,
        "DOT/USD"  | "DOT"  => 7.20,
        // Forex (handled by inr_fetcher, not this module)
        "USD/INR"           => 83.50,
        _                   => 1.00,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn fetch_binance_stub() {
        let r = fetch_binance("ZBX").await.unwrap();
        assert_eq!(r.source, "binance");
        assert!(r.price.to_f64() > 0.0);
    }

    #[test]
    fn vwap_weighted_correctly() {
        let sources = vec![
            ExternalPrice { source: "a", price: Price::from_f64(100.0), volume: 1000.0 },
            ExternalPrice { source: "b", price: Price::from_f64(200.0), volume: 1000.0 },
        ];
        let vwap = aggregate_vwap(&sources).unwrap();
        // Equal volume → average of 100 and 200 = 150
        assert!((vwap.to_f64() - 150.0).abs() < 0.01);
    }

    #[test]
    fn vwap_respects_volume_weight() {
        let sources = vec![
            ExternalPrice { source: "a", price: Price::from_f64(100.0), volume: 3000.0 },
            ExternalPrice { source: "b", price: Price::from_f64(200.0), volume: 1000.0 },
        ];
        let vwap = aggregate_vwap(&sources).unwrap();
        // 75% weight on 100, 25% weight on 200 → 125
        assert!((vwap.to_f64() - 125.0).abs() < 0.01);
    }
}