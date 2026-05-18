import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { validatorsTable, stakingDelegationsTable, accountsTable } from "@workspace/db";
import { eq, count, sql } from "drizzle-orm";
import {
  GetStakingOverviewResponse,
  GetStakingValidatorsResponse,
} from "@workspace/api-zod";
import { VALIDATORS, MONIKERS, deterministicHash, getCurrentHeight } from "./blocks";

const router: IRouter = Router();

const ZBX_PRICE_USD = 0.0847;

function getZbxPrice(): number {
  const nowSec = Math.floor(Date.now() / 1000);
  return parseFloat((ZBX_PRICE_USD + Math.sin(nowSec / 180) * 0.003).toFixed(4));
}

router.get("/staking/overview", async (_req, res): Promise<void> => {
  const validators  = await db.select().from(validatorsTable);
  const active      = validators.filter(v => v.status === "active");

  const totalStaked      = validators.reduce((s, v) => s + Number(v.totalStaked), 0);
  const totalDelegators  = validators.reduce((s, v) => s + v.delegators, 0);
  const zbxPrice         = getZbxPrice();
  const stakingApr       = ((12_000_000 / Math.max(totalStaked, 1)) * 100).toFixed(2);
  const liquidStakingTvl = (totalStaked * zbxPrice * 0.18).toFixed(2);
  const rewardsDistributed24h = (
    (totalStaked * zbxPrice * Number(stakingApr) / 100) / 365
  ).toFixed(2);

  res.json(GetStakingOverviewResponse.parse({
    totalStaked:          totalStaked.toFixed(0),
    totalDelegators,
    activeValidators:     active.length,
    stakingApr,
    liquidStakingTvl,
    rewardsDistributed24h,
    inflationRate:        "7.80",
    zbxPrice,
    unbondingPeriodDays:  21,
    minStakeAmount:       "1000",
  }));
});

router.get("/staking/validators", async (req, res): Promise<void> => {
  const page   = Math.max(1, Number(req.query.page)  || 1);
  const limit  = Math.min(50, Number(req.query.limit) || 20);
  const offset = (page - 1) * limit;

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
    const apr = Math.max(
      0,
      (12_000_000 / Math.max(totalStakedAll, 1)) * 100 * (1 - commission / 100)
    );
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
  const { delegatorAddress, validatorAddress, amount } = req.body ?? {};

  if (!delegatorAddress || !validatorAddress || !amount) {
    res.status(400).json({ error: "delegatorAddress, validatorAddress, amount are required" });
    return;
  }

  const amtNum = parseFloat(amount);
  if (isNaN(amtNum) || amtNum < 10) {
    res.status(400).json({ error: "Minimum delegation is 10 ZBX" });
    return;
  }

  const [dbValidator] = await db.select().from(validatorsTable)
    .where(eq(validatorsTable.address, validatorAddress)).limit(1);
  const isSimValidator = VALIDATORS.includes(validatorAddress);
  if (!dbValidator && !isSimValidator) {
    res.status(404).json({ error: "Validator not found" });
    return;
  }
  if (dbValidator && dbValidator.status !== "active") {
    res.status(400).json({ error: "Validator is not active" });
    return;
  }

  const { getOrCreateAccount } = await import("./wallet");
  const account = await getOrCreateAccount(delegatorAddress);
  if (parseFloat(account.balance) < amtNum) {
    res.status(400).json({ error: `Insufficient balance: ${parseFloat(account.balance).toFixed(6)} ZBX available` });
    return;
  }

  const txHash = deterministicHash(
    `zbx:stake:delegate:${delegatorAddress}:${validatorAddress}:${amount}:${Date.now()}`
  );

  const [delegation] = await db.insert(stakingDelegationsTable).values({
    delegatorAddress,
    validatorAddress,
    amount:  amtNum.toFixed(6),
    status:  "active",
    txHash,
  }).returning();

  await db.update(validatorsTable).set({
    totalStaked: sql`(${validatorsTable.totalStaked}::numeric + ${amtNum})::text`,
    delegators:  sql`${validatorsTable.delegators} + 1`,
  }).where(eq(validatorsTable.address, validatorAddress));

  if (account) {
    const newBalance     = (parseFloat(account.balance) - amtNum).toFixed(6);
    const newStaked      = (parseFloat(account.stakedAmount ?? "0") + amtNum).toFixed(6);
    await db.update(accountsTable).set({
      balance:      newBalance,
      stakedAmount: newStaked,
      lastSeen:     new Date(),
    }).where(eq(accountsTable.address, delegatorAddress));
  }

  res.status(201).json({
    delegationId:     delegation?.id,
    txHash,
    delegatorAddress,
    validatorAddress,
    amount:           amtNum.toFixed(6),
    status:           "active",
    blockHeight:      getCurrentHeight(),
    message:          "Delegation successful",
  });
});

router.post("/staking/undelegate", async (req, res): Promise<void> => {
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

  const [validator] = await db.select().from(validatorsTable)
    .where(eq(validatorsTable.address, validatorAddress)).limit(1);
  if (!validator) {
    res.status(404).json({ error: "Validator not found" });
    return;
  }

  const txHash      = deterministicHash(
    `zbx:stake:undelegate:${delegatorAddress}:${validatorAddress}:${amount}:${Date.now()}`
  );
  const unbondingAt = new Date(Date.now() + 21 * 24 * 3600 * 1000);

  const [delegation] = await db.insert(stakingDelegationsTable).values({
    delegatorAddress,
    validatorAddress,
    amount:      amtNum.toFixed(6),
    status:      "unbonding",
    txHash,
    unbondingAt,
  }).returning();

  await db.update(validatorsTable).set({
    totalStaked: sql`GREATEST(0, ${validatorsTable.totalStaked}::numeric - ${amtNum})::text`,
    delegators:  sql`GREATEST(0, ${validatorsTable.delegators} - 1)`,
  }).where(eq(validatorsTable.address, validatorAddress));

  const [account] = await db.select().from(accountsTable)
    .where(eq(accountsTable.address, delegatorAddress)).limit(1);
  if (account) {
    const newStaked = Math.max(0, parseFloat(account.stakedAmount ?? "0") - amtNum).toFixed(6);
    await db.update(accountsTable).set({
      stakedAmount: newStaked,
      lastSeen:     new Date(),
    }).where(eq(accountsTable.address, delegatorAddress));
  }

  res.status(201).json({
    delegationId:     delegation?.id,
    txHash,
    delegatorAddress,
    validatorAddress,
    amount:           amtNum.toFixed(6),
    status:           "unbonding",
    unbondingAt:      unbondingAt.toISOString(),
    completesAt:      unbondingAt.toISOString(),
    blockHeight:      getCurrentHeight(),
    message:          "Undelegation initiated — 21-day unbonding period starts now",
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
