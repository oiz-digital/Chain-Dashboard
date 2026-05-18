import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { governanceProposalsTable, governanceVotesTable } from "@workspace/db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { deterministicHash } from "./blocks";

const router: IRouter = Router();

const toISO = (d: Date | null | undefined) =>
  d instanceof Date ? d.toISOString() : (d ?? null);

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
      submitTime:      toISO(p.submitTime),
      depositEndTime:  toISO(p.depositEndTime),
      votingStartTime: toISO(p.votingStartTime),
      votingEndTime:   toISO(p.votingEndTime),
      createdAt:       toISO(p.createdAt),
    })),
    total: Number(total),
  });
});

router.get("/governance/proposals/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [p] = await db.select().from(governanceProposalsTable)
    .where(eq(governanceProposalsTable.id, id)).limit(1);
  if (!p) { res.status(404).json({ error: "Proposal not found" }); return; }

  const votes = await db.select().from(governanceVotesTable)
    .where(eq(governanceVotesTable.proposalId, id))
    .orderBy(desc(governanceVotesTable.createdAt))
    .limit(20);

  res.json({
    ...p,
    submitTime:      toISO(p.submitTime),
    depositEndTime:  toISO(p.depositEndTime),
    votingStartTime: toISO(p.votingStartTime),
    votingEndTime:   toISO(p.votingEndTime),
    createdAt:       toISO(p.createdAt),
    recentVotes:     votes.map(v => ({
      ...v,
      createdAt: toISO(v.createdAt),
    })),
  });
});

router.get("/governance/params", async (_req, res): Promise<void> => {
  res.json({
    minDepositAmount:    "10000",
    maxDepositPeriodDays:14,
    votingPeriodDays:    14,
    quorum:              "33.40",
    threshold:           "50.00",
    vetoThreshold:       "33.40",
  });
});

router.post("/governance/vote", async (req, res): Promise<void> => {
  const { proposalId, voterAddress, option, votingPower = "1" } = req.body ?? {};

  if (!proposalId || !voterAddress || !option) {
    res.status(400).json({ error: "proposalId, voterAddress, option are required" });
    return;
  }

  const validOptions = ["yes", "no", "abstain", "no_with_veto"];
  if (!validOptions.includes(option)) {
    res.status(400).json({ error: `option must be one of: ${validOptions.join(", ")}` });
    return;
  }

  const [proposal] = await db.select().from(governanceProposalsTable)
    .where(eq(governanceProposalsTable.id, Number(proposalId))).limit(1);
  if (!proposal) {
    res.status(404).json({ error: "Proposal not found" });
    return;
  }
  if (proposal.status !== "voting_period") {
    res.status(400).json({ error: "Proposal is not in voting period" });
    return;
  }

  const [existing] = await db.select().from(governanceVotesTable)
    .where(and(
      eq(governanceVotesTable.proposalId,  Number(proposalId)),
      eq(governanceVotesTable.voterAddress, voterAddress),
    )).limit(1);

  if (existing) {
    res.status(409).json({ error: "Already voted on this proposal", existingVote: existing });
    return;
  }

  const txHash = deterministicHash(
    `zbx:gov:vote:${proposalId}:${voterAddress}:${option}:${Date.now()}`
  );

  const [vote] = await db.insert(governanceVotesTable).values({
    proposalId:  Number(proposalId),
    voterAddress,
    option:      option as "yes" | "no" | "abstain" | "no_with_veto",
    votingPower: String(votingPower),
    txHash,
  }).returning();

  const vp = parseFloat(String(votingPower));
  const updateCol =
    option === "yes"          ? { yesVotes:        sql`${governanceProposalsTable.yesVotes}::numeric + ${vp}` } :
    option === "no"           ? { noVotes:         sql`${governanceProposalsTable.noVotes}::numeric + ${vp}` } :
    option === "abstain"      ? { abstainVotes:    sql`${governanceProposalsTable.abstainVotes}::numeric + ${vp}` } :
    { noWithVetoVotes: sql`${governanceProposalsTable.noWithVetoVotes}::numeric + ${vp}` };

  await db.update(governanceProposalsTable)
    .set({
      ...updateCol,
      totalVotingPower: sql`${governanceProposalsTable.totalVotingPower}::numeric + ${vp}`,
    })
    .where(eq(governanceProposalsTable.id, Number(proposalId)));

  res.status(201).json({
    ...vote,
    createdAt: vote?.createdAt instanceof Date ? vote.createdAt.toISOString() : vote?.createdAt,
    txHash,
    message: "Vote recorded successfully",
  });
});

router.get("/governance/proposals/:id/votes", async (req, res): Promise<void> => {
  const id     = Number(req.params.id);
  const page   = Math.max(1, Number(req.query.page)  || 1);
  const limit  = Math.min(100, Number(req.query.limit) || 50);
  const offset = (page - 1) * limit;

  const [votes, [{ total }]] = await Promise.all([
    db.select().from(governanceVotesTable)
      .where(eq(governanceVotesTable.proposalId, id))
      .orderBy(desc(governanceVotesTable.createdAt))
      .limit(limit).offset(offset),
    db.select({ total: count() }).from(governanceVotesTable)
      .where(eq(governanceVotesTable.proposalId, id)),
  ]);

  res.json({
    votes: votes.map(v => ({ ...v, createdAt: toISO(v.createdAt) })),
    total: Number(total),
  });
});

export default router;
