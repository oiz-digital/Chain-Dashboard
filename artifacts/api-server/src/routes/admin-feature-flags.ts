import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { featureFlagsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/admin/feature-flags", async (_req, res): Promise<void> => {
  const flags = await db.select().from(featureFlagsTable).orderBy(asc(featureFlagsTable.category), asc(featureFlagsTable.key));
  res.json({ flags });
});

router.post("/admin/feature-flags", async (req, res): Promise<void> => {
  const { key, label, description, category, isEnabled, isPublic } = req.body ?? {};
  if (!key || !label) { res.status(400).json({ error: "key and label are required" }); return; }
  const [flag] = await db.insert(featureFlagsTable).values({
    key, label,
    description: description ?? null,
    category:    category ?? "general",
    isEnabled:   typeof isEnabled === "boolean" ? isEnabled : true,
    isPublic:    typeof isPublic  === "boolean" ? isPublic  : true,
  }).returning();
  res.status(201).json(flag);
});

router.patch("/admin/feature-flags/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { isEnabled, label, description, category, isPublic } = req.body ?? {};
  const updates: Partial<typeof featureFlagsTable.$inferInsert> = {};
  if (typeof isEnabled  === "boolean") updates.isEnabled  = isEnabled;
  if (typeof isPublic   === "boolean") updates.isPublic   = isPublic;
  if (typeof label      === "string")  updates.label      = label;
  if (typeof description === "string") updates.description = description;
  if (typeof category   === "string")  updates.category   = category;
  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Nothing to update" }); return; }
  updates.updatedAt = new Date();
  const [flag] = await db.update(featureFlagsTable).set(updates)
    .where(eq(featureFlagsTable.id, id)).returning();
  if (!flag) { res.status(404).json({ error: "Flag not found" }); return; }
  res.json(flag);
});

router.delete("/admin/feature-flags/:id", async (req, res): Promise<void> => {
  const [deleted] = await db.delete(featureFlagsTable)
    .where(eq(featureFlagsTable.id, Number(req.params.id))).returning();
  if (!deleted) { res.status(404).json({ error: "Flag not found" }); return; }
  res.json({ success: true });
});

export default router;
