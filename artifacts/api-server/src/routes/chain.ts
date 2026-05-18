import { Router, type IRouter } from "express";
import {
  GetChainInfoResponse,
  GetChainStatsResponse,
  GetChainActivityResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const CHAIN_ID           = 8989;
const TOTAL_SUPPLY_CAP   = 150_000_000;
const FOUNDATION_PREMINE = 9_990_000;
const AMM_POOL_SEED      = 20_000_000;
const BLOCK_REWARD       = 3;
const HALVING_INTERVAL   = 25_000_000;
const BASE_HEIGHT        = 2_847_312;
const START_TIME         = new Date("2025-01-01T00:00:00Z").getTime();

function getCurrentHeight(): number {
  return BASE_HEIGHT + Math.floor((Date.now() - START_TIME) / 5000);
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
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
    reward = reward / 2;
    halvingCount++;
  }
  return Math.min(mined, 120_010_000);
}

router.get("/chain/info", async (_req, res): Promise<void> => {
  const height = getCurrentHeight();
  res.json(
    GetChainInfoResponse.parse({
      chainId:          CHAIN_ID,
      chainName:        "Zebvix Mainnet",
      token:            "ZBX",
      decimals:         18,
      blockTime:        5,
      latestHeight:     height,
      totalSupplyCap:   TOTAL_SUPPLY_CAP.toString(),
      minValidatorStake:"100",
      minDelegatorStake:"10",
      consensus:        "HotStuff-BFT v2 (ZEP-022)",
      networkId:        "zbx-mainnet-1",
    })
  );
});

router.get("/chain/stats", async (_req, res): Promise<void> => {
  const height       = getCurrentHeight();
  const minedSupply  = calcMinedSupply(height);
  const circulating  = FOUNDATION_PREMINE + AMM_POOL_SEED + Math.floor(minedSupply * 0.62);
  const totalStaked  = Math.floor(circulating * 0.41);
  const nowSec       = Math.floor(Date.now() / 1000);
  const zbxPriceUsd  = 0.0847 + Math.sin(nowSec / 180) * 0.003;
  const tps          = parseFloat((2.3 + Math.sin(nowSec / 30) * 0.8).toFixed(2));
  const avgBlockTime = parseFloat((5.00 + seededRandom(Math.floor(nowSec / 60)) * 0.06).toFixed(2));

  res.json(
    GetChainStatsResponse.parse({
      latestHeight:      height,
      tps,
      avgBlockTime,
      totalTransactions: Math.floor(height * 2.31),
      totalAddresses:    84_312 + Math.floor(height / 200),
      activeValidators:  21,
      totalStaked:       totalStaked.toString(),
      circulatingSupply: circulating.toString(),
      marketCap:         (circulating * zbxPriceUsd).toFixed(2),
      zbxPriceUsd:       parseFloat(zbxPriceUsd.toFixed(4)),
    })
  );
});

router.get("/chain/activity", async (_req, res): Promise<void> => {
  const height  = getCurrentHeight();
  const nowSec  = Math.floor(Date.now() / 1000);
  const points  = [];
  for (let i = 23; i >= 0; i--) {
    const blockHeight = height - i;
    const seed        = blockHeight % 100000;
    const txCount     = Math.max(0, Math.floor(5 + Math.sin(seed / 3) * 4 + seededRandom(seed) * 6));
    const ts          = new Date(Date.now() - i * 5000).toISOString();
    points.push({ blockHeight, txCount, timestamp: ts });
  }
  res.json(GetChainActivityResponse.parse(points));
});

export default router;
