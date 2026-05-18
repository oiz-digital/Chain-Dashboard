import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { liquidityPoolsTable } from "@workspace/db";
import { sum } from "drizzle-orm";

const router: IRouter = Router();

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

router.get("/analytics/overview", async (req, res): Promise<void> => {
  const days = Math.min(365, Math.max(7, Number(req.query.days) || 30));
  const now  = Date.now();

  const [poolRes] = await db.select({ tvl: sum(liquidityPoolsTable.tvlUsd) }).from(liquidityPoolsTable);
  const currentTvl = Number(poolRes?.tvl ?? 24_870_000);

  const basePrice    = 0.0847;
  const priceHistory = Array.from({ length: days }, (_, i) => {
    const seed = i * 7 + 42;
    const trend     = i / days * 0.008;
    const noise     = (seededRandom(seed) - 0.48) * 0.012;
    const dayOffset = days - i;
    const ms = now - dayOffset * 86_400_000;
    const price = Math.max(0.05, basePrice - 0.01 + trend + noise);
    return {
      date: new Date(ms).toISOString().slice(0, 10),
      price: parseFloat(price.toFixed(5)),
      volume: Math.round(400_000 + seededRandom(seed + 1) * 1_600_000),
      tvl: 0,
    };
  });

  const tvlHistory = Array.from({ length: days }, (_, i) => {
    const seed = i * 13 + 77;
    const dayOffset = days - i;
    const ms = now - dayOffset * 86_400_000;
    const growth = i / days * 0.15;
    const noise  = (seededRandom(seed) - 0.47) * 0.05;
    return {
      date: new Date(ms).toISOString().slice(0, 10),
      price: 0,
      volume: 0,
      tvl: parseFloat((currentTvl * (0.80 + growth + noise)).toFixed(2)),
    };
  });

  const volumeHistory = Array.from({ length: days }, (_, i) => {
    const seed = i * 19 + 11;
    const dayOffset = days - i;
    const ms = now - dayOffset * 86_400_000;
    return {
      date: new Date(ms).toISOString().slice(0, 10),
      price: 0,
      volume: Math.round(300_000 + seededRandom(seed) * 2_000_000),
      tvl: 0,
    };
  });

  const currentPrice    = priceHistory[priceHistory.length - 1]?.price ?? basePrice;
  const yesterday       = priceHistory[priceHistory.length - 2]?.price ?? basePrice;
  const weekAgo         = priceHistory[Math.max(0, priceHistory.length - 8)]?.price ?? basePrice;
  const priceChange24h  = ((currentPrice - yesterday) / yesterday * 100);
  const priceChange7d   = ((currentPrice - weekAgo) / weekAgo * 100);
  const totalSupply     = 500_000_000;
  const circulating     = 187_500_000;
  const marketCap       = currentPrice * circulating;
  const fdv             = currentPrice * totalSupply;

  res.json({
    priceHistory,
    tvlHistory,
    volumeHistory,
    currentPrice,
    priceChange24h: parseFloat(priceChange24h.toFixed(2)),
    priceChange7d:  parseFloat(priceChange7d.toFixed(2)),
    marketCap:  parseFloat(marketCap.toFixed(2)),
    fullyDilutedValuation: parseFloat(fdv.toFixed(2)),
  });
});

export default router;
