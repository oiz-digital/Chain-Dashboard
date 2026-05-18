import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ibcChannelsTable } from "@workspace/db";
import { count } from "drizzle-orm";

const router: IRouter = Router();

router.get("/ibc/channels", async (_req, res): Promise<void> => {
  const [channels, [{ total }]] = await Promise.all([
    db.select().from(ibcChannelsTable).orderBy(ibcChannelsTable.id),
    db.select({ total: count() }).from(ibcChannelsTable),
  ]);

  res.json({
    channels: channels.map(c => ({
      ...c,
      createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
    })),
    total: Number(total),
  });
});

export default router;
