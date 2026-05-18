import { createHash } from "crypto";
import { Router, type IRouter } from "express";
import {
  ListBlocksQueryParams,
  GetBlockParams,
  ListBlocksResponse,
  GetBlockResponse,
} from "@workspace/api-zod";
import {
  type NetworkConfig,
  MAINNET_CONFIG,
  TESTNET_VALIDATORS,
  TESTNET_MONIKERS,
  getCurrentHeightForNetwork,
  parseNetwork,
} from "./network-config";

const router: IRouter = Router();

export const VALIDATORS = [
  "0x3a8F4b291cE7D3A9Fc2b8E14D6a905B7c3f1e2d",
  "0x7c2E9d1F8B4A3C6e5D0b9F2a7e4C8d1B3f6A9c2",
  "0xB5d4E7f2A9C3b8F1e6D0a5C2b9E4f7A3d8B1e6F",
  "0xD1F6a3B8e5C2d9F4b7E0a3C8d5F2b9E6a1D4c7B",
  "0x9E2b7D4f1A6c3B8e5F0d7A2b9E4c1F6d3B8a5E2",
  "0xA4c7F9e2B5D8a1C6f3E0b7D4a9C2e5F8b1A6d3C",
  "0xF2a8D5b3E6c1A9f4B7e0C3d8F5a2B9e6C1d4A7f",
  "0x6B9c3E0f7A4d1B8e5C2a9F6b3D0e7C4a1B8f5E2",
  "0xC8e5F2a9D6b3E0c7A4f1B8e5C2d9F6a3B0e7D4c",
  "0x1D4f8B2e6A9c3F0b7E4d1A8c5F2b9E6a3D0f7B4",
  "0xE3b0C4f8A9d6B3e0F7a4C1b8E5d2A9f6C3b0E7d4",
  "0x2F5a9D3b7E0c4A8f1B6e3D0a7F4c1B8e5A2d9F6",
  "0x7A1d4F8b2E6c9A3f0B7e4D1a8C5f2B9e6A3d0F7",
  "0x4C8e1F5a9D3b6E0c7A4f1B8e5C2d9F6a3B0e7D4",
  "0xB0e7D4c1F8a5E2b9C6f3A0d7B4e1F8c5A2b9E6d3",
  "0x9F6a3D0f7B4e1C8a5E2b9F6c3A0d7B4e1F8c5A2",
  "0x5E2b9F6a3D0c7F4b1E8a5C2d9F6a3B0e7D4c1F8",
  "0xD7b4E1f8C5a2B9e6C3f0A7d4B1e8F5c2A9b6E3d0",
  "0x8C5a2D9f6A3b0E7d4C1f8B5a2E9f6C3a0D7b4E1",
  "0x3A0d7B4e1F8c5A2b9E6c3F0a7D4b1E8f5C2a9B6",
  "0xF5c2A9b6E3d0F7b4C1e8A5d2B9f6C3a0D7b4E1f8",
];

export const MONIKERS: Record<string, string> = {
  "0x3a8F4b291cE7D3A9Fc2b8E14D6a905B7c3f1e2d": "ZebvixNode-1",
  "0x7c2E9d1F8B4A3C6e5D0b9F2a7e4C8d1B3f6A9c2": "AlphaValidator",
  "0xB5d4E7f2A9C3b8F1e6D0a5C2b9E4f7A3d8B1e6F": "NovaMint",
  "0xD1F6a3B8e5C2d9F4b7E0a3C8d5F2b9E6a1D4c7B": "BlockFusion",
  "0x9E2b7D4f1A6c3B8e5F0d7A2b9E4c1F6d3B8a5E2": "ZenithStake",
  "0xA4c7F9e2B5D8a1C6f3E0b7D4a9C2e5F8b1A6d3C": "CryptoForge-6",
  "0xF2a8D5b3E6c1A9f4B7e0C3d8F5a2B9e6C1d4A7f": "NexusNode-7",
  "0x6B9c3E0f7A4d1B8e5C2a9F6b3D0e7C4a1B8f5E2": "StellarChain-8",
  "0xC8e5F2a9D6b3E0c7A4f1B8e5C2d9F6a3B0e7D4c": "QuantumValidator",
  "0x1D4f8B2e6A9c3F0b7E4d1A8c5F2b9E6a3D0f7B4": "DeepStake-10",
  "0xE3b0C4f8A9d6B3e0F7a4C1b8E5d2A9f6C3b0E7d4": "OmegaNode-11",
  "0x2F5a9D3b7E0c4A8f1B6e3D0a7F4c1B8e5A2d9F6": "VaultStake-12",
  "0x7A1d4F8b2E6c9A3f0B7e4D1a8C5f2B9e6A3d0F7": "PeakValidator-13",
  "0x4C8e1F5a9D3b6E0c7A4f1B8e5C2d9F6a3B0e7D4": "ZbxSentinel-14",
  "0xB0e7D4c1F8a5E2b9C6f3A0d7B4e1F8c5A2b9E6d3": "IronCore-15",
  "0x9F6a3D0f7B4e1C8a5E2b9F6c3A0d7B4e1F8c5A2": "CrystalNode-16",
  "0x5E2b9F6a3D0c7F4b1E8a5C2d9F6a3B0e7D4c1F8": "NebulaMint-17",
  "0xD7b4E1f8C5a2B9e6C3f0A7d4B1e8F5c2A9b6E3d0": "TitanStake-18",
  "0x8C5a2D9f6A3b0E7d4C1f8B5a2E9f6C3a0D7b4E1": "PhoenixNode-19",
  "0x3A0d7B4e1F8c5A2b9E6c3F0a7D4b1E8f5C2a9B6": "CosmosGuard-20",
  "0xF5c2A9b6E3d0F7b4C1e8A5d2B9f6C3a0D7b4E1f8": "ZbxUltra-21",
};

