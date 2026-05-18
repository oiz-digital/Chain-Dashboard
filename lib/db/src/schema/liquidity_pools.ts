import { pgTable, text, serial, numeric, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const liquidityPoolsTable = pgTable("liquidity_pools", {
  id: serial("id").primaryKey(),
  pairName: text("pair_name").notNull(),
  token0Symbol: text("token0_symbol").notNull(),
  token1Symbol: text("token1_symbol").notNull(),
  contractAddress: text("contract_address").notNull().unique(),
  token0Reserve: numeric("token0_reserve", { precision: 30, scale: 8 }).notNull().default("0"),
  token1Reserve: numeric("token1_reserve", { precision: 30, scale: 8 }).notNull().default("0"),
  lpTokenSupply: numeric("lp_token_supply", { precision: 30, scale: 8 }).notNull().default("0"),
  tvlUsd: numeric("tvl_usd", { precision: 20, scale: 2 }).notNull().default("0"),
  volume24h: numeric("volume_24h", { precision: 20, scale: 2 }).notNull().default("0"),
  volume7d: numeric("volume_7d", { precision: 20, scale: 2 }).notNull().default("0"),
  fees24h: numeric("fees_24h", { precision: 20, scale: 2 }).notNull().default("0"),
  apy: numeric("apy", { precision: 8, scale: 4 }).notNull().default("0"),
  feeTier: text("fee_tier").notNull().default("0.30%"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLiquidityPoolSchema = createInsertSchema(liquidityPoolsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const updateLiquidityPoolSchema = insertLiquidityPoolSchema.partial();
export type InsertLiquidityPool = z.infer<typeof insertLiquidityPoolSchema>;
export type LiquidityPool = typeof liquidityPoolsTable.$inferSelect;
