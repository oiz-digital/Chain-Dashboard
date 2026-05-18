import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { validatorsTable, stakingDelegationsTable, accountsTable } from "@workspace/db";
import { eq, count, sql } from "drizzle-orm";
import {
  GetStakingOverviewResponse,
  GetStakingValidatorsResponse,
} from "@workspace/api-zod";
import { deterministicHash, getCurrentHeight } from "./blocks";
import {
  parseNetwork,
  getCurrentHeightForNetwork,
  TESTNET_VALIDATORS,
  TESTNET_MONIKERS,
} from "./network-config";

const router: IRouter = Router();

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function getZbxPrice(basePriceUsd: number): number {
  const nowSec = Math.floor(Date.now() / 1000);
  const noise  = basePriceUsd * 0.035;
  return parseFloat((basePriceUsd + Math.sin(nowSec / 180) * noise).toFixed(
    basePriceUsd < 0.01 ? 6 : 4
  ));
}

function buildTestnetValidator(address: string, idx: number, height: number) {
  const seed        = idx * 31 + 7777;
  const totalStaked = Math.floor(50_000 - idx * 3_000 + seededRandom(seed) * 10_000);
  const commission  = parseFloat((3.0 + (idx % 3) * 1.5).toFixed(1));
  const uptime      = idx < 7 ? 99.5 - idx * 0.1 : 97.0 - (idx - 7) * 0.5;
  const totalStakedAll = 550_000;
  const apr         = Math.max(0, (5_000_000 / Math.max(totalStakedAll, 1)) * 100 * (1 - commission / 100));
  return {
    id:          idx + 100,
    address,
    moniker:     TESTNET_MONIKERS[address] ?? `ZBX-TestNode-${idx + 1}`,
    status:      idx >= 9 ? "inactive" : "active",
    commission:  commission.toString(),
    totalStaked: totalStaked.toString(),
    selfStaked:  Math.floor(totalStaked * 0.20).toString(),
    delegators:  Math.floor(20 - idx * 1.5 + seededRandom(seed + 1) * 15),
    uptime:      parseFloat(uptime.toFixed(2)),
    apr:         apr.toFixed(2),
    rank:        idx + 1,
    website:     `https://testnet.zbxchain.io/v/${idx + 1}`,
    description: `Testnet validator node ${idx + 1}.`,
  };
}

router.get("/staking/overview", async (req, res): Promise<void> => {
  const cfg = parseNetwork(req);

  if (cfg.name === "testnet") {
    const height        = getCurrentHeightForNetwork(cfg);
    const totalStaked   = 320_000;
    const zbxPrice      = getZbxPrice(cfg.basePriceUsd);
    const stakingApr    = ((5_000_000 / Math.max(totalStaked, 1)) * 100).toFixed(2);
    const inflationRate = "12.00";
    const activeCount   = TESTNET_VALIDATORS.length - 2;

    res.json(GetStakingOverviewResponse.parse({
      totalStaked:          totalStaked.toFixed(0),
      totalDelegators:      87,
      activeValidators:     activeCount,
      stakingApr,
      liquidStakingTvl:     (totalStaked * zbxPrice * 0.12).toFixed(2),
      rewardsDistributed24h:(totalStaked * zbxPrice * Number(stakingApr) / 100 / 365).toFixed(2),
      inflationRate,
      zbxPrice,
      unbondingPeriodDays:  cfg.unbondingDays,
      minStakeAmount:       cfg.minDelegatorStake.toString(),
    }));
    return;
  }

  const validators  = await db.select().from(validatorsTable);
  const active      = validators.filter(v => v.status === "active");
  const totalStaked = validators.reduce((s, v) => s + Number(v.totalStaked), 0);
  const totalDelegators = validators.reduce((s, v) => s + v.delegators, 0);
  const zbxPrice    = getZbxPrice(cfg.basePriceUsd);
  const stakingApr  = ((12_000_000 / Math.max(totalStaked, 1)) * 100).toFixed(2);

  res.json(GetStakingOverviewResponse.parse({
    totalStaked:          totalStaked.toFixed(0),
    totalDelegators,
    activeValidators:     active.length,
    stakingApr,
    liquidStakingTvl:     (totalStaked * zbxPrice * 0.18).toFixed(2),
    rewardsDistributed24h:(totalStaked * zbxPrice * Number(stakingApr) / 100 / 365).toFixed(2),
    inflationRate:        "7.80",
    zbxPrice,
    unbondingPeriodDays:  cfg.unbondingDays,
    minStakeAmount:       cfg.minDelegatorStake.toString(),
  }));
});

