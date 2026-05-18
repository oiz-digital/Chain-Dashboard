import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { testnetFaucetRequestsTable, accountsTable } from "@workspace/db";
import { eq, desc, count, sql } from "drizzle-orm";
import { deterministicHash } from "./blocks";
import {
  TESTNET_CONFIG,
  TESTNET_VALIDATORS,
  TESTNET_MONIKERS,
  getCurrentHeightForNetwork,
  calcMinedSupply,
  TESTNET_FOUNDATION_PREMINE,
  TESTNET_AMM_POOL_SEED,
} from "./network-config";
import { getOrCreateTestnetAccount } from "./wallet";

const router: IRouter = Router();

router.get("/testnet/info", async (_req, res): Promise<void> => {
  const cfg         = TESTNET_CONFIG;
  const height      = getCurrentHeightForNetwork(cfg);
  const mined       = calcMinedSupply(height, cfg);
  const circulating = TESTNET_FOUNDATION_PREMINE + TESTNET_AMM_POOL_SEED + Math.floor(mined * 0.62);
  const nowSec      = Math.floor(Date.now() / 1000);
  const zbxPrice    = cfg.basePriceUsd + Math.sin(nowSec / 180) * 0.00005;
  const tps         = parseFloat((1.2 + Math.sin(nowSec / 30) * 0.3).toFixed(2));

  res.json({
    network:           "testnet",
    chainId:           cfg.chainId,
    networkId:         cfg.networkId,
    displayName:       cfg.displayName,
    latestHeight:      height,
    blockTimeSeconds:  cfg.blockTimeSeconds,
    totalSupplyCap:    cfg.totalSupplyCap,
    circulatingSupply: circulating,
    minedSupply:       Math.floor(mined),
    validatorCount:    cfg.validatorCount,
    activeValidators:  cfg.validatorCount - 2,
    tps,
    faucetEnabled:     cfg.faucetEnabled,
    faucetAmount:      cfg.faucetAmount,
    faucetCooldownHrs: cfg.faucetCooldownHrs,
    unbondingDays:     cfg.unbondingDays,
    minValidatorStake: cfg.minValidatorStake,
    minDelegatorStake: cfg.minDelegatorStake,
    zbxPriceUsd:       parseFloat(zbxPrice.toFixed(6)),
    rpcEndpoint:       cfg.rpcEndpoint,
    wsEndpoint:        cfg.wsEndpoint,
    explorerUrl:       cfg.explorerUrl,
    genesisDate:       cfg.genesisDate.toISOString(),
    validators:        TESTNET_VALIDATORS.map((addr, i) => ({
      address: addr,
      moniker:  TESTNET_MONIKERS[addr] ?? `ZBX-TestNode-${i + 1}`,
      status:   i >= 9 ? "inactive" : "active",
    })),
  });
});

router.post("/testnet/faucet", async (req, res): Promise<void> => {
  const { address } = req.body ?? {};

  if (!address || typeof address !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    res.status(400).json({ error: "Valid Ethereum-style address (0x...) required" });
    return;
  }

  const lowerAddr   = address.toLowerCase();
  const cooldownMs  = TESTNET_CONFIG.faucetCooldownHrs * 3600 * 1000;

  const [lastRequest] = await db
    .select()
    .from(testnetFaucetRequestsTable)
    .where(eq(testnetFaucetRequestsTable.address, lowerAddr))
    .orderBy(desc(testnetFaucetRequestsTable.createdAt))
    .limit(1);

  if (lastRequest) {
    const lastTime   = lastRequest.createdAt instanceof Date ? lastRequest.createdAt : new Date(lastRequest.createdAt!);
    const nextAllowed = new Date(lastTime.getTime() + cooldownMs);
    if (nextAllowed > new Date()) {
      const waitHrs = Math.ceil((nextAllowed.getTime() - Date.now()) / 3600000);
      res.status(429).json({
        error:       `Faucet cooldown: ${waitHrs}h remaining`,
        nextAllowed: nextAllowed.toISOString(),
        cooldownHrs: TESTNET_CONFIG.faucetCooldownHrs,
      });
      return;
    }
  }

  const amount  = TESTNET_CONFIG.faucetAmount;
  const txHash  = deterministicHash(`zbx:testnet:faucet:${lowerAddr}:${Date.now()}`);
  const height  = getCurrentHeightForNetwork(TESTNET_CONFIG);
  const ipAddr  = (req.headers["x-forwarded-for"] as string) ?? req.ip ?? "unknown";

  await db.insert(testnetFaucetRequestsTable).values({
    address:   lowerAddr,
    amount:    amount.toString(),
    txHash,
    ipAddress: ipAddr,
  });

  const account   = await getOrCreateTestnetAccount(lowerAddr);
  const newBalance = (parseFloat(account.balance) + amount).toFixed(6);

  await db.update(accountsTable).set({
    balance:       newBalance,
    totalReceived: sql`(COALESCE(${accountsTable.totalReceived},'0')::numeric + ${amount})::text`,
    txCount:       sql`${accountsTable.txCount} + 1`,
    lastSeen:      new Date(),
  }).where(eq(accountsTable.address, `t:${lowerAddr}`));

  res.status(201).json({
    success:     true,
    txHash,
    address,
    amount,
    blockHeight: height,
    newBalance,
    network:     "testnet",
    message:     `${amount} ZBX sent to ${address} on testnet`,
    nextAllowed: new Date(Date.now() + cooldownMs).toISOString(),
  });
});

router.get("/testnet/faucet/history", async (req, res): Promise<void> => {
  const page   = Math.max(1, Number(req.query.page)  || 1);
  const limit  = Math.min(50, Number(req.query.limit) || 20);
  const offset = (page - 1) * limit;

  const [requests, [{ total }]] = await Promise.all([
    db.select().from(testnetFaucetRequestsTable)
      .orderBy(desc(testnetFaucetRequestsTable.createdAt))
      .limit(limit).offset(offset),
    db.select({ total: count() }).from(testnetFaucetRequestsTable),
  ]);

  res.json({
    requests: requests.map(r => ({
      id:        r.id,
      address:   r.address,
      amount:    r.amount,
      txHash:    r.txHash,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    })),
    total: Number(total),
    page,
    limit,
  });
});

router.get("/testnet/reset-info", async (_req, res): Promise<void> => {
  res.json({
    genesisDate:   TESTNET_CONFIG.genesisDate.toISOString(),
    chainId:       TESTNET_CONFIG.chainId,
    networkId:     TESTNET_CONFIG.networkId,
    baseHeight:    TESTNET_CONFIG.baseHeight,
    genesisHash:   deterministicHash("zbx:testnet:genesis:8990:2026-01-01"),
    initialSupply: TESTNET_FOUNDATION_PREMINE + TESTNET_AMM_POOL_SEED,
    faucetAddress: "0x0000000000000000000000000000000000000001",
    note:          "Testnet resets are announced 48h in advance on Discord.",
  });
});

export default router;
