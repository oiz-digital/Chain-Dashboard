//! DEX (decentralised exchange) price fetchers.
//!
//! Complements CEX prices with on-chain liquidity pool prices.
//! DEX prices are manipulation-resistant when combined with TWAP (see `twap.rs`).
//!
//! ## Supported DEX protocols
//!
//! | Protocol | Network | Algorithm | Notes |
//! |----------|---------|-----------|-------|
//! | Uniswap V3 | Ethereum, Arbitrum, Optimism, Polygon | CLAMM | `slot0` sqrtPriceX96 → price |
//! | PancakeSwap V3 | BSC | CLAMM | Same interface as Univ3 |
//! | Trader Joe V2 | Avalanche | LB Bins | Bin-based AMM |
//! | ZBX DEX | ZBX Chain | CLAMM | Native ZBX AMM (ZEP-014) |
//! | QuickSwap V3 | Polygon | CLAMM | Uniswap V3 fork |
//!
//! ## Price derivation from Uniswap V3 slot0
//!
//! Uniswap V3 stores price as `sqrtPriceX96` in `slot0`:
//! ```
//! price_token1_per_token0 = (sqrtPriceX96 / 2^96)^2
//! ```
//! This derivation is exact (no floating point needed) but requires
//! reading the pool's `slot0` via `eth_call` on the pool contract.
//!
//! ZBX oracle does NOT call DEX contracts directly in this module.
//! Instead, it relies on pre-indexed pool data from a ZBX-hosted
//! subgraph or on-chain price cache — avoiding RPC latency in the hot path.
//!
//! ## Manipulation protection
//!
//! DEX spot prices (current tick) can be manipulated in a single block.
//! The oracle uses DEX prices only as one input into the multi-source VWAP,
//! with lower weight than CEX prices. True DEX protection comes from TWAP
//! (see `twap.rs`), which averages over many blocks.

use crate::feed::{FeedId, Price};
use serde::{Serialize, Deserialize};

/// Liquidity pool protocols supported by this fetcher.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum DexProtocol {
    UniswapV3,
    PancakeSwapV3,
    TraderJoeV2,
    ZbxDex,
    QuickSwapV3,
}

impl DexProtocol {
    pub fn name(&self) -> &'static str {
        match self {
            Self::UniswapV3     => "uniswap-v3",
            Self::PancakeSwapV3 => "pancakeswap-v3",
            Self::TraderJoeV2   => "traderjoe-v2",
            Self::ZbxDex        => "zbx-dex",
            Self::QuickSwapV3   => "quickswap-v3",
        }
    }

    /// All supported protocols.
    pub fn all() -> Vec<Self> {
        vec![
            Self::UniswapV3,
            Self::PancakeSwapV3,
            Self::TraderJoeV2,
            Self::ZbxDex,
            Self::QuickSwapV3,
        ]
    }
}

/// Fee tier of an AMM pool (basis points × 10 = pips).
/// e.g. `500` = 0.05%, `3000` = 0.30%, `10000` = 1.00%.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum FeeTier {
    /// 0.01% — extreme tight; stable pairs (USDC/USDT).
    OneBP,
    /// 0.05% — tight; high-volume pairs (ETH/USDC).
    FiveBP,
    /// 0.30% — standard; most pairs.
    ThirtyBP,
    /// 1.00% — wide; exotic / low-liquidity pairs.
    OneHundredBP,
    /// Custom fee tier (raw pips value).
    Custom(u32),
}

impl FeeTier {
    pub fn as_pips(self) -> u32 {
        match self {
            Self::OneBP         => 100,
            Self::FiveBP        => 500,
            Self::ThirtyBP      => 3_000,
            Self::OneHundredBP  => 10_000,
            Self::Custom(p)     => p,
        }
    }

    pub fn as_pct(self) -> f64 { self.as_pips() as f64 / 1_000_000.0 * 100.0 }
}

/// A DEX liquidity pool descriptor.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DexPool {
    /// The DEX protocol.
    pub protocol:    DexProtocol,
    /// EVM chain this pool lives on.
    pub chain_id:    u64,
    /// Pool contract address (20 bytes).
    pub address:     [u8; 20],
    /// Token pair (feed this pool prices).
    pub feed_id:     FeedId,
    /// Pool fee tier.
    pub fee_tier:    FeeTier,
    /// Total value locked in USD (informational — used for weight calculation).
    pub tvl_usd:     f64,
    /// Whether `token0` is the base (if false, price is inverted).
    pub token0_base: bool,
}

impl DexPool {
    /// Compute VWAP weight for this pool based on TVL.
    /// Pools with more TVL are harder to manipulate → higher weight.
    pub fn weight(&self) -> f64 {
        // Weight formula: log10(TVL) * 100_000 (bounded between 10k and 10M)
        let w = self.tvl_usd.max(1.0).log10() * 100_000.0;
        w.clamp(10_000.0, 10_000_000.0)
    }
}

