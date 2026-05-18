import { pgTable, text, serial, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const adminRoleEnum = pgEnum("admin_role", ["superadmin", "admin", "moderator", "viewer"]);

export const adminUsersTable = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: adminRoleEnum("role").notNull().default("viewer"),
  displayName: text("display_name").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  lastLogin: timestamp("last_login", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAdminUserSchema = createInsertSchema(adminUsersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const updateAdminUserSchema = insertAdminUserSchema.partial().omit({ passwordHash: true });
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type UpdateAdminUser = z.infer<typeof updateAdminUserSchema>;
export type AdminUser = typeof adminUsersTable.$inferSelect;
