import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  appUsersTable, userSessionsTable,
  conversationsTable, messagesTable,
} from "@workspace/db";
import { eq, and, gt, or, desc, ilike } from "drizzle-orm";

const router: IRouter = Router();

async function getSessionUser(token: string) {
  const now = new Date();
  const [session] = await db.select({ session: userSessionsTable, user: appUsersTable })
    .from(userSessionsTable)
    .innerJoin(appUsersTable, eq(userSessionsTable.userId, appUsersTable.id))
    .where(and(eq(userSessionsTable.token, token), gt(userSessionsTable.expiresAt, now)))
    .limit(1);
  return session ?? null;
}

function authToken(req: any): string | null {
  const h = req.headers.authorization as string | undefined;
  if (h?.startsWith("Bearer ")) return h.slice(7);
  return null;
}

// ── PUT /chat/public-key — register or update caller's public key ──────────
router.put("/chat/public-key", async (req, res): Promise<void> => {
  const tok = authToken(req);
  if (!tok) { res.status(401).json({ error: "Unauthorized" }); return; }
  const sess = await getSessionUser(tok);
  if (!sess) { res.status(401).json({ error: "Invalid or expired session" }); return; }

  const { publicKey, chatId } = req.body ?? {};
  if (!publicKey || typeof publicKey !== "string") {
    res.status(400).json({ error: "publicKey is required" }); return;
  }

  const updates: Record<string, any> = { publicKey, updatedAt: new Date() };
  if (chatId && typeof chatId === "string") {
    const exists = await db.select({ id: appUsersTable.id })
      .from(appUsersTable)
      .where(and(eq(appUsersTable.chatId, chatId), gt(appUsersTable.id, 0)))
      .limit(1);
    const taken = exists.length > 0 && exists[0].id !== sess.user.id;
    if (taken) { res.status(409).json({ error: "Chat ID already taken" }); return; }
    updates.chatId = chatId;
  }

  await db.update(appUsersTable).set(updates).where(eq(appUsersTable.id, sess.user.id));
  res.json({ ok: true });
});

// ── GET /chat/users/search?q= — search users by chatId / displayName / email ─
router.get("/chat/users/search", async (req, res): Promise<void> => {
  const tok = authToken(req);
  if (!tok) { res.status(401).json({ error: "Unauthorized" }); return; }
  const sess = await getSessionUser(tok);
  if (!sess) { res.status(401).json({ error: "Invalid or expired session" }); return; }

  const q = (req.query.q as string ?? "").trim();
  if (q.length < 2) { res.json({ users: [] }); return; }

  const rows = await db.select({
    id: appUsersTable.id,
    displayName: appUsersTable.displayName,
    chatId: appUsersTable.chatId,
    publicKey: appUsersTable.publicKey,
  }).from(appUsersTable)
    .where(
      or(
        ilike(appUsersTable.chatId, `%${q}%`),
        ilike(appUsersTable.displayName, `%${q}%`),
        ilike(appUsersTable.email, `%${q}%`),
      )
    )
    .limit(20);

  res.json({ users: rows.filter(u => u.id !== sess.user.id) });
});

// ── POST /chat/conversations — start or get existing DM ──────────────────────
router.post("/chat/conversations", async (req, res): Promise<void> => {
  const tok = authToken(req);
  if (!tok) { res.status(401).json({ error: "Unauthorized" }); return; }
  const sess = await getSessionUser(tok);
  if (!sess) { res.status(401).json({ error: "Invalid or expired session" }); return; }

  const { recipientId } = req.body ?? {};
  if (!recipientId || typeof recipientId !== "number") {
    res.status(400).json({ error: "recipientId (number) is required" }); return;
  }
  if (recipientId === sess.user.id) {
    res.status(400).json({ error: "Cannot message yourself" }); return;
  }

  const me = sess.user.id;
  const p1 = Math.min(me, recipientId);
  const p2 = Math.max(me, recipientId);

  const existing = await db.select().from(conversationsTable)
    .where(and(eq(conversationsTable.participant1Id, p1), eq(conversationsTable.participant2Id, p2)))
    .limit(1);

  if (existing.length > 0) {
    res.json({ conversation: existing[0] }); return;
  }

  const [conv] = await db.insert(conversationsTable).values({
    participant1Id: p1,
    participant2Id: p2,
  }).returning();

  res.status(201).json({ conversation: conv });
});

