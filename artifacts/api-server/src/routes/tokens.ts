import { Router, type IRouter } from "express";
import { GetTokenStatsResponse } from "@workspace/api-zod";
import { getCurrentHeight } from "./blocks";

const router: IRouter = Router();

const TOTAL_SUPPLY_CAP = 150_000_000;
const BLOCK_REWARD = 3;
const HALVING_INTERVAL = 25_000_000;
const FOUNDATION_PREMINE = 9_990_000;
const AMM_POOL_SEED = 20_000_000;

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

function currentBlockReward(height: number): number {
  let reward = BLOCK_REWARD;
  let halvings = Math.floor(height / HALVING_INTERVAL);
  for (let i = 0; i < halvings && i < 10; i++) {
    reward = reward / 2;
  }
  return reward;
}

router.get("/tokens/stats", async (_req, res): Promise<void> => {
  const height = getCurrentHeight();
  const minedSupply = calcMinedSupply(height);
  const circulating = FOUNDATION_PREMINE + AMM_POOL_SEED + minedSupply * 0.62;
  const burned = minedSupply * 0.005;
  const halvingsSoFar = Math.floor(height / HALVING_INTERVAL);
  const nextHalvingBlock = (halvingsSoFar + 1) * HALVING_INTERVAL;
  const blocksUntilHalving = nextHalvingBlock - height;
  const totalStaked = circulating * 0.41;
  const stakingApr = 12.5 - halvingsSoFar * 1.2;

  res.json(
    GetTokenStatsResponse.parse({
      totalSupplyCap: TOTAL_SUPPLY_CAP.toString(),
      circulatingSupply: Math.floor(circulating).toString(),
      minedSupply: Math.floor(minedSupply).toString(),
      foundationPremine: FOUNDATION_PREMINE.toString(),
      ammPoolSeed: AMM_POOL_SEED.toString(),
      currentBlockReward: currentBlockReward(height),
      nextHalvingBlock,
      halvingInterval: HALVING_INTERVAL,
      blocksUntilHalving,
      percentMined: parseFloat(((minedSupply / 120_010_000) * 100).toFixed(2)),
      burnedSupply: Math.floor(burned).toString(),
      stakingApr: parseFloat(Math.max(stakingApr, 2).toFixed(2)),
    })
  );
});

export default router;
