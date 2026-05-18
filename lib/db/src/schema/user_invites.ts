import { pgTable, serial, varchar, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const userInvitesTable = pgTable("user_invites", {
  id:                serial("id").primaryKey(),
  code:              varchar("code", { length: 32 }).notNull().unique(),
  email:             varchar("email", { length: 255 }),
  note:              text("note"),
  createdByAdminId:  integer("created_by_admin_id"),
  usedByUserId:      integer("used_by_user_id"),
  isUsed:            boolean("is_used").notNull().default(false),
  expiresAt:         timestamp("expires_at"),
  createdAt:         timestamp("created_at").notNull().defaultNow(),
});
