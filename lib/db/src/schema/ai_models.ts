import { pgTable, text, serial, integer, boolean, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const modelQuantEnum = pgEnum("model_quant", ["INT4", "INT8", "FP16", "FP32"]);
export const modelCategoryEnum = pgEnum("model_category", ["nlp", "security", "oracle", "vision", "audio", "multimodal"]);

export const aiModelsTable = pgTable("ai_models", {
  id: serial("id").primaryKey(),
  modelIndex: integer("model_index").notNull().unique(),
  name: text("name").notNull(),
  category: modelCategoryEnum("category").notNull().default("nlp"),
  quantization: modelQuantEnum("quantization").notNull().default("INT8"),
  paramsBillion: numeric("params_billion", { precision: 6, scale: 2 }).notNull().default("0"),
  gasPerCall: integer("gas_per_call").notNull().default(6000),
  latencyMs: integer("latency_ms").notNull().default(500),
  accuracyPct: numeric("accuracy_pct", { precision: 5, scale: 2 }).notNull().default("90.00"),
  totalCalls: integer("total_calls").notNull().default(0),
  totalRevenue: text("total_revenue").notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
  description: text("description").notNull().default(""),
  publisherAddress: text("publisher_address").notNull().default(""),
  publisherRevenuePct: integer("publisher_revenue_pct").notNull().default(60),
  daoRevenuePct: integer("dao_revenue_pct").notNull().default(25),
  validatorRevenuePct: integer("validator_revenue_pct").notNull().default(15),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAiModelSchema = createInsertSchema(aiModelsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const updateAiModelSchema = insertAiModelSchema.partial();
export type InsertAiModel = z.infer<typeof insertAiModelSchema>;
export type UpdateAiModel = z.infer<typeof updateAiModelSchema>;
export type AiModel = typeof aiModelsTable.$inferSelect;
