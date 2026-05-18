import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { liquidityPoolsTable } from "@workspace/db";
import { sum } from "drizzle-orm";

const router: IRouter = Router();

const TOTAL_SUPPLY_CAP   = 150_000_000;
const FOUNDATION_PREMINE = 9_990_000;
const AMM_POOL_SEED      = 20_000_000;
const BLOCK_REWARD       = 3;
const HALVING_INTERVAL   = 25_000_000;
const BASE_HEIGHT        = 2_847_312;
const START_TIME         = new Date("2025-01-01T00:00:00Z").getTime();

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function getCurrentHeight(): number {
  return BASE_HEIGHT + Math.floor((Date.now() - START_TIME) / 5000);
}

function calcMinedSupply(height: number): number {
  let mined = 0;
  let reward = BLOCK_REWARD;
  let remaining = height;
  let halvingCount = 0;
  while (remaining > 0 && halvingCount < 10) {
    const blocksInEra = Math.min(remaining, HALVING_INTERVAL);
    mined += blocksInEra * reward;
    remaining -= blocksInEra;
    reward /= 2;
    halvingCount++;
  }
  return Math.min(mined, 120_010_000);
}

router.get("/analytics/overview", async (req, res): Promise<void> => {
  const days    = Math.min(365, Math.max(7, Number(req.query.days) || 30));
  const now     = Date.now();
  const height  = getCurrentHeight();
  const mined   = calcMinedSupply(height);
  const circulating = FOUNDATION_PREMINE + AMM_POOL_SEED + Math.floor(mined * 0.62);
  const burned      = Math.floor(mined * 0.005);

  const [poolRes] = await db
    .select({ tvl: sum(liquidityPoolsTable.tvlUsd) })
    .from(liquidityPoolsTable);
  const currentTvl = Number(poolRes?.tvl ?? 24_870_000);

  const basePrice = 0.0847;
  const priceHistory = Array.from({ length: days }, (_, i) => {
    const seed      = i * 7 + 42;
    const trend     = (i / days) * 0.008;
    const noise     = (seededRandom(seed) - 0.48) * 0.012;
    const dayOffset = days - i;
    const ms        = now - dayOffset * 86_400_000;
    const price     = Math.max(0.05, basePrice - 0.01 + trend + noise);
    return {
      date:   new Date(ms).toISOString().slice(0, 10),
      price:  parseFloat(price.toFixed(5)),
      volume: Math.round(400_000 + seededRandom(seed + 1) * 1_600_000),
      tvl:    0,
    };
  });

  const tvlHistory = Array.from({ length: days }, (_, i) => {
    const seed      = i * 13 + 77;
    const dayOffset = days - i;
    const ms        = now - dayOffset * 86_400_000;
    const growth    = (i / days) * 0.15;
    const noise     = (seededRandom(seed) - 0.47) * 0.05;
    return {
      date:   new Date(ms).toISOString().slice(0, 10),
      price:  0,
      volume: 0,
      tvl:    parseFloat((currentTvl * (0.80 + growth + noise)).toFixed(2)),
    };
  });

  const volumeHistory = Array.from({ length: days }, (_, i) => {
    const seed      = i * 19 + 11;
    const dayOffset = days - i;
    const ms        = now - dayOffset * 86_400_000;
    return {
      date:   new Date(ms).toISOString().slice(0, 10),
      price:  0,
      volume: Math.round(300_000 + seededRandom(seed) * 2_000_000),
      tvl:    0,
    };
  });

  const currentPrice   = priceHistory[priceHistory.length - 1]?.price ?? basePrice;
  const yesterday      = priceHistory[priceHistory.length - 2]?.price ?? basePrice;
  const weekAgo        = priceHistory[Math.max(0, priceHistory.length - 8)]?.price ?? basePrice;
  const priceChange24h = ((currentPrice - yesterday) / yesterday) * 100;
  const priceChange7d  = ((currentPrice - weekAgo)   / weekAgo)   * 100;
  const marketCap      = currentPrice * circulating;
  const fdv            = currentPrice * TOTAL_SUPPLY_CAP;

  res.json({
    priceHistory,
    tvlHistory,
    volumeHistory,
    currentPrice,
    priceChange24h:        parseFloat(priceChange24h.toFixed(2)),
    priceChange7d:         parseFloat(priceChange7d.toFixed(2)),
    marketCap:             parseFloat(marketCap.toFixed(2)),
    fullyDilutedValuation: parseFloat(fdv.toFixed(2)),
    totalSupplyCap:        TOTAL_SUPPLY_CAP,
    circulatingSupply:     circulating,
    minedSupply:           Math.floor(mined),
    burnedSupply:          burned,
  });
});

export default router;