// ── GET /chat/conversations — list my DMs with last message preview ───────────
router.get("/chat/conversations", async (req, res): Promise<void> => {
  const tok = authToken(req);
  if (!tok) { res.status(401).json({ error: "Unauthorized" }); return; }
  const sess = await getSessionUser(tok);
  if (!sess) { res.status(401).json({ error: "Invalid or expired session" }); return; }

  const me = sess.user.id;
  const convRows = await db.select().from(conversationsTable)
    .where(or(eq(conversationsTable.participant1Id, me), eq(conversationsTable.participant2Id, me)))
    .orderBy(desc(conversationsTable.lastMessageAt));

  const result = await Promise.all(convRows.map(async (conv) => {
    const otherId = conv.participant1Id === me ? conv.participant2Id : conv.participant1Id;
    const [other] = await db.select({
      id: appUsersTable.id,
      displayName: appUsersTable.displayName,
      chatId: appUsersTable.chatId,
      publicKey: appUsersTable.publicKey,
    }).from(appUsersTable).where(eq(appUsersTable.id, otherId)).limit(1);

    const [lastMsg] = await db.select().from(messagesTable)
      .where(eq(messagesTable.conversationId, conv.id))
      .orderBy(desc(messagesTable.createdAt))
      .limit(1);

    return { ...conv, other, lastMessage: lastMsg ?? null };
  }));

  res.json({ conversations: result });
});

// ── GET /chat/conversations/:id/messages — paginated messages ─────────────────
router.get("/chat/conversations/:id/messages", async (req, res): Promise<void> => {
  const tok = authToken(req);
  if (!tok) { res.status(401).json({ error: "Unauthorized" }); return; }
  const sess = await getSessionUser(tok);
  if (!sess) { res.status(401).json({ error: "Invalid or expired session" }); return; }

  const convId = parseInt(req.params.id, 10);
  const me = sess.user.id;

  const [conv] = await db.select().from(conversationsTable)
    .where(and(
      eq(conversationsTable.id, convId),
      or(eq(conversationsTable.participant1Id, me), eq(conversationsTable.participant2Id, me))
    )).limit(1);

  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  const otherId = conv.participant1Id === me ? conv.participant2Id : conv.participant1Id;
  const [other] = await db.select({
    id: appUsersTable.id,
    displayName: appUsersTable.displayName,
    chatId: appUsersTable.chatId,
    publicKey: appUsersTable.publicKey,
  }).from(appUsersTable).where(eq(appUsersTable.id, otherId)).limit(1);

  const limit  = Math.min(parseInt(req.query.limit as string ?? "50", 10), 100);
  const before = req.query.before ? new Date(req.query.before as string) : new Date();

  const msgs = await db.select().from(messagesTable)
    .where(and(eq(messagesTable.conversationId, convId), gt(before, messagesTable.createdAt)))
    .orderBy(desc(messagesTable.createdAt))
    .limit(limit);

  res.json({ messages: msgs.reverse(), other, conversationId: convId });
});

// ── POST /chat/conversations/:id/messages — send encrypted message ────────────
router.post("/chat/conversations/:id/messages", async (req, res): Promise<void> => {
  const tok = authToken(req);
  if (!tok) { res.status(401).json({ error: "Unauthorized" }); return; }
  const sess = await getSessionUser(tok);
  if (!sess) { res.status(401).json({ error: "Invalid or expired session" }); return; }

  const convId = parseInt(req.params.id, 10);
  const me = sess.user.id;

  const [conv] = await db.select().from(conversationsTable)
    .where(and(
      eq(conversationsTable.id, convId),
      or(eq(conversationsTable.participant1Id, me), eq(conversationsTable.participant2Id, me))
    )).limit(1);

  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  const { encryptedContent, nonce } = req.body ?? {};
  if (!encryptedContent || !nonce) {
    res.status(400).json({ error: "encryptedContent and nonce are required" }); return;
  }

  const [msg] = await db.insert(messagesTable).values({
    conversationId: convId,
    senderId: me,
    encryptedContent,
    nonce,
  }).returning();

  await db.update(conversationsTable)
    .set({ lastMessageAt: new Date() })
    .where(eq(conversationsTable.id, convId));

  res.status(201).json({ message: msg });
});

export default router;
