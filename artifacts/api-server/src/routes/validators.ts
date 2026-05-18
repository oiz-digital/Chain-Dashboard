import { Router, type IRouter } from "express";
import {
  GetValidatorParams,
  ListValidatorsResponse,
  GetValidatorResponse,
} from "@workspace/api-zod";
import { getCurrentHeight } from "./blocks";

const router: IRouter = Router();

const VALIDATOR_DATA = [
  {
    address: "0x3a8F4b291cE7D3A9Fc2b8E14D6a905B7c3f1e2d",
    moniker: "ZebvixNode-1",
    commission: 5.0,
    website: "https://zebvix.io",
    description: "Official Zebvix Technologies validator node. High availability, enterprise grade infrastructure.",
  },
  {
    address: "0x7c2E9d1F8B4A3C6e5D0b9F2a7e4C8d1B3f6A9c2",
    moniker: "AlphaValidator",
    commission: 7.5,
    website: "https://alphavalidator.io",
    description: "Professional validator operator with 99.9% SLA guarantee.",
  },
  {
    address: "0xB5d4E7f2A9C3b8F1e6D0a5C2b9E4f7A3d8B1e6F",
    moniker: "NovaMint",
    commission: 6.0,
    website: "https://novamint.finance",
    description: "DeFi-native validator bringing institutional security to ZBX.",
  },
  {
    address: "0xD1F6a3B8e5C2d9F4b7E0a3C8d5F2b9E6a1D4c7B",
    moniker: "BlockFusion",
    commission: 8.0,
    website: "https://blockfusion.tech",
    description: "Decentralized infrastructure for the Zebvix ecosystem.",
  },
  {
    address: "0x9E2b7D4f1A6c3B8e5F0d7A2b9E4c1F6d3B8a5E2",
    moniker: "ZenithStake",
    commission: 4.5,
    website: "https://zenithstake.com",
    description: "Low commission, maximum returns. Trusted by 1,200+ delegators.",
  },
  {
    address: "0x4F8c1A3e7B2d9F5a6C0b3E8d1F4a7C2b9E6d3A8F",
    moniker: "CryptoForge",
    commission: 10.0,
    website: "https://cryptoforge.io",
    description: "Battle-tested validator with multi-datacenter redundancy.",
  },
  {
    address: "0x2A5d8F1b4E7c3A9f6B0d5E2a8F4c1B7e3A6d9C2",
    moniker: "StakeHarbor",
    commission: 6.5,
    website: "https://stakeharbor.com",
    description: "Safe harbor for your ZBX delegation.",
  },
  {
    address: "0x8C3f6E1a5D2b9F4c7A0e3B6d1F5a8C4e7B2d5F9",
    moniker: "PrimeNode",
    commission: 9.0,
    website: "https://primenode.xyz",
    description: "Premium validator infrastructure with real-time monitoring.",
  },
  {
    address: "0x6D1b4F9a2E5c8A3f7B0d4E7a1C6d3F9b2E5a8C4",
    moniker: "EpochSync",
    commission: 7.0,
    website: "",
    description: "Community-run validator supporting ZBX decentralization.",
    status: "inactive" as const,
  },
  {
    address: "0xA4e7C2f9B1d5E8a3F6c0B4d7E1a5C9f2B8d4E7A",
    moniker: "VaultStake",
    commission: 12.0,
    website: "https://vaultstake.io",
    description: "Institutional-grade staking with hardware security modules.",
  },
  {
    address: "0x5B8f2D4e9C1a7F3b6E0d5A8f2C4d7B1e9F3a6D8",
    moniker: "NexusValidator",
    commission: 5.5,
    website: "https://nexusvalidator.net",
    description: "Bridging the gap between DeFi and traditional finance on ZBX.",
  },
  {
    address: "0x1E7c4B9f3A8d5E2a6F0c4D7b1E9a3F6d5A8c2B7",
    moniker: "OmegaNode",
    commission: 6.0,
    website: "https://omeganode.io",
    description: "High-performance validator built for the long haul.",
  },
  {
    address: "0xC9f2A6e1D4b8F5c3E7a0D3f6B9e2A5d8C1f4B7E",
    moniker: "TerraStake",
    commission: 8.5,
    website: "https://terrastake.finance",
    description: "Earth-friendly validator running on renewable energy.",
  },
  {
    address: "0x7B3e9F1d5C8a4E2f6A0b7D4e1F9c3B8a5E2d7F0",
    moniker: "ApexNode",
    commission: 7.5,
    website: "https://apexnode.io",
    description: "Reaching the apex of blockchain reliability.",
  },
  {
    address: "0x3F6d1A8e4C2b9F5a7E0d3B6a1C9d4F2b8E5a7D3",
    moniker: "SkyValidator",
    commission: 5.0,
    website: "https://skyvalidator.com",
    description: "Limitless uptime, unlimited potential.",
  },
  {
    address: "0xE2a5D9c3F7b4A1e8C6d0F3a7B2e5D9f1c4A8b6E",
    moniker: "QuantumStake",
    commission: 9.5,
    website: "https://quantumstake.io",
    description: "Next-generation staking infrastructure with AI monitoring.",
    status: "jailed" as const,
  },
  {
    address: "0x0D4c8F2b6A1e9C5f3B7d0E4a8F2c6B1d9E5a3C7",
    moniker: "IronNode",
    commission: 6.0,
    website: "https://ironnode.tech",
    description: "Rock-solid infrastructure for the ZBX community.",
  },
  {
    address: "0x8A1f5E3d7C2b9F4a6D0e8B5f1A9c3E7d4F2a6B8",
    moniker: "MoonValidator",
    commission: 7.0,
    website: "https://moonvalidator.space",
    description: "Shooting for the moon, one block at a time.",
  },
  {
    address: "0x4C7b3E9f1A5d8B2e6F0c4A7d2E9b5F1c8A4e7D2",
    moniker: "PolarNode",
    commission: 5.5,
    website: "https://polarnode.io",
    description: "Cold storage security meets hot validation.",
  },
  {
    address: "0x9F2e6A4d1C8b5E3f7A0d9B2f6E1c4A8d5B3e7F1",
    moniker: "DawnValidator",
    commission: 8.0,
    website: "https://dawnvalidator.com",
    description: "New dawn for decentralized validation.",
  },
  {
    address: "0x6A4d8E2b5F9c1A7e3D0b6F2d9E5a1C4b8E3d7A6",
    moniker: "ZenValidator",
    commission: 4.0,
    website: "https://zenvalidator.io",
    description: "Minimal commission, maximal reliability.",
  },
];

