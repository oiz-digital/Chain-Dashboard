import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { governanceProposalsTable, governanceVotesTable } from "@workspace/db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { deterministicHash } from "./blocks";
import { parseNetwork } from "./network-config";

const router: IRouter = Router();

const toISO = (d: Date | null | undefined) =>
  d instanceof Date ? d.toISOString() : (d ?? null);

const TESTNET_PROPOSALS = [
  {
    id: 1001, title: "ZEP-T001: Enable Testnet Faucet Rate Limits",
    description: "Proposal to implement per-IP rate limiting for the testnet faucet to prevent abuse. Reduce from 1000 ZBX to 500 ZBX per request.",
    type: "parameter_change", status: "passed",
    proposer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    yesVotes: "8200000", noVotes: "1200000", abstainVotes: "300000", noWithVetoVotes: "50000",
    totalVotingPower: "9750000", quorum: "35.00", threshold: "82.00",
    submitTime: "2026-02-01T00:00:00Z", depositEndTime: "2026-02-15T00:00:00Z",
    votingStartTime: "2026-02-15T00:00:00Z", votingEndTime: "2026-03-01T00:00:00Z",
  },
  {
    id: 1002, title: "ZEP-T002: Increase Testnet Block Gas Limit",
    description: "Increase block gas limit from 15M to 30M to allow testing of larger smart contract deployments.",
    type: "parameter_change", status: "voting_period",
    proposer: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    yesVotes: "5500000", noVotes: "900000", abstainVotes: "600000", noWithVetoVotes: "100000",
    totalVotingPower: "7100000", quorum: "28.00", threshold: "77.46",
    submitTime: "2026-04-01T00:00:00Z", depositEndTime: "2026-04-15T00:00:00Z",
    votingStartTime: "2026-04-15T00:00:00Z", votingEndTime: "2026-05-15T00:00:00Z",
  },
  {
    id: 1003, title: "ZEP-T003: Add ZVM Opcode KECCAK512",
    description: "Add a new native precompile for KECCAK-512 to speed up ZK proof verification in the ZBX VM.",
    type: "software_upgrade", status: "deposit_period",
    proposer: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    yesVotes: "0", noVotes: "0", abstainVotes: "0", noWithVetoVotes: "0",
    totalVotingPower: "0", quorum: "0.00", threshold: "0.00",
    submitTime: "2026-05-01T00:00:00Z", depositEndTime: "2026-05-15T00:00:00Z",
    votingStartTime: null, votingEndTime: null,
  },
  {
    id: 1004, title: "ZEP-T004: Testnet Validator Slashing Parameters",
    description: "Adjust slashing parameters for testnet: reduce double-sign slash from 5% to 1% to encourage validator testing.",
    type: "parameter_change", status: "rejected",
    proposer: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    yesVotes: "1200000", noVotes: "6800000", abstainVotes: "400000", noWithVetoVotes: "200000",
    totalVotingPower: "8600000", quorum: "34.00", threshold: "13.95",
    submitTime: "2026-03-01T00:00:00Z", depositEndTime: "2026-03-15T00:00:00Z",
    votingStartTime: "2026-03-15T00:00:00Z", votingEndTime: "2026-03-29T00:00:00Z",
  },
];

router.get("/governance/proposals", async (req, res): Promise<void> => {
  const cfg    = parseNetwork(req);
  const page   = Math.max(1, Number(req.query.page)  || 1);
  const limit  = Math.min(50, Number(req.query.limit) || 20);
  const status = String(req.query.status || "all");
  const offset = (page - 1) * limit;

  if (cfg.name === "testnet") {
    const filtered = status === "all"
      ? TESTNET_PROPOSALS
      : TESTNET_PROPOSALS.filter(p => p.status === status);
    const paged = filtered.slice(offset, offset + limit);
    res.json({ proposals: paged, total: filtered.length });
    return;
  }

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
  const cfg = parseNetwork(req);
  const id  = Number(req.params.id);

  if (cfg.name === "testnet") {
    const p = TESTNET_PROPOSALS.find(p => p.id === id);
    if (!p) { res.status(404).json({ error: "Proposal not found" }); return; }
    res.json({ ...p, recentVotes: [] });
    return;
  }

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
    recentVotes:     votes.map(v => ({ ...v, createdAt: toISO(v.createdAt) })),
  });
});

router.get("/governance/params", async (req, res): Promise<void> => {
  const cfg = parseNetwork(req);
  if (cfg.name === "testnet") {
    res.json({
      minDepositAmount:    "1000",
      maxDepositPeriodDays:14,
      votingPeriodDays:    14,
      quorum:              "25.00",
      threshold:           "50.00",
      vetoThreshold:       "33.40",
      network:             "testnet",
    });
    return;
  }
  res.json({
    minDepositAmount:    "10000",
    maxDepositPeriodDays:14,
    votingPeriodDays:    14,
    quorum:              "33.40",
    threshold:           "50.00",
    vetoThreshold:       "33.40",
    network:             "mainnet",
  });
});

router.post("/governance/vote", async (req, res): Promise<void> => {
  const cfg = parseNetwork(req);
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

  if (cfg.name === "testnet") {
    const proposal = TESTNET_PROPOSALS.find(p => p.id === Number(proposalId));
    if (!proposal) {
      res.status(404).json({ error: "Proposal not found" });
      return;
    }
    if (proposal.status !== "voting_period") {
      res.status(400).json({ error: "Proposal is not in voting period" });
      return;
    }
    const txHash = deterministicHash(
      `zbx:gov:vote:testnet:${proposalId}:${voterAddress}:${option}:${Date.now()}`
    );
    res.status(201).json({
      proposalId: Number(proposalId),
      voterAddress,
      option,
      votingPower: String(votingPower),
      txHash,
      network: "testnet",
      message: "Vote recorded on testnet",
    });
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
      eq(governanceVotesTable.proposalId,   Number(proposalId)),
      eq(governanceVotesTable.voterAddress,  voterAddress),
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
    .set({ ...updateCol, totalVotingPower: sql`${governanceProposalsTable.totalVotingPower}::numeric + ${vp}` })
    .where(eq(governanceProposalsTable.id, Number(proposalId)));

  res.status(201).json({
    ...vote,
    createdAt: vote?.createdAt instanceof Date ? vote.createdAt.toISOString() : vote?.createdAt,
    txHash,
    message: "Vote recorded successfully",
  });
});

router.get("/governance/proposals/:id/votes", async (req, res): Promise<void> => {
  const cfg = parseNetwork(req);
  const id  = Number(req.params.id);

  if (cfg.name === "testnet") {
    res.json({ votes: [], total: 0 });
    return;
  }

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
