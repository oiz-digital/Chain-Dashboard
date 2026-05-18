import { pgTable, text, serial, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingTypeEnum = pgEnum("setting_type", ["string", "number", "boolean", "json"]);

export const systemSettingsTable = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  type: settingTypeEnum("type").notNull().default("string"),
  label: text("label").notNull().default(""),
  description: text("description").notNull().default(""),
  category: text("category").notNull().default("general"),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSystemSettingSchema = createInsertSchema(systemSettingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const updateSystemSettingSchema = insertSystemSettingSchema.partial();
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
export type UpdateSystemSetting = z.infer<typeof updateSystemSettingSchema>;
export type SystemSetting = typeof systemSettingsTable.$inferSelect;
