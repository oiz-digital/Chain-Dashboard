import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { governanceProposalsTable } from "./governance";

export const voteOptionEnum = pgEnum("vote_option", ["yes", "no", "abstain", "no_with_veto"]);

export const governanceVotesTable = pgTable("governance_votes", {
  id:          serial("id").primaryKey(),
  proposalId:  integer("proposal_id").notNull().references(() => governanceProposalsTable.id),
  voterAddress:text("voter_address").notNull(),
  option:      voteOptionEnum("option").notNull(),
  votingPower: text("voting_power").notNull().default("1"),
  txHash:      text("tx_hash"),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GovernanceVote = typeof governanceVotesTable.$inferSelect;
export type InsertGovernanceVote = typeof governanceVotesTable.$inferInsert;
