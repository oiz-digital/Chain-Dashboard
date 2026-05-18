import { pgTable, serial, varchar, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const featureFlagsTable = pgTable("feature_flags", {
  id:          serial("id").primaryKey(),
  key:         varchar("key", { length: 64 }).notNull().unique(),
  label:       varchar("label", { length: 128 }).notNull(),
  description: text("description"),
  category:    varchar("category", { length: 32 }).notNull().default("general"),
  isEnabled:   boolean("is_enabled").notNull().default(true),
  isPublic:    boolean("is_public").notNull().default(true),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
});
