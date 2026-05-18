import { pgTable, serial, text, bigint, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const txStatusEnum = pgEnum("tx_status", ["success", "failed", "pending"]);
export const txTypeEnum   = pgEnum("tx_type",   ["transfer", "stake", "unstake", "delegate", "contract", "reward", "governance", "swap"]);

export const chainTransactionsTable = pgTable("chain_transactions", {
  id:          serial("id").primaryKey(),
  hash:        text("hash").notNull().unique(),
  blockHeight: bigint("block_height", { mode: "number" }).notNull(),
  fromAddress: text("from_address").notNull(),
  toAddress:   text("to_address").notNull(),
  amount:      text("amount").notNull().default("0"),
  fee:         text("fee").notNull().default("0.001"),
  status:      txStatusEnum("status").notNull().default("success"),
  type:        txTypeEnum("type").notNull().default("transfer"),
  nonce:       integer("nonce").notNull().default(0),
  gasLimit:    bigint("gas_limit", { mode: "number" }).notNull().default(21000),
  gasUsed:     bigint("gas_used", { mode: "number" }).notNull().default(21000),
  gasPrice:    text("gas_price").notNull().default("0.000000001"),
  data:        text("data").notNull().default("0x"),
  timestamp:   timestamp("timestamp", { withTimezone: true }).notNull(),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ChainTransaction = typeof chainTransactionsTable.$inferSelect;
export type InsertChainTransaction = typeof chainTransactionsTable.$inferInsert;
