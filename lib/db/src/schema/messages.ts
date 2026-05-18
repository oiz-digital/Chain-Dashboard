import { pgTable, serial, integer, text, boolean, bigint, timestamp } from "drizzle-orm/pg-core";
import { conversationsTable } from "./conversations";
import { appUsersTable } from "./app_users";

export const messagesTable = pgTable("messages", {
  id:               serial("id").primaryKey(),
  conversationId:   integer("conversation_id").notNull().references(() => conversationsTable.id),
  senderId:         integer("sender_id").notNull().references(() => appUsersTable.id),
  encryptedContent: text("encrypted_content").notNull(),
  nonce:            text("nonce").notNull(),
  txHash:           text("tx_hash").unique(),
  blockHeight:      bigint("block_height", { mode: "number" }).notNull().default(0),
  chainConfirmed:   boolean("chain_confirmed").notNull().default(true),
  createdAt:        timestamp("created_at").notNull().defaultNow(),
});
