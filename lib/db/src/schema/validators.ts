import { pgTable, text, serial, numeric, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const validatorStatusEnum = pgEnum("validator_status", ["active", "inactive", "jailed"]);

export const validatorsTable = pgTable("validators", {
  id: serial("id").primaryKey(),
  address: text("address").notNull().unique(),
  moniker: text("moniker").notNull(),
  status: validatorStatusEnum("status").notNull().default("active"),
  commission: numeric("commission", { precision: 5, scale: 2 }).notNull().default("5.00"),
  votingPower: text("voting_power").notNull().default("0"),
  totalStaked: text("total_staked").notNull().default("0"),
  selfStaked: text("self_staked").notNull().default("0"),
  delegators: integer("delegators").notNull().default(0),
  uptime: numeric("uptime", { precision: 6, scale: 3 }).notNull().default("99.000"),
  blocksProposed: integer("blocks_proposed").notNull().default(0),
  blocksSkipped: integer("blocks_skipped").notNull().default(0),
  rank: integer("rank").notNull().default(0),
  website: text("website").notNull().default(""),
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertValidatorSchema = createInsertSchema(validatorsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const updateValidatorSchema = insertValidatorSchema.partial();
export type InsertValidator = z.infer<typeof insertValidatorSchema>;
export type UpdateValidator = z.infer<typeof updateValidatorSchema>;
export type Validator = typeof validatorsTable.$inferSelect;
