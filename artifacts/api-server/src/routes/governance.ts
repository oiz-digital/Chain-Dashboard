import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { governanceProposalsTable } from "@workspace/db";
import { eq, desc, sql, count } from "drizzle-orm";

const router: IRouter = Router();

const toISO = (d: Date | null | undefined) => d instanceof Date ? d.toISOString() : (d ?? null);

router.get("/governance/proposals", async (req, res): Promise<void> => {
  const page   = Math.max(1, Number(req.query.page)  || 1);
  const limit  = Math.min(50, Number(req.query.limit) || 20);
  const status = String(req.query.status || "all");
  const offset = (page - 1) * limit;

  const where = status === "all"
    ? sql`1=1`
    : eq(governanceProposalsTable.status, status as "deposit_period" | "voting_period" | "passed" | "rejected" | "failed");

  const [proposals, [{ total }]] = await Promise.all([
    db.select().from(governanceProposalsTable)
      .where(where)
      .orderBy(desc(governanceProposalsTable.id))
      .limit(limit).offset(offset),
    db.select({ total: count() }).from(governanceProposalsTable).where(where),
  ]);

  res.json({
    proposals: proposals.map(p => ({
      ...p,
      submitTime: toISO(p.submitTime),
      depositEndTime: toISO(p.depositEndTime),
      votingStartTime: toISO(p.votingStartTime),
      votingEndTime: toISO(p.votingEndTime),
      createdAt: toISO(p.createdAt),
    })),
    total: Number(total),
  });
});

router.get("/governance/proposals/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [p] = await db.select().from(governanceProposalsTable)
    .where(eq(governanceProposalsTable.id, id)).limit(1);
  if (!p) { res.status(404).json({ error: "Proposal not found" }); return; }
  res.json({
    ...p,
    submitTime: toISO(p.submitTime),
    depositEndTime: toISO(p.depositEndTime),
    votingStartTime: toISO(p.votingStartTime),
    votingEndTime: toISO(p.votingEndTime),
    createdAt: toISO(p.createdAt),
  });
});

router.get("/governance/params", async (_req, res): Promise<void> => {
  res.json({
    minDepositAmount: "10000",
    maxDepositPeriodDays: 14,
    votingPeriodDays: 14,
    quorum: "33.40",
    threshold: "50.00",
    vetoThreshold: "33.40",
  });
});

export default router;
