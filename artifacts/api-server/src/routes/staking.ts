import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { validatorsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import {
  GetStakingOverviewResponse,
  GetStakingValidatorsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/staking/overview", async (req, res): Promise<void> => {
  const validators = await db.select().from(validatorsTable);
  const active     = validators.filter(v => v.status === "active");

  const totalStaked     = validators.reduce((s, v) => s + Number(v.totalStaked), 0);
  const totalDelegators = validators.reduce((s, v) => s + v.delegators, 0);
  const zbxPrice        = 0.0847 + Math.sin(Date.now() / 180000) * 0.003;
  const stakingApr      = ((12_000_000 / Math.max(totalStaked, 1)) * 100).toFixed(2);
  const liquidStakingTvl     = (totalStaked * zbxPrice * 0.18).toFixed(2);
  const rewardsDistributed24h =
    ((totalStaked * zbxPrice * Number(stakingApr) / 100) / 365).toFixed(2);

  res.json(GetStakingOverviewResponse.parse({
    totalStaked: totalStaked.toFixed(0),
    totalDelegators,
    activeValidators: active.length,
    stakingApr,
    liquidStakingTvl,
    rewardsDistributed24h,
    inflationRate: "7.80",
    zbxPrice: parseFloat(zbxPrice.toFixed(4)),
    unbondingPeriodDays: 21,
    minStakeAmount: "1000",
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
      id: v.id,
      address: v.address,
      moniker: v.moniker,
      status: v.status,
      commission: v.commission,
      totalStaked: v.totalStaked,
      selfStaked: v.selfStaked,
      delegators: v.delegators,
      uptime: v.uptime,
      apr: apr.toFixed(2),
      rank: v.rank,
      website: v.website,
      description: v.description,
    };
  });

  res.json(GetStakingValidatorsResponse.parse({
    validators: mapped,
    total: Number(total),
  }));
});

export default router;
