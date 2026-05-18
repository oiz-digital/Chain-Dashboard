import { Router, type IRouter } from "express";
import {
  ListBlocksQueryParams,
  GetBlockParams,
  ListBlocksResponse,
  GetBlockResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const VALIDATORS = [
  "0x3a8F4b291cE7D3A9Fc2b8E14D6a905B7c3f1e2d",
  "0x7c2E9d1F8B4A3C6e5D0b9F2a7e4C8d1B3f6A9c2",
  "0xB5d4E7f2A9C3b8F1e6D0a5C2b9E4f7A3d8B1e6F",
  "0xD1F6a3B8e5C2d9F4b7E0a3C8d5F2b9E6a1D4c7B",
  "0x9E2b7D4f1A6c3B8e5F0d7A2b9E4c1F6d3B8a5E2",
];

const MONIKERS: Record<string, string> = {
  "0x3a8F4b291cE7D3A9Fc2b8E14D6a905B7c3f1e2d": "ZebvixNode-1",
  "0x7c2E9d1F8B4A3C6e5D0b9F2a7e4C8d1B3f6A9c2": "AlphaValidator",
  "0xB5d4E7f2A9C3b8F1e6D0a5C2b9E4f7A3d8B1e6F": "NovaMint",
  "0xD1F6a3B8e5C2d9F4b7E0a3C8d5F2b9E6a1D4c7B": "BlockFusion",
  "0x9E2b7D4f1A6c3B8e5F0d7A2b9E4c1F6d3B8a5E2": "ZenithStake",
};

function hashFromHeight(height: number, salt = 0): string {
  const seed = (height * 1000003 + salt * 999983) >>> 0;
  const hex1 = (seed * 1664525 + 1013904223) >>> 0;
  const hex2 = (hex1 * 1664525 + 1013904223) >>> 0;
  const hex3 = (hex2 * 1664525 + 1013904223) >>> 0;
  const hex4 = (hex3 * 1664525 + 1013904223) >>> 0;
  return (
    "0x" +
    [hex1, hex2, hex3, hex4]
      .map((n) => n.toString(16).padStart(8, "0"))
      .join("")
  );
}

function getCurrentHeight(): number {
  const base = 2_847_312;
  return base + Math.floor((Date.now() - new Date("2025-01-01").getTime()) / 5000);
}

function blockData(height: number) {
  const validatorIdx = height % VALIDATORS.length;
  const validator = VALIDATORS[validatorIdx];
  const txCount = Math.max(0, Math.floor(5 + Math.sin(height / 3) * 4 + (height % 7)));
  const gasUsed = txCount * 21000 + Math.floor(height % 500) * 1000;
  const gasLimit = 30_000_000;
  const size = 1200 + txCount * 250 + (height % 300);
  const secondsAgo = (getCurrentHeight() - height) * 5;
  const timestamp = new Date(Date.now() - secondsAgo * 1000).toISOString();

  return {
    height,
    hash: hashFromHeight(height),
    parentHash: hashFromHeight(height - 1),
    timestamp,
    txCount,
    validator,
    gasUsed,
    gasLimit,
    size,
    reward: "3",
    stateRoot: hashFromHeight(height, 1),
    txHash: hashFromHeight(height, 2),
  };
}

router.get("/blocks", async (req, res): Promise<void> => {
  const query = ListBlocksQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const page = query.data.page ?? 1;
  const limit = Math.min(query.data.limit ?? 20, 50);
  const latestHeight = getCurrentHeight();
  const startHeight = latestHeight - (page - 1) * limit;

  const blocks = [];
  for (let i = 0; i < limit; i++) {
    const h = startHeight - i;
    if (h < 1) break;
    const b = blockData(h);
    blocks.push({
      height: b.height,
      hash: b.hash,
      timestamp: b.timestamp,
      txCount: b.txCount,
      validator: b.validator,
      gasUsed: b.gasUsed,
      gasLimit: b.gasLimit,
      size: b.size,
      reward: b.reward,
    });
  }

  res.json(
    ListBlocksResponse.parse({
      blocks,
      total: latestHeight,
      page,
      limit,
    })
  );
});

router.get("/blocks/:height", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.height) ? req.params.height[0] : req.params.height;
  const params = GetBlockParams.safeParse({ height: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const height = params.data.height;
  const latestHeight = getCurrentHeight();
  if (height < 1 || height > latestHeight) {
    res.status(404).json({ error: "Block not found" });
    return;
  }

  const b = blockData(height);
  const txs = [];
  for (let i = 0; i < b.txCount; i++) {
    const txHash = hashFromHeight(height, i + 10);
    const types = ["transfer", "stake", "delegate", "contract", "reward"] as const;
    const type = types[i % types.length];
    txs.push({
      hash: txHash,
      blockHeight: height,
      timestamp: b.timestamp,
      from: VALIDATORS[i % VALIDATORS.length],
      to: VALIDATORS[(i + 1) % VALIDATORS.length],
      amount: (Math.random() * 100 + 0.001).toFixed(6),
      fee: "0.001",
      status: "success" as const,
      type,
    });
  }

  res.json(
    GetBlockResponse.parse({
      ...b,
      transactions: txs,
    })
  );
});

export { VALIDATORS, MONIKERS, hashFromHeight, getCurrentHeight, blockData };
export default router;
