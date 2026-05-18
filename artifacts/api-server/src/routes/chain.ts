import { Router, type IRouter } from "express";
import {
  GetChainInfoResponse,
  GetChainStatsResponse,
  GetChainActivityResponse,
} from "@workspace/api-zod";
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

router.get("/chain/info", async (req, res): Promise<void> => {
  const cfg    = parseNetwork(req);
  const height = getCurrentHeightForNetwork(cfg);
  res.json(
    GetChainInfoResponse.parse({
      chainId:          cfg.chainId,
      chainName:        cfg.name === "testnet" ? "Zebvix Testnet" : "Zebvix Mainnet",
      token:            "ZBX",
      decimals:         18,
      blockTime:        cfg.blockTimeSeconds,
      latestHeight:     height,
      totalSupplyCap:   cfg.totalSupplyCap.toString(),
      minValidatorStake:cfg.minValidatorStake.toString(),
      minDelegatorStake:cfg.minDelegatorStake.toString(),
      consensus:        "HotStuff-BFT v2 (ZEP-022)",
      networkId:        cfg.networkId,
    })
  );
});

router.get("/chain/stats", async (req, res): Promise<void> => {
  const cfg          = parseNetwork(req);
  const height       = getCurrentHeightForNetwork(cfg);
  const minedSupply  = calcMinedSupply(height, cfg);
  const premine      = cfg.name === "testnet" ? TESTNET_FOUNDATION_PREMINE : FOUNDATION_PREMINE;
  const ammSeed      = cfg.name === "testnet" ? TESTNET_AMM_POOL_SEED      : AMM_POOL_SEED;
  const circulating  = premine + ammSeed + Math.floor(minedSupply * 0.62);
  const totalStaked  = Math.floor(circulating * 0.41);
  const nowSec       = Math.floor(Date.now() / 1000);
  const priceNoise   = cfg.name === "testnet" ? 0.00005 : 0.003;
  const zbxPriceUsd  = cfg.basePriceUsd + Math.sin(nowSec / 180) * priceNoise;
  const tpsBase      = cfg.name === "testnet" ? 1.2 : 2.3;
  const tps          = parseFloat((tpsBase + Math.sin(nowSec / 30) * 0.5).toFixed(2));
  const avgBlockTime = parseFloat((cfg.blockTimeSeconds + seededRandom(Math.floor(nowSec / 60)) * 0.06).toFixed(2));

  res.json(
    GetChainStatsResponse.parse({
      latestHeight:      height,
      tps,
      avgBlockTime,
      totalTransactions: Math.floor(height * (cfg.name === "testnet" ? 1.2 : 2.31)),
      totalAddresses:    cfg.name === "testnet"
                           ? 4_120 + Math.floor(height / 500)
                           : 84_312 + Math.floor(height / 200),
      activeValidators:  cfg.validatorCount,
      totalStaked:       totalStaked.toString(),
      circulatingSupply: circulating.toString(),
      marketCap:         (circulating * zbxPriceUsd).toFixed(2),
      zbxPriceUsd:       parseFloat(zbxPriceUsd.toFixed(cfg.name === "testnet" ? 6 : 4)),
    })
  );
});

router.get("/chain/activity", async (req, res): Promise<void> => {
  const cfg    = parseNetwork(req);
  const height = getCurrentHeightForNetwork(cfg);
  const points = [];
  for (let i = 23; i >= 0; i--) {
    const blockHeight = height - i;
    const seed        = blockHeight % 100000;
    const tpsBase     = cfg.name === "testnet" ? 2 : 5;
    const txCount     = Math.max(0, Math.floor(tpsBase + Math.sin(seed / 3) * 3 + seededRandom(seed) * 4));
    const ts          = new Date(Date.now() - i * cfg.blockTimeSeconds * 1000).toISOString();
    points.push({ blockHeight, txCount, timestamp: ts });
  }
  res.json(GetChainActivityResponse.parse(points));
});

export default router;
