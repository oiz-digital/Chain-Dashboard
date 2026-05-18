import { pgTable, serial, varchar, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const appUsersTable = pgTable("app_users", {
  id:                     serial("id").primaryKey(),
  email:                  varchar("email", { length: 255 }).notNull().unique(),
  passwordHash:           text("password_hash").notNull(),
  displayName:            varchar("display_name", { length: 100 }),
  isActive:               boolean("is_active").notNull().default(true),
  isEmailVerified:        boolean("is_email_verified").notNull().default(false),
  emailVerificationToken: text("email_verification_token"),
  inviteCodeUsed:         varchar("invite_code_used", { length: 32 }),
  lastLoginAt:            timestamp("last_login_at"),
  createdAt:              timestamp("created_at").notNull().defaultNow(),
  updatedAt:              timestamp("updated_at").notNull().defaultNow(),
});
