import { pgTable, text, serial, numeric, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const swapStatusEnum = pgEnum("swap_status", ["success", "failed", "pending"]);

export const swapTransactionsTable = pgTable("swap_transactions", {
  id: serial("id").primaryKey(),
  txHash: text("tx_hash").notNull().unique(),
  walletAddress: text("wallet_address").notNull().default(""),
  tokenIn: text("token_in").notNull(),
  tokenOut: text("token_out").notNull(),
  amountIn: numeric("amount_in", { precision: 30, scale: 8 }).notNull(),
  amountOut: numeric("amount_out", { precision: 30, scale: 8 }).notNull(),
  priceImpact: numeric("price_impact", { precision: 8, scale: 4 }).notNull().default("0"),
  executionPrice: numeric("execution_price", { precision: 20, scale: 8 }).notNull().default("0"),
  poolId: integer("pool_id"),
  slippage: numeric("slippage", { precision: 6, scale: 4 }).notNull().default("0.5"),
  gasUsed: integer("gas_used").notNull().default(0),
  status: swapStatusEnum("status").notNull().default("success"),
  blockHeight: integer("block_height").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSwapTransactionSchema = createInsertSchema(swapTransactionsTable).omit({ id: true, createdAt: true });
export type InsertSwapTransaction = z.infer<typeof insertSwapTransactionSchema>;
export type SwapTransaction = typeof swapTransactionsTable.$inferSelect;
