import { Router, type IRouter } from "express";
import {
  GetValidatorParams,
  ListValidatorsResponse,
  GetValidatorResponse,
} from "@workspace/api-zod";
import {
  parseNetwork,
  getCurrentHeightForNetwork,
  TESTNET_VALIDATORS,
  TESTNET_MONIKERS,
} from "./network-config";
import { getCurrentHeight } from "./blocks";

const router: IRouter = Router();

const MAINNET_VALIDATOR_DATA = [
  { address:"0x3a8F4b291cE7D3A9Fc2b8E14D6a905B7c3f1e2d", moniker:"ZebvixNode-1",     commission:5.0,  website:"https://zebvix.io",           description:"Official Zebvix Technologies validator node. High availability, enterprise grade infrastructure." },
  { address:"0x7c2E9d1F8B4A3C6e5D0b9F2a7e4C8d1B3f6A9c2", moniker:"AlphaValidator",  commission:7.5,  website:"https://alphavalidator.io",    description:"Professional validator operator with 99.9% SLA guarantee." },
  { address:"0xB5d4E7f2A9C3b8F1e6D0a5C2b9E4f7A3d8B1e6F", moniker:"NovaMint",         commission:6.0,  website:"https://novamint.finance",     description:"DeFi-native validator bringing institutional security to ZBX." },
  { address:"0xD1F6a3B8e5C2d9F4b7E0a3C8d5F2b9E6a1D4c7B", moniker:"BlockFusion",      commission:8.0,  website:"https://blockfusion.tech",     description:"Decentralized infrastructure for the Zebvix ecosystem." },
  { address:"0x9E2b7D4f1A6c3B8e5F0d7A2b9E4c1F6d3B8a5E2", moniker:"ZenithStake",      commission:4.5,  website:"https://zenithstake.com",      description:"Low commission, maximum returns. Trusted by 1,200+ delegators." },
  { address:"0xA4c7F9e2B5D8a1C6f3E0b7D4a9C2e5F8b1A6d3C", moniker:"CryptoForge-6",    commission:10.0, website:"https://cryptoforge.io",       description:"Battle-tested validator with multi-datacenter redundancy." },
  { address:"0xF2a8D5b3E6c1A9f4B7e0C3d8F5a2B9e6C1d4A7f", moniker:"NexusNode-7",      commission:5.5,  website:"https://nexusvalidator.net",   description:"Bridging the gap between DeFi and traditional finance on ZBX." },
  { address:"0x6B9c3E0f7A4d1B8e5C2a9F6b3D0e7C4a1B8f5E2", moniker:"StellarChain-8",   commission:6.5,  website:"https://stakeharbor.com",      description:"Safe harbor for your ZBX delegation." },
  { address:"0xC8e5F2a9D6b3E0c7A4f1B8e5C2d9F6a3B0e7D4c", moniker:"QuantumValidator", commission:9.0,  website:"https://primenode.xyz",        description:"Premium validator infrastructure with real-time monitoring." },
  { address:"0x1D4f8B2e6A9c3F0b7E4d1A8c5F2b9E6a3D0f7B4", moniker:"DeepStake-10",     commission:7.0,  website:"",                            description:"Community-run validator supporting ZBX decentralization.", status:"inactive" as const },
  { address:"0xE3b0C4f8A9d6B3e0F7a4C1b8E5d2A9f6C3b0E7d4", moniker:"OmegaNode-11",     commission:12.0, website:"https://vaultstake.io",        description:"Institutional-grade staking with hardware security modules." },
  { address:"0x2F5a9D3b7E0c4A8f1B6e3D0a7F4c1B8e5A2d9F6", moniker:"VaultStake-12",    commission:6.0,  website:"https://omeganode.io",         description:"High-performance validator built for the long haul." },
  { address:"0x7A1d4F8b2E6c9A3f0B7e4D1a8C5f2B9e6A3d0F7", moniker:"PeakValidator-13", commission:8.5,  website:"https://terrastake.finance",   description:"Earth-friendly validator running on renewable energy." },
  { address:"0x4C8e1F5a9D3b6E0c7A4f1B8e5C2d9F6a3B0e7D4", moniker:"ZbxSentinel-14",   commission:7.5,  website:"https://apexnode.io",          description:"Reaching the apex of blockchain reliability." },
  { address:"0xB0e7D4c1F8a5E2b9C6f3A0d7B4e1F8c5A2b9E6d3", moniker:"IronCore-15",      commission:5.0,  website:"https://skyvalidator.com",     description:"Limitless uptime, unlimited potential." },
  { address:"0x9F6a3D0f7B4e1C8a5E2b9F6c3A0d7B4e1F8c5A2", moniker:"CrystalNode-16",   commission:9.5,  website:"https://quantumstake.io",      description:"Next-generation staking infrastructure with AI monitoring.", status:"jailed" as const },
  { address:"0x5E2b9F6a3D0c7F4b1E8a5C2d9F6a3B0e7D4c1F8", moniker:"NebulaMint-17",    commission:6.0,  website:"https://ironnode.tech",        description:"Rock-solid infrastructure for the ZBX community." },
  { address:"0xD7b4E1f8C5a2B9e6C3f0A7d4B1e8F5c2A9b6E3d0", moniker:"TitanStake-18",   commission:7.0,  website:"https://moonvalidator.space",  description:"Shooting for the moon, one block at a time." },
  { address:"0x8C5a2D9f6A3b0E7d4C1f8B5a2E9f6C3a0D7b4E1", moniker:"PhoenixNode-19",   commission:5.5,  website:"https://polarnode.io",         description:"Cold storage security meets hot validation." },
  { address:"0x3A0d7B4e1F8c5A2b9E6c3F0a7D4b1E8f5C2a9B6", moniker:"CosmosGuard-20",   commission:8.0,  website:"https://dawnvalidator.com",    description:"New dawn for decentralized validation." },
  { address:"0xF5c2A9b6E3d0F7b4C1e8A5d2B9f6C3a0D7b4E1f8", moniker:"ZbxUltra-21",      commission:4.0,  website:"https://zenvalidator.io",      description:"Minimal commission, maximal reliability." },
];