router.get("/staking/validators", async (req, res): Promise<void> => {
  const cfg    = parseNetwork(req);
  const page   = Math.max(1, Number(req.query.page)  || 1);
  const limit  = Math.min(50, Number(req.query.limit) || 20);
  const offset = (page - 1) * limit;

  if (cfg.name === "testnet") {
    const height   = getCurrentHeightForNetwork(cfg);
    const allNodes = TESTNET_VALIDATORS.map((addr, i) => buildTestnetValidator(addr, i, height));
    const active   = allNodes.filter(v => v.status === "active");
    const paged    = active.slice(offset, offset + limit);
    res.json(GetStakingValidatorsResponse.parse({ validators: paged, total: active.length }));
    return;
  }

  const [validators, [{ total }]] = await Promise.all([
    db.select().from(validatorsTable)
      .where(eq(validatorsTable.status, "active"))
      .orderBy(validatorsTable.rank)
      .limit(limit).offset(offset),
    db.select({ total: count() }).from(validatorsTable)
      .where(eq(validatorsTable.status, "active")),
  ]);

  const totalStakedAll = validators.reduce((s, v) => s + Number(v.totalStaked), 0);
  const mapped = validators.map(v => {
    const commission = Number(v.commission);
    const apr = Math.max(0, (12_000_000 / Math.max(totalStakedAll, 1)) * 100 * (1 - commission / 100));
    return {
      id:          v.id,
      address:     v.address,
      moniker:     v.moniker,
      status:      v.status,
      commission:  v.commission,
      totalStaked: v.totalStaked,
      selfStaked:  v.selfStaked,
      delegators:  v.delegators,
      uptime:      v.uptime,
      apr:         apr.toFixed(2),
      rank:        v.rank,
      website:     v.website,
      description: v.description,
    };
  });

  res.json(GetStakingValidatorsResponse.parse({ validators: mapped, total: Number(total) }));
});

router.post("/staking/delegate", async (req, res): Promise<void> => {
  const cfg = parseNetwork(req);
  const { delegatorAddress, validatorAddress, amount } = req.body ?? {};

  if (!delegatorAddress || !validatorAddress || !amount) {
    res.status(400).json({ error: "delegatorAddress, validatorAddress, amount are required" });
    return;
  }

  const amtNum = parseFloat(amount);
  if (isNaN(amtNum) || amtNum < cfg.minDelegatorStake) {
    res.status(400).json({ error: `Minimum delegation is ${cfg.minDelegatorStake} ZBX` });
    return;
  }

  const isTestnetValidator = cfg.name === "testnet"
    ? TESTNET_VALIDATORS.map(a => a.toLowerCase()).includes(validatorAddress.toLowerCase())
    : false;

  if (cfg.name === "mainnet") {
    const [dbValidator] = await db.select().from(validatorsTable)
      .where(eq(validatorsTable.address, validatorAddress)).limit(1);
    if (!dbValidator) {
      res.status(404).json({ error: "Validator not found" });
      return;
    }
    if (dbValidator.status !== "active") {
      res.status(400).json({ error: "Validator is not active" });
      return;
    }
  } else if (!isTestnetValidator) {
    res.status(404).json({ error: "Testnet validator not found" });
    return;
  }

  const { getOrCreateAccount } = await import("./wallet");
  const account = await getOrCreateAccount(delegatorAddress);
  if (parseFloat(account.balance) < amtNum) {
    res.status(400).json({ error: `Insufficient balance: ${parseFloat(account.balance).toFixed(6)} ZBX` });
    return;
  }

  const txHash = deterministicHash(
    `zbx:stake:delegate:${cfg.name}:${delegatorAddress}:${validatorAddress}:${amount}:${Date.now()}`
  );

  const [delegation] = await db.insert(stakingDelegationsTable).values({
    delegatorAddress,
    validatorAddress,
    amount:  amtNum.toFixed(6),
    status:  "active",
    txHash,
  }).returning();

  if (cfg.name === "mainnet") {
    await db.update(validatorsTable).set({
      totalStaked: sql`(${validatorsTable.totalStaked}::numeric + ${amtNum})::text`,
      delegators:  sql`${validatorsTable.delegators} + 1`,
    }).where(eq(validatorsTable.address, validatorAddress));
  }

  await db.update(accountsTable).set({
    balance:      sql`(${accountsTable.balance}::numeric - ${amtNum})::text`,
    stakedAmount: sql`(COALESCE(${accountsTable.stakedAmount},'0')::numeric + ${amtNum})::text`,
    lastSeen:     new Date(),
  }).where(eq(accountsTable.address, delegatorAddress));

  const height = getCurrentHeightForNetwork(cfg);
  res.status(201).json({
    delegationId:     delegation?.id,
    txHash,
    delegatorAddress,
    validatorAddress,
    amount:           amtNum.toFixed(6),
    status:           "active",
    blockHeight:      height,
    network:          cfg.name,
    message:          `Delegation successful on ${cfg.displayName}`,
  });
});

