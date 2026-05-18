import { pgTable, serial, varchar, text, integer, numeric, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const proposalStatusEnum = pgEnum("proposal_status", ["deposit_period", "voting_period", "passed", "rejected", "failed"]);
export const proposalTypeEnum   = pgEnum("proposal_type",   ["text", "parameter_change", "software_upgrade", "community_pool_spend", "cancel_software_upgrade"]);

export const governanceProposalsTable = pgTable("governance_proposals", {
  id:              serial("id").primaryKey(),
  title:           varchar("title", { length: 256 }).notNull(),
  description:     text("description").notNull(),
  proposalType:    proposalTypeEnum("proposal_type").notNull().default("text"),
  status:          proposalStatusEnum("status").notNull().default("voting_period"),
  proposerAddress: varchar("proposer_address", { length: 64 }).notNull(),
  submitTime:      timestamp("submit_time").notNull().defaultNow(),
  depositEndTime:  timestamp("deposit_end_time").notNull(),
  votingStartTime: timestamp("voting_start_time"),
  votingEndTime:   timestamp("voting_end_time"),
  totalDeposit:    numeric("total_deposit", { precision: 24, scale: 6 }).notNull().default("0"),
  yesVotes:        numeric("yes_votes",  { precision: 24, scale: 6 }).notNull().default("0"),
  noVotes:         numeric("no_votes",   { precision: 24, scale: 6 }).notNull().default("0"),
  abstainVotes:    numeric("abstain_votes", { precision: 24, scale: 6 }).notNull().default("0"),
  noWithVetoVotes: numeric("no_with_veto_votes", { precision: 24, scale: 6 }).notNull().default("0"),
  totalVotingPower:numeric("total_voting_power", { precision: 24, scale: 6 }).notNull().default("0"),
  quorumReached:   boolean("quorum_reached").notNull().default(false),
  contentSummary:  text("content_summary"),
  createdAt:       timestamp("created_at").notNull().defaultNow(),
});
