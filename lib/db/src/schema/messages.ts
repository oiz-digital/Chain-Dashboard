import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { conversationsTable } from "./conversations";
import { appUsersTable } from "./app_users";

export const messagesTable = pgTable("messages", {
  id:               serial("id").primaryKey(),
  conversationId:   integer("conversation_id").notNull().references(() => conversationsTable.id),
  senderId:         integer("sender_id").notNull().references(() => appUsersTable.id),
  encryptedContent: text("encrypted_content").notNull(),
  nonce:            text("nonce").notNull(),
  createdAt:        timestamp("created_at").notNull().defaultNow(),
});