export function deterministicHash(input: string): string {
  return "0x" + createHash("sha256").update(input).digest("hex");
}

export function hashFromHeight(height: number, salt: string | number = 0): string {
  return deterministicHash(`zbx:block:${height}:${salt}:chain8989`);
}

export function hashFromHeightForNetwork(height: number, cfg: NetworkConfig, salt: string | number = 0): string {
  return deterministicHash(`zbx:block:${height}:${salt}:chain${cfg.chainId}`);
}

export function getCurrentHeight(): number {
  return getCurrentHeightForNetwork(MAINNET_CONFIG);
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

export function blockData(height: number) {
  return blockDataForNetwork(height, MAINNET_CONFIG);
}

export function blockDataForNetwork(height: number, cfg: NetworkConfig) {
  const validators   = cfg.name === "testnet" ? TESTNET_VALIDATORS : VALIDATORS;
  const validatorIdx = height % validators.length;
  const validator    = validators[validatorIdx];
  const txCount      = Math.max(0, Math.floor(5 + Math.sin(height / 3) * 4 + (height % 7)));
  const gasUsed      = txCount * 21000 + Math.floor(height % 500) * 1000;
  const gasLimit     = cfg.gasLimit;
  const size         = 1200 + txCount * 250 + (height % 300);
  const currentH     = getCurrentHeightForNetwork(cfg);
  const secondsAgo   = (currentH - height) * cfg.blockTimeSeconds;
  const timestamp    = new Date(Date.now() - secondsAgo * 1000).toISOString();
  const reward       = height < cfg.halvingInterval ? cfg.blockReward.toString()
                     : (cfg.blockReward / 2).toString();

  return {
    height,
    hash:       hashFromHeightForNetwork(height, cfg),
    parentHash: hashFromHeightForNetwork(height - 1, cfg),
    timestamp,
    txCount,
    validator,
    gasUsed,
    gasLimit,
    size,
    reward,
    stateRoot: hashFromHeightForNetwork(height, cfg, "state"),
    txHash:    hashFromHeightForNetwork(height, cfg, "txroot"),
  };
}

router.get("/blocks", async (req, res): Promise<void> => {
  const cfg   = parseNetwork(req);
  const query = ListBlocksQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const page         = query.data.page  ?? 1;
  const limit        = Math.min(query.data.limit ?? 20, 50);
  const latestHeight = getCurrentHeightForNetwork(cfg);
  const startHeight  = latestHeight - (page - 1) * limit;

  const blocks = [];
  for (let i = 0; i < limit; i++) {
    const h = startHeight - i;
    if (h < 1) break;
    const b = blockDataForNetwork(h, cfg);
    blocks.push({
      height:    b.height,
      hash:      b.hash,
      timestamp: b.timestamp,
      txCount:   b.txCount,
      validator: b.validator,
      gasUsed:   b.gasUsed,
      gasLimit:  b.gasLimit,
      size:      b.size,
      reward:    b.reward,
    });
  }

  res.json(ListBlocksResponse.parse({ blocks, total: latestHeight, page, limit }));
});

router.get("/blocks/:height", async (req, res): Promise<void> => {
  const cfg    = parseNetwork(req);
  const raw    = Array.isArray(req.params.height) ? req.params.height[0] : req.params.height;
  const params = GetBlockParams.safeParse({ height: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const height       = params.data.height;
  const latestHeight = getCurrentHeightForNetwork(cfg);
  if (height < 1 || height > latestHeight) {
    res.status(404).json({ error: "Block not found" });
    return;
  }

  const b        = blockDataForNetwork(height, cfg);
  const validators = cfg.name === "testnet" ? TESTNET_VALIDATORS : VALIDATORS;
  const txs = [];
  for (let i = 0; i < b.txCount; i++) {
    const txHash  = deterministicHash(`zbx:tx:${height}:${i}:chain${cfg.chainId}`);
    const types   = ["transfer", "stake", "delegate", "contract", "reward"] as const;
    const type    = types[i % types.length];
    const amtSeed = height * 31 + i * 7;
    txs.push({
      hash:        txHash,
      blockHeight: height,
      timestamp:   b.timestamp,
      from:        validators[i % validators.length],
      to:          validators[(i + 2) % validators.length],
      amount:      ((amtSeed % 10000) * 0.0047 + 0.001).toFixed(6),
      fee:         "0.001",
      status:      "success" as const,
      type,
    });
  }

  res.json(GetBlockResponse.parse({ ...b, transactions: txs }));
});

export default router;