const TESTNET_VALIDATOR_DATA = TESTNET_VALIDATORS.map((address, i) => ({
  address,
  moniker:     TESTNET_MONIKERS[address] ?? `ZBX-TestNode-${i + 1}`,
  commission:  3.0 + (i % 3) * 1.5,
  website:     `https://testnet.zbxchain.io/validators/${i + 1}`,
  description: `Testnet validator node ${i + 1}. Available for testing delegations and governance.`,
  status:      i >= 9 ? ("inactive" as const) : undefined,
}));

function buildValidator(
  v: typeof MAINNET_VALIDATOR_DATA[0],
  idx: number,
  height: number,
  isTestnet = false
) {
  const totalBase   = isTestnet ? 50_000 : 150_000;
  const totalStaked = Math.floor(totalBase - idx * (isTestnet ? 3_000 : 5_000) + Math.sin(idx) * (isTestnet ? 3_000 : 10_000));
  const selfStaked  = Math.floor(totalStaked * 0.15);
  const valCount    = isTestnet ? TESTNET_VALIDATOR_DATA.length : MAINNET_VALIDATOR_DATA.length;
  const blocksProposed = Math.floor(height / valCount) + idx * 12;
  const uptime      = idx < (isTestnet ? 7 : 15) ? 99.8 - idx * 0.05 : 98.1 - (idx - (isTestnet ? 7 : 15)) * 0.3;
  const status      = (v as any).status ?? ("active" as const);

  return {
    address:       v.address,
    moniker:       v.moniker,
    status,
    votingPower:   totalStaked.toString(),
    commission:    v.commission,
    totalStaked:   totalStaked.toString(),
    selfStaked:    selfStaked.toString(),
    delegatedStaked:(totalStaked - selfStaked).toString(),
    delegators:    Math.floor((isTestnet ? 30 : 300) - idx * (isTestnet ? 2 : 10) + Math.abs(Math.sin(idx * 7)) * (isTestnet ? 50 : 200)),
    uptime:        parseFloat(uptime.toFixed(2)),
    blocksProposed,
    blocksSkipped: Math.floor(blocksProposed * (1 - uptime / 100)),
    rank:          idx + 1,
    website:       v.website,
    description:   v.description,
    joinedAt:      new Date(Date.now() - (idx + 1) * (isTestnet ? 7 : 30) * 24 * 3600 * 1000).toISOString(),
    recentBlocks:  Array.from({ length: 10 }, (_, i) => height - idx - i * valCount),
  };
}

router.get("/validators", async (req, res): Promise<void> => {
  const cfg       = parseNetwork(req);
  const height    = getCurrentHeightForNetwork(cfg);
  const isTestnet = cfg.name === "testnet";
  const dataset   = isTestnet ? TESTNET_VALIDATOR_DATA : MAINNET_VALIDATOR_DATA;

  const validators = dataset.map((v, idx) => {
    const full = buildValidator(v, idx, height, isTestnet);
    return {
      address:        full.address,
      moniker:        full.moniker,
      status:         full.status,
      votingPower:    full.votingPower,
      commission:     full.commission,
      totalStaked:    full.totalStaked,
      delegators:     full.delegators,
      uptime:         full.uptime,
      blocksProposed: full.blocksProposed,
      rank:           full.rank,
    };
  });

  res.json(ListValidatorsResponse.parse(validators));
});

router.get("/validators/:address", async (req, res): Promise<void> => {
  const cfg    = parseNetwork(req);
  const raw    = Array.isArray(req.params.address) ? req.params.address[0] : req.params.address;
  const params = GetValidatorParams.safeParse({ address: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const address   = params.data.address.toLowerCase();
  const isTestnet = cfg.name === "testnet";
  const dataset   = isTestnet ? TESTNET_VALIDATOR_DATA : MAINNET_VALIDATOR_DATA;
  const idx       = dataset.findIndex(v => v.address.toLowerCase() === address);

  if (idx === -1) {
    res.status(404).json({ error: "Validator not found" });
    return;
  }

  const height = getCurrentHeightForNetwork(cfg);
  const full   = buildValidator(dataset[idx], idx, height, isTestnet);
  res.json(GetValidatorResponse.parse(full));
});

export default router;
