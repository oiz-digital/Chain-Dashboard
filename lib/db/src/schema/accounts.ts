import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const accountsTable = pgTable("accounts", {
  address:      text("address").primaryKey(),
  balance:      text("balance").notNull().default("0"),
  stakedAmount: text("staked_amount").notNull().default("0"),
  nonce:        integer("nonce").notNull().default(0),
  txCount:      integer("tx_count").notNull().default(0),
  totalSent:    text("total_sent").notNull().default("0"),
  totalReceived:text("total_received").notNull().default("0"),
  firstSeen:    timestamp("first_seen", { withTimezone: true }).notNull().defaultNow(),
  lastSeen:     timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
});

export type Account = typeof accountsTable.$inferSelect;
export type InsertAccount = typeof accountsTable.$inferInsert;