/// One price observation from a DEX pool.
#[derive(Clone, Debug)]
pub struct DexPrice {
    /// Which pool produced this price.
    pub pool:        DexPool,
    /// Spot price from this pool.
    pub spot:        Price,
    /// TWAP from this pool (if available from the pool's on-chain accumulator).
    pub twap_30min:  Option<Price>,
    /// Block number when this price was read.
    pub block:       u64,
    /// Unix timestamp of the block.
    pub timestamp:   u64,
}

// ── Uniswap V3 price math ─────────────────────────────────────────────────────

/// Convert Uniswap V3 `sqrtPriceX96` to a decimal price.
///
/// Formula: `price = (sqrtPriceX96 / 2^96)^2 × 10^(decimals1 - decimals0)`
///
/// For token pairs where `token0` has 18 decimals and `token1` has 6 decimals
/// (e.g. WETH/USDC), an adjustment of `10^(18-6) = 10^12` is needed.
///
/// This function computes the raw ratio — callers apply the decimal adjustment.
pub fn sqrt_price_x96_to_price(sqrt_price_x96: u128) -> f64 {
    // Cast to f64 — precision is sufficient for 8-decimal oracle prices.
    let sqrt = sqrt_price_x96 as f64 / (1u128 << 96) as f64;
    sqrt * sqrt
}

/// Invert a price ratio (price of token1 in token0 → price of token0 in token1).
pub fn invert_price(price: f64) -> f64 {
    if price <= 0.0 { 0.0 } else { 1.0 / price }
}

// ── Multi-source DEX aggregation ──────────────────────────────────────────────

/// Aggregate multiple DEX pool prices into a single TVL-weighted price.
///
/// Uses TVL as weight rather than volume:
/// - TVL is harder to fake than reported 24h volume
/// - Larger pools are harder to manipulate
pub fn aggregate_dex_prices(pools: &[DexPrice]) -> Option<Price> {
    if pools.is_empty() { return None; }

    let total_weight: f64 = pools.iter().map(|p| p.pool.weight()).sum();
    if total_weight <= 0.0 {
        // Fallback: simple median
        let mut prices: Vec<f64> = pools.iter().map(|p| p.spot.to_f64()).collect();
        prices.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let mid = prices.len() / 2;
        return Some(Price::from_f64(if prices.len() % 2 == 1 {
            prices[mid]
        } else {
            (prices[mid - 1] + prices[mid]) / 2.0
        }));
    }

    let weighted = pools.iter()
        .map(|p| p.spot.to_f64() * p.pool.weight())
        .sum::<f64>() / total_weight;

    Some(Price::from_f64(weighted))
}

// ── Stub DEX fetchers ─────────────────────────────────────────────────────────

/// Fetch price from Uniswap V3 (stub).
///
/// Production: reads `slot0` from pool contract via `eth_call` on Ethereum.
pub async fn fetch_uniswap_v3(feed_id: &FeedId) -> Result<DexPrice, crate::error::OracleError> {
    let (price_f, tvl) = stub_dex_price(feed_id);
    Ok(DexPrice {
        pool: DexPool {
            protocol:    DexProtocol::UniswapV3,
            chain_id:    1,
            address:     [0u8; 20],
            feed_id:     feed_id.clone(),
            fee_tier:    FeeTier::ThirtyBP,
            tvl_usd:     tvl,
            token0_base: true,
        },
        spot:       Price::from_f64(price_f),
        twap_30min: Some(Price::from_f64(price_f * 0.999)), // TWAP slightly below spot
        block:      21_000_000,
        timestamp:  1_750_000_000,
    })
}

/// Fetch price from PancakeSwap V3 on BSC (stub).
pub async fn fetch_pancakeswap_v3(feed_id: &FeedId) -> Result<DexPrice, crate::error::OracleError> {
    let (price_f, tvl) = stub_dex_price(feed_id);
    Ok(DexPrice {
        pool: DexPool {
            protocol:    DexProtocol::PancakeSwapV3,
            chain_id:    56,
            address:     [0u8; 20],
            feed_id:     feed_id.clone(),
            fee_tier:    FeeTier::FiveBP,
            tvl_usd:     tvl * 0.4,  // BSC pools typically smaller than ETH
            token0_base: true,
        },
        spot:       Price::from_f64(price_f * 0.998),
        twap_30min: Some(Price::from_f64(price_f * 0.997)),
        block:      38_000_000,
        timestamp:  1_750_000_000,
    })
}

