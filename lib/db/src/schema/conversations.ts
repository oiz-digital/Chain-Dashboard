import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { appUsersTable } from "./app_users";

export const conversationsTable = pgTable("conversations", {
  id:             serial("id").primaryKey(),
  participant1Id: integer("participant1_id").notNull().references(() => appUsersTable.id),
  participant2Id: integer("participant2_id").notNull().references(() => appUsersTable.id),
  chainId:        text("chain_id").unique(),
  createdAt:      timestamp("created_at").notNull().defaultNow(),
  lastMessageAt:  timestamp("last_message_at").notNull().defaultNow(),
});
