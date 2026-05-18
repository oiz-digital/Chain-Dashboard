import { Router, type IRouter } from "express";
import { randomBytes } from "crypto";
import { db } from "@workspace/db";
import { userInvitesTable, appUsersTable } from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";

const router: IRouter = Router();

const strip = (i: typeof userInvitesTable.$inferSelect) => ({
  ...i,
  expiresAt: i.expiresAt instanceof Date ? i.expiresAt.toISOString() : i.expiresAt,
  createdAt: i.createdAt instanceof Date ? i.createdAt.toISOString() : i.createdAt,
});

router.get("/admin/invites", async (req, res): Promise<void> => {
  const page  = Math.max(1, Number(req.query.page)  || 1);
  const limit = Math.min(100, Number(req.query.limit) || 50);
  const offset = (page - 1) * limit;

  const [invites, [{ total }]] = await Promise.all([
    db.select().from(userInvitesTable).orderBy(desc(userInvitesTable.createdAt)).limit(limit).offset(offset),
    db.select({ total: count() }).from(userInvitesTable),
  ]);

  res.json({ invites: invites.map(strip), total: Number(total) });
});

router.post("/admin/invites", async (req, res): Promise<void> => {
  const { email, note, expiresInDays, createdByAdminId } = req.body ?? {};
  const code = randomBytes(8).toString("hex").toUpperCase();
  const expiresAt = expiresInDays
    ? new Date(Date.now() + Number(expiresInDays) * 86_400_000)
    : null;

  const [invite] = await db.insert(userInvitesTable).values({
    code,
    email:            email ?? null,
    note:             note ?? null,
    createdByAdminId: createdByAdminId ?? null,
    expiresAt,
  }).returning();

  res.status(201).json(strip(invite));
});

router.delete("/admin/invites/:id", async (req, res): Promise<void> => {
  const [deleted] = await db.delete(userInvitesTable)
    .where(eq(userInvitesTable.id, Number(req.params.id))).returning();
  if (!deleted) { res.status(404).json({ error: "Invite not found" }); return; }
  res.json({ success: true });
});

export default router;
