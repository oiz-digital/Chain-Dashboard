import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { appUsersTable } from "./app_users";

export const conversationsTable = pgTable("conversations", {
  id:            serial("id").primaryKey(),
  participant1Id: integer("participant1_id").notNull().references(() => appUsersTable.id),
  participant2Id: integer("participant2_id").notNull().references(() => appUsersTable.id),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
  lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
});