router.post("/staking/undelegate", async (req, res): Promise<void> => {
  const cfg = parseNetwork(req);
  const { delegatorAddress, validatorAddress, amount } = req.body ?? {};

  if (!delegatorAddress || !validatorAddress || !amount) {
    res.status(400).json({ error: "delegatorAddress, validatorAddress, amount are required" });
    return;
  }

  const amtNum = parseFloat(amount);
  if (isNaN(amtNum) || amtNum <= 0) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }

  const txHash      = deterministicHash(
    `zbx:stake:undelegate:${cfg.name}:${delegatorAddress}:${validatorAddress}:${amount}:${Date.now()}`
  );
  const unbondingAt = new Date(Date.now() + cfg.unbondingDays * 24 * 3600 * 1000);

  const [delegation] = await db.insert(stakingDelegationsTable).values({
    delegatorAddress,
    validatorAddress,
    amount:      amtNum.toFixed(6),
    status:      "unbonding",
    txHash,
    unbondingAt,
  }).returning();

  if (cfg.name === "mainnet") {
    await db.update(validatorsTable).set({
      totalStaked: sql`GREATEST(0, ${validatorsTable.totalStaked}::numeric - ${amtNum})::text`,
      delegators:  sql`GREATEST(0, ${validatorsTable.delegators} - 1)`,
    }).where(eq(validatorsTable.address, validatorAddress));
  }

  const [account] = await db.select().from(accountsTable)
    .where(eq(accountsTable.address, delegatorAddress)).limit(1);
  if (account) {
    await db.update(accountsTable).set({
      stakedAmount: sql`GREATEST(0, COALESCE(${accountsTable.stakedAmount},'0')::numeric - ${amtNum})::text`,
      lastSeen:     new Date(),
    }).where(eq(accountsTable.address, delegatorAddress));
  }

  const height = getCurrentHeightForNetwork(cfg);
  res.status(201).json({
    delegationId:     delegation?.id,
    txHash,
    delegatorAddress,
    validatorAddress,
    amount:           amtNum.toFixed(6),
    status:           "unbonding",
    unbondingAt:      unbondingAt.toISOString(),
    completesAt:      unbondingAt.toISOString(),
    blockHeight:      height,
    network:          cfg.name,
    message:          `Undelegation initiated — ${cfg.unbondingDays}-day unbonding period starts now`,
  });
});

router.get("/staking/delegations/:address", async (req, res): Promise<void> => {
  const address = String(req.params.address);
  const page    = Math.max(1, Number(req.query.page) || 1);
  const limit   = Math.min(50, Number(req.query.limit) || 20);
  const offset  = (page - 1) * limit;

  const [delegations, [{ total }]] = await Promise.all([
    db.select().from(stakingDelegationsTable)
      .where(eq(stakingDelegationsTable.delegatorAddress, address))
      .orderBy(sql`${stakingDelegationsTable.createdAt} DESC`)
      .limit(limit).offset(offset),
    db.select({ total: count() }).from(stakingDelegationsTable)
      .where(eq(stakingDelegationsTable.delegatorAddress, address)),
  ]);

  res.json({
    delegations: delegations.map(d => ({
      ...d,
      createdAt:   d.createdAt   instanceof Date ? d.createdAt.toISOString()   : d.createdAt,
      unbondingAt: d.unbondingAt instanceof Date ? d.unbondingAt.toISOString() : d.unbondingAt,
      completedAt: d.completedAt instanceof Date ? d.completedAt.toISOString() : d.completedAt,
    })),
    total: Number(total),
  });
});

export default router;
