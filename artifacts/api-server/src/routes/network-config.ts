import type { Request } from "express";

export type NetworkName = "mainnet" | "testnet";

export interface NetworkConfig {
  name:               NetworkName;
  displayName:        string;
  chainId:            number;
  networkId:          string;
  baseHeight:         number;
  genesisDate:        Date;
  blockTimeSeconds:   number;
  totalSupplyCap:     number;
  blockReward:        number;
  halvingInterval:    number;
  validatorCount:     number;
  minValidatorStake:  number;
  minDelegatorStake:  number;
  unbondingDays:      number;
  basePriceUsd:       number;
  rpcEndpoint:        string;
  wsEndpoint:         string;
  explorerUrl:        string;
  faucetEnabled:      boolean;
  faucetAmount:       number;
  faucetCooldownHrs:  number;
  maxBlockSize:       number;
  maxTxsPerBlock:     number;
  gasLimit:           number;
}

export const MAINNET_CONFIG: NetworkConfig = {
  name:               "mainnet",
  displayName:        "Mainnet",
  chainId:            8989,
  networkId:          "zbx-mainnet-1",
  baseHeight:         2_847_312,
  genesisDate:        new Date("2025-01-01T00:00:00Z"),
  blockTimeSeconds:   5,
  totalSupplyCap:     150_000_000,
  blockReward:        3,
  halvingInterval:    25_000_000,
  validatorCount:     21,
  minValidatorStake:  100,
  minDelegatorStake:  10,
  unbondingDays:      21,
  basePriceUsd:       0.0847,
  rpcEndpoint:        "https://rpc.zbxchain.io",
  wsEndpoint:         "wss://ws.zbxchain.io",
  explorerUrl:        "https://explorer.zbxchain.io",
  faucetEnabled:      false,
  faucetAmount:       0,
  faucetCooldownHrs:  0,
  maxBlockSize:       1_048_576,
  maxTxsPerBlock:     500,
  gasLimit:           30_000_000,
};

export const TESTNET_CONFIG: NetworkConfig = {
  name:               "testnet",
  displayName:        "Testnet",
  chainId:            8990,
  networkId:          "zbx-testnet-1",
  baseHeight:         487_234,
  genesisDate:        new Date("2026-01-01T00:00:00Z"),
  blockTimeSeconds:   5,
  totalSupplyCap:     50_000_000,
  blockReward:        5,
  halvingInterval:    10_000_000,
  validatorCount:     11,
  minValidatorStake:  50,
  minDelegatorStake:  1,
  unbondingDays:      7,
  basePriceUsd:       0.001,
  rpcEndpoint:        "https://rpc-testnet.zbxchain.io",
  wsEndpoint:         "wss://ws-testnet.zbxchain.io",
  explorerUrl:        "https://testnet-explorer.zbxchain.io",
  faucetEnabled:      true,
  faucetAmount:       1_000,
  faucetCooldownHrs:  24,
  maxBlockSize:       1_048_576,
  maxTxsPerBlock:     200,
  gasLimit:           30_000_000,
};

export const TESTNET_VALIDATORS: string[] = [
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
  "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
  "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
  "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
  "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f",
  "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720",
  "0xBcd4042DE499D14e55001CcbB24a551F3b954096",
];

export const TESTNET_MONIKERS: Record<string, string> = {
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266": "ZBX-TestNode-1",
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8": "ZBX-TestNode-2",
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC": "ZBX-TestNode-3",
  "0x90F79bf6EB2c4f870365E785982E1f101E93b906": "ZBX-TestNode-4",
  "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65": "ZBX-TestNode-5",
  "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc": "ZBX-TestNode-6",
  "0x976EA74026E726554dB657fA54763abd0C3a0aa9": "ZBX-TestNode-7",
  "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955": "ZBX-TestNode-8",
  "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f": "ZBX-TestNode-9",
  "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720": "ZBX-TestNode-10",
  "0xBcd4042DE499D14e55001CcbB24a551F3b954096": "ZBX-TestNode-11",
};

export const TESTNET_FOUNDATION_PREMINE = 1_990_000;
export const TESTNET_AMM_POOL_SEED      = 3_000_000;

export function getNetworkConfig(network?: string): NetworkConfig {
  return network === "testnet" ? TESTNET_CONFIG : MAINNET_CONFIG;
}

export function parseNetwork(req: Request): NetworkConfig {
  const n = (req.query.network as string | undefined)
         ?? (req.body?.network as string | undefined)
         ?? "mainnet";
  return getNetworkConfig(n);
}

export function calcMinedSupply(height: number, cfg: NetworkConfig): number {
  let mined = 0;
  let reward = cfg.blockReward;
  let remaining = height;
  let halvingCount = 0;
  while (remaining > 0 && halvingCount < 10) {
    const blocksInEra = Math.min(remaining, cfg.halvingInterval);
    mined += blocksInEra * reward;
    remaining -= blocksInEra;
    reward /= 2;
    halvingCount++;
  }
  const maxMined = cfg.totalSupplyCap - (
    cfg.name === "testnet" ? TESTNET_FOUNDATION_PREMINE + TESTNET_AMM_POOL_SEED
                           : 9_990_000 + 20_000_000
  );
  return Math.min(mined, maxMined);
}

export function getCurrentHeightForNetwork(cfg: NetworkConfig): number {
  return cfg.baseHeight + Math.floor((Date.now() - cfg.genesisDate.getTime()) / (cfg.blockTimeSeconds * 1000));
}
