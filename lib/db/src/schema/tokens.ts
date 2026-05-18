import { pgTable, text, serial, numeric, boolean, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tokenTypeEnum = pgEnum("token_type", ["native", "erc20", "lp", "wrapped"]);

export const tokensTable = pgTable("tokens", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull().unique(),
  name: text("name").notNull(),
  type: tokenTypeEnum("type").notNull().default("erc20"),
  contractAddress: text("contract_address"),
  decimals: integer("decimals").notNull().default(18),
  totalSupply: text("total_supply").notNull().default("0"),
  circulatingSupply: text("circulating_supply").notNull().default("0"),
  priceUsd: numeric("price_usd", { precision: 20, scale: 8 }).notNull().default("0"),
  priceChange24h: numeric("price_change_24h", { precision: 8, scale: 4 }).notNull().default("0"),
  marketCap: text("market_cap").notNull().default("0"),
  volume24h: text("volume_24h").notNull().default("0"),
  holders: integer("holders").notNull().default(0),
  logoUrl: text("logo_url"),
  description: text("description").notNull().default(""),
  website: text("website").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  isVerified: boolean("is_verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTokenSchema = createInsertSchema(tokensTable).omit({ id: true, createdAt: true, updatedAt: true });
export const updateTokenSchema = insertTokenSchema.partial();
export type InsertToken = z.infer<typeof insertTokenSchema>;
export type UpdateToken = z.infer<typeof updateTokenSchema>;
export type Token = typeof tokensTable.$inferSelect;
