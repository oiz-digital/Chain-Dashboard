import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { appUsersTable } from "./app_users";

export const userSessionsTable = pgTable("user_sessions", {
  id:        serial("id").primaryKey(),
  userId:    integer("user_id").notNull().references(() => appUsersTable.id, { onDelete: "cascade" }),
  token:     text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
