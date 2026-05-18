import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const testnetFaucetRequestsTable = pgTable("testnet_faucet_requests", {
  id:          serial("id").primaryKey(),
  address:     text("address").notNull(),
  amount:      text("amount").notNull().default("1000"),
  txHash:      text("tx_hash").notNull(),
  ipAddress:   text("ip_address"),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TestnetFaucetRequest = typeof testnetFaucetRequestsTable.$inferSelect;
export type InsertTestnetFaucetRequest = typeof testnetFaucetRequestsTable.$inferInsert;
