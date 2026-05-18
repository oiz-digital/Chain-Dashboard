import { pgTable, text, bigint, integer, timestamp } from "drizzle-orm/pg-core";

export const chainBlocksTable = pgTable("chain_blocks", {
  height:           bigint("height", { mode: "number" }).primaryKey(),
  hash:             text("hash").notNull().unique(),
  parentHash:       text("parent_hash").notNull(),
  stateRoot:        text("state_root").notNull(),
  txRoot:           text("tx_root").notNull(),
  validatorAddress: text("validator_address").notNull(),
  txCount:          integer("tx_count").notNull().default(0),
  gasUsed:          bigint("gas_used", { mode: "number" }).notNull().default(0),
  gasLimit:         bigint("gas_limit", { mode: "number" }).notNull().default(30000000),
  size:             integer("size").notNull().default(0),
  reward:           text("reward").notNull().default("3"),
  timestamp:        timestamp("timestamp", { withTimezone: true }).notNull(),
  createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ChainBlock = typeof chainBlocksTable.$inferSelect;
export type InsertChainBlock = typeof chainBlocksTable.$inferInsert;