/// Fetch price from the native ZBX DEX (stub — ZEP-014 canonical pool).
pub async fn fetch_zbx_dex(feed_id: &FeedId) -> Result<DexPrice, crate::error::OracleError> {
    let (price_f, tvl) = stub_dex_price(feed_id);
    Ok(DexPrice {
        pool: DexPool {
            protocol:    DexProtocol::ZbxDex,
            chain_id:    8_989,
            address:     [0u8; 20],
            feed_id:     feed_id.clone(),
            fee_tier:    FeeTier::ThirtyBP,
            tvl_usd:     tvl * 0.2,  // ZBX DEX TVL bootstrapping phase
            token0_base: true,
        },
        spot:       Price::from_f64(price_f * 1.001),
        twap_30min: Some(Price::from_f64(price_f)),
        block:      500_000,
        timestamp:  1_750_000_000,
    })
}

/// Fetch and aggregate DEX prices from all sources for a feed.
pub async fn fetch_dex_price_aggregate(feed_id: &FeedId)
    -> Result<Price, crate::error::OracleError>
{
    let mut pools = Vec::new();

    if let Ok(p) = fetch_uniswap_v3(feed_id).await    { pools.push(p); }
    if let Ok(p) = fetch_pancakeswap_v3(feed_id).await { pools.push(p); }
    if let Ok(p) = fetch_zbx_dex(feed_id).await        { pools.push(p); }

    aggregate_dex_prices(&pools)
        .ok_or_else(|| crate::error::OracleError::AllSourcesFailed(feed_id.clone()))
}

// ── Stub prices ───────────────────────────────────────────────────────────────

fn stub_dex_price(feed_id: &FeedId) -> (f64, f64) {
    match feed_id.0.as_str() {
        "ZBX/USD"  => (2.50,      5_000_000.0),
        "ZUSD/USD" => (1.00,      20_000_000.0),
        "ETH/USD"  => (3_500.0,  500_000_000.0),
        "BTC/USD"  => (68_000.0, 200_000_000.0),
        "BNB/USD"  => (580.0,     50_000_000.0),
        "SOL/USD"  => (170.0,     30_000_000.0),
        "MATIC/USD"=> (0.90,      15_000_000.0),
        "ARB/USD"  => (1.10,      10_000_000.0),
        "OP/USD"   => (2.80,       8_000_000.0),
        "AVAX/USD" => (35.0,      20_000_000.0),
        _          => (1.00,       1_000_000.0),
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::feed::FeedId;

    #[test]
    fn sqrt_price_x96_round_trip() {
        // For a 1:1 pool (e.g. USDC/USDT), sqrtPriceX96 = 2^96
        let sqrt = 1u128 << 96;
        let price = sqrt_price_x96_to_price(sqrt);
        assert!((price - 1.0).abs() < 1e-6, "1:1 pool should give price 1.0, got {price}");
    }

    #[test]
    fn invert_price_correct() {
        assert!((invert_price(2.0) - 0.5).abs() < 1e-9);
        assert!((invert_price(0.5) - 2.0).abs() < 1e-9);
        assert_eq!(invert_price(0.0), 0.0);
    }

    #[test]
    fn aggregate_empty_returns_none() {
        assert!(aggregate_dex_prices(&[]).is_none());
    }

    #[test]
    fn aggregate_tvl_weighted() {
        let make_pool = |price: f64, tvl: f64| -> DexPrice {
            let pool = DexPool {
                protocol: DexProtocol::UniswapV3, chain_id: 1,
                address: [0u8; 20], feed_id: FeedId::zbx_usd(),
                fee_tier: FeeTier::ThirtyBP, tvl_usd: tvl, token0_base: true,
            };
            DexPrice {
                pool,
                spot: Price::from_f64(price),
                twap_30min: None,
                block: 1, timestamp: 1000,
            }
        };

        let pools = vec![
            make_pool(100.0, 1_000_000.0),  // $1M TVL
            make_pool(200.0, 1_000_000.0),  // $1M TVL (equal weight)
        ];
        let result = aggregate_dex_prices(&pools).unwrap();
        // Equal TVL → average = 150
        assert!((result.to_f64() - 150.0).abs() < 1.0,
            "equal-TVL aggregate should be ~150, got {}", result.to_f64());
    }

    #[test]
    fn fee_tier_pct_correct() {
        assert!((FeeTier::OneBP.as_pct() - 0.01).abs() < 0.0001);
        assert!((FeeTier::ThirtyBP.as_pct() - 0.30).abs() < 0.001);
        assert!((FeeTier::OneHundredBP.as_pct() - 1.00).abs() < 0.001);
    }

    #[tokio::test]
    async fn dex_aggregate_returns_valid_price() {
        let price = fetch_dex_price_aggregate(&FeedId::zbx_usd()).await.unwrap();
        assert!(price.to_f64() > 0.0);
        assert!(price.to_f64() < 10_000.0);
    }
}
