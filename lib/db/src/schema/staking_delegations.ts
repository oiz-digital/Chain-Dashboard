import { pgTable, serial, text, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const delegationStatusEnum = pgEnum("delegation_status", ["active", "unbonding", "unbonded"]);

export const stakingDelegationsTable = pgTable("staking_delegations", {
  id:               serial("id").primaryKey(),
  delegatorAddress: text("delegator_address").notNull(),
  validatorAddress: text("validator_address").notNull(),
  amount:           text("amount").notNull(),
  status:           delegationStatusEnum("status").notNull().default("active"),
  txHash:           text("tx_hash"),
  unbondingAt:      timestamp("unbonding_at", { withTimezone: true }),
  completedAt:      timestamp("completed_at", { withTimezone: true }),
  createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StakingDelegation = typeof stakingDelegationsTable.$inferSelect;
export type InsertStakingDelegation = typeof stakingDelegationsTable.$inferInsert;
