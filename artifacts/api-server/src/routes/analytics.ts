import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { liquidityPoolsTable } from "@workspace/db";
import { sum } from "drizzle-orm";
import {
  parseNetwork,
  getCurrentHeightForNetwork,
  calcMinedSupply,
  TESTNET_FOUNDATION_PREMINE,
  TESTNET_AMM_POOL_SEED,
} from "./network-config";

const router: IRouter = Router();

const FOUNDATION_PREMINE = 9_990_000;
const AMM_POOL_SEED      = 20_000_000;

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

router.get("/analytics/overview", async (req, res): Promise<void> => {
  const cfg    = parseNetwork(req);
  const days   = Math.min(365, Math.max(7, Number(req.query.days) || 30));
  const now    = Date.now();
  const height = getCurrentHeightForNetwork(cfg);
  const mined  = calcMinedSupply(height, cfg);

  const premine    = cfg.name === "testnet" ? TESTNET_FOUNDATION_PREMINE : FOUNDATION_PREMINE;
  const ammSeed    = cfg.name === "testnet" ? TESTNET_AMM_POOL_SEED      : AMM_POOL_SEED;
  const circulating = premine + ammSeed + Math.floor(mined * 0.62);
  const burned      = Math.floor(mined * 0.005);

  const tvlMultiplier = cfg.name === "testnet" ? 0.02 : 1;
  const [poolRes] = await db
    .select({ tvl: sum(liquidityPoolsTable.tvlUsd) })
    .from(liquidityPoolsTable);
  const currentTvl = Number(poolRes?.tvl ?? 24_870_000) * tvlMultiplier;

  const basePrice = cfg.basePriceUsd;
  const priceHistory = Array.from({ length: days }, (_, i) => {
    const seed      = i * 7 + (cfg.name === "testnet" ? 99 : 42);
    const trend     = (i / days) * (cfg.name === "testnet" ? 0.0001 : 0.008);
    const noise     = (seededRandom(seed) - 0.48) * (cfg.name === "testnet" ? 0.0002 : 0.012);
    const dayOffset = days - i;
    const ms        = now - dayOffset * 86_400_000;
    const price     = Math.max(cfg.name === "testnet" ? 0.0001 : 0.05, basePrice - basePrice * 0.1 + trend + noise);
    return {
      date:   new Date(ms).toISOString().slice(0, 10),
      price:  parseFloat(price.toFixed(cfg.name === "testnet" ? 6 : 5)),
      volume: Math.round((cfg.name === "testnet" ? 5_000 : 400_000) + seededRandom(seed + 1) * (cfg.name === "testnet" ? 50_000 : 1_600_000)),
      tvl:    0,
    };
  });

  const tvlHistory = Array.from({ length: days }, (_, i) => {
    const seed      = i * 13 + (cfg.name === "testnet" ? 55 : 77);
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
    const seed      = i * 19 + (cfg.name === "testnet" ? 33 : 11);
    const dayOffset = days - i;
    const ms        = now - dayOffset * 86_400_000;
    return {
      date:   new Date(ms).toISOString().slice(0, 10),
      price:  0,
      volume: Math.round((cfg.name === "testnet" ? 3_000 : 300_000) + seededRandom(seed) * (cfg.name === "testnet" ? 40_000 : 2_000_000)),
      tvl:    0,
    };
  });

  const currentPrice   = priceHistory[priceHistory.length - 1]?.price ?? basePrice;
  const yesterday      = priceHistory[priceHistory.length - 2]?.price ?? basePrice;
  const weekAgo        = priceHistory[Math.max(0, priceHistory.length - 8)]?.price ?? basePrice;
  const priceChange24h = ((currentPrice - yesterday) / yesterday) * 100;
  const priceChange7d  = ((currentPrice - weekAgo)   / weekAgo)   * 100;
  const marketCap      = currentPrice * circulating;
  const fdv            = currentPrice * cfg.totalSupplyCap;

  res.json({
    network:               cfg.name,
    chainId:               cfg.chainId,
    priceHistory,
    tvlHistory,
    volumeHistory,
    currentPrice,
    priceChange24h:        parseFloat(priceChange24h.toFixed(2)),
    priceChange7d:         parseFloat(priceChange7d.toFixed(2)),
    marketCap:             parseFloat(marketCap.toFixed(2)),
    fullyDilutedValuation: parseFloat(fdv.toFixed(2)),
    totalSupplyCap:        cfg.totalSupplyCap,
    circulatingSupply:     circulating,
    minedSupply:           Math.floor(mined),
    burnedSupply:          burned,
  });
});

export default router;