function buildValidator(v: typeof VALIDATOR_DATA[0], idx: number, height: number) {
  const totalStaked = Math.floor(150_000 - idx * 5_000 + Math.sin(idx) * 10_000);
  const selfStaked = Math.floor(totalStaked * 0.15);
  const delegatedStaked = totalStaked - selfStaked;
  const blocksProposed = Math.floor(height / VALIDATOR_DATA.length) + idx * 12;
  const uptime = idx < 15 ? 99.8 - idx * 0.05 : 98.1 - (idx - 15) * 0.3;
  const votingPower = totalStaked.toString();
  const status = (v as any).status ?? ("active" as const);

  return {
    address: v.address,
    moniker: v.moniker,
    status,
    votingPower,
    commission: v.commission,
    totalStaked: totalStaked.toString(),
    selfStaked: selfStaked.toString(),
    delegatedStaked: delegatedStaked.toString(),
    delegators: Math.floor(300 - idx * 10 + Math.abs(Math.sin(idx * 7)) * 200),
    uptime: parseFloat(uptime.toFixed(2)),
    blocksProposed,
    blocksSkipped: Math.floor(blocksProposed * (1 - uptime / 100)),
    rank: idx + 1,
    website: v.website,
    description: v.description,
    joinedAt: new Date(Date.now() - (idx + 1) * 30 * 24 * 3600 * 1000).toISOString(),
    recentBlocks: Array.from({ length: 10 }, (_, i) => height - idx - i * VALIDATOR_DATA.length),
  };
}

router.get("/validators", async (_req, res): Promise<void> => {
  const height = getCurrentHeight();
  const validators = VALIDATOR_DATA.map((v, idx) => {
    const full = buildValidator(v, idx, height);
    return {
      address: full.address,
      moniker: full.moniker,
      status: full.status,
      votingPower: full.votingPower,
      commission: full.commission,
      totalStaked: full.totalStaked,
      delegators: full.delegators,
      uptime: full.uptime,
      blocksProposed: full.blocksProposed,
      rank: full.rank,
    };
  });

  res.json(ListValidatorsResponse.parse(validators));
});

router.get("/validators/:address", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.address) ? req.params.address[0] : req.params.address;
  const params = GetValidatorParams.safeParse({ address: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const address = params.data.address.toLowerCase();
  const idx = VALIDATOR_DATA.findIndex((v) => v.address.toLowerCase() === address);
  if (idx === -1) {
    res.status(404).json({ error: "Validator not found" });
    return;
  }

  const height = getCurrentHeight();
  const full = buildValidator(VALIDATOR_DATA[idx], idx, height);
  res.json(GetValidatorResponse.parse(full));
});

export default router;
