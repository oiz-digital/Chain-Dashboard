import { Router, type IRouter } from "express";
import { createHash, randomBytes } from "crypto";
import { db } from "@workspace/db";
import {
  appUsersTable, userSessionsTable,
  conversationsTable, messagesTable,
} from "@workspace/db";
import { eq, and, gt, or, desc, ilike, sql } from "drizzle-orm";

const router: IRouter = Router();

const GENESIS_MS    = 1_700_000_000_000n;
const BLOCK_TIME_MS = 2000n;

function currentBlock(): number {
  return Number((BigInt(Date.now()) - GENESIS_MS) / BLOCK_TIME_MS);
}

function genTxHash(convId: number, senderId: number, nonce: string): string {
  return "0x" + createHash("sha256")
    .update(`${convId}:${senderId}:${nonce}:${Date.now()}:${randomBytes(8).toString("hex")}`)
    .digest("hex");
}

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
  return h?.startsWith("Bearer ") ? h.slice(7) : null;
}

function userPublic(u: typeof appUsersTable.$inferSelect) {
  return {
    id: u.id,
    displayName: u.displayName,
    walletAddress: u.walletAddress,
    publicKey: u.publicKey,
    chatId: u.chatId,
  };
}

// ── POST /chat/register ─── register wallet address + public key (PERMANENT) ─
router.post("/chat/register", async (req, res): Promise<void> => {
  const tok = authToken(req);
  if (!tok) { res.status(401).json({ error: "Unauthorized" }); return; }
  const sess = await getSessionUser(tok);
  if (!sess) { res.status(401).json({ error: "Invalid or expired session" }); return; }

  if (sess.user.walletAddress) {
    res.json({ ok: true, walletAddress: sess.user.walletAddress, alreadyRegistered: true });
    return;
  }

  const { walletAddress, publicKey } = req.body ?? {};
  if (!walletAddress || typeof walletAddress !== "string") {
    res.status(400).json({ error: "walletAddress is required" }); return;
  }
  if (!publicKey || typeof publicKey !== "string") {
    res.status(400).json({ error: "publicKey is required" }); return;
  }
  if (!walletAddress.startsWith("zbx1") || walletAddress.length !== 44) {
    res.status(400).json({ error: "Invalid ZBX wallet address format" }); return;
  }

  const existing = await db.select({ id: appUsersTable.id })
    .from(appUsersTable)
    .where(eq(appUsersTable.walletAddress, walletAddress))
    .limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Wallet address already registered to another account" }); return;
  }

  await db.update(appUsersTable).set({
    walletAddress,
    publicKey,
    walletRegisteredAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(appUsersTable.id, sess.user.id));

  res.status(201).json({ ok: true, walletAddress, blockHeight: currentBlock() });
});

// ── GET /chat/me ─── return my wallet info ────────────────────────────────────
router.get("/chat/me", async (req, res): Promise<void> => {
  const tok = authToken(req);
  if (!tok) { res.status(401).json({ error: "Unauthorized" }); return; }
  const sess = await getSessionUser(tok);
  if (!sess) { res.status(401).json({ error: "Invalid or expired session" }); return; }
  res.json({ user: userPublic(sess.user), blockHeight: currentBlock() });
});

// ── GET /chat/users/search?q= ─── search by wallet address or display name ──
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
    walletAddress: appUsersTable.walletAddress,
    publicKey: appUsersTable.publicKey,
    chatId: appUsersTable.chatId,
  }).from(appUsersTable)
    .where(
      or(
        ilike(appUsersTable.walletAddress, `%${q}%`),
        ilike(appUsersTable.displayName, `%${q}%`),
        ilike(appUsersTable.chatId, `%${q}%`),
      )
    )
    .limit(20);

  res.json({ users: rows.filter(u => u.id !== sess.user.id) });
});

// ── GET /chat/users/by-address/:address ─── exact wallet address lookup ──────
router.get("/chat/users/by-address/:address", async (req, res): Promise<void> => {
  const tok = authToken(req);
  if (!tok) { res.status(401).json({ error: "Unauthorized" }); return; }
  const sess = await getSessionUser(tok);
  if (!sess) { res.status(401).json({ error: "Invalid or expired session" }); return; }

  const addr = req.params.address;
  const [user] = await db.select({
    id: appUsersTable.id,
    displayName: appUsersTable.displayName,
    walletAddress: appUsersTable.walletAddress,
    publicKey: appUsersTable.publicKey,
  }).from(appUsersTable)
    .where(eq(appUsersTable.walletAddress, addr))
    .limit(1);

  if (!user) { res.status(404).json({ error: "Address not found on ZBX Chain" }); return; }
  res.json({ user });
});

// ── POST /chat/conversations ─── open or get DM channel ──────────────────────
router.post("/chat/conversations", async (req, res): Promise<void> => {
  const tok = authToken(req);
  if (!tok) { res.status(401).json({ error: "Unauthorized" }); return; }
  const sess = await getSessionUser(tok);
  if (!sess) { res.status(401).json({ error: "Invalid or expired session" }); return; }

  const { recipientId } = req.body ?? {};
  if (!recipientId || typeof recipientId !== "number") {
    res.status(400).json({ error: "recipientId is required" }); return;
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

  if (existing.length > 0) { res.json({ conversation: existing[0] }); return; }

  const chainId = "zbx-dm-" + createHash("sha256")
    .update(`${p1}:${p2}:${Date.now()}`)
    .digest("hex")
    .slice(0, 32);

  const [conv] = await db.insert(conversationsTable).values({
    participant1Id: p1,
    participant2Id: p2,
    chainId,
  }).returning();

  res.status(201).json({ conversation: conv });
});

// ── GET /chat/conversations ─── list my conversations with chain metadata ─────
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
      walletAddress: appUsersTable.walletAddress,
      publicKey: appUsersTable.publicKey,
    }).from(appUsersTable).where(eq(appUsersTable.id, otherId)).limit(1);

    const [lastMsg] = await db.select().from(messagesTable)
      .where(eq(messagesTable.conversationId, conv.id))
      .orderBy(desc(messagesTable.createdAt))
      .limit(1);

    const msgCount = await db.select({ count: sql<number>`count(*)::int` })
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conv.id));

    return {
      ...conv,
      other,
      lastMessage: lastMsg ?? null,
      messageCount: msgCount[0]?.count ?? 0,
    };
  }));

  res.json({ conversations: result, blockHeight: currentBlock() });
});

// ── GET /chat/conversations/:id/messages ─── paginated on-chain messages ──────
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
    walletAddress: appUsersTable.walletAddress,
    publicKey: appUsersTable.publicKey,
  }).from(appUsersTable).where(eq(appUsersTable.id, otherId)).limit(1);

  const limit  = Math.min(parseInt((req.query.limit as string) ?? "50", 10), 100);
  const before = req.query.before ? new Date(req.query.before as string) : new Date();

  const msgs = await db.select().from(messagesTable)
    .where(and(eq(messagesTable.conversationId, convId), gt(before, messagesTable.createdAt)))
    .orderBy(desc(messagesTable.createdAt))
    .limit(limit);

  res.json({
    messages: msgs.reverse(),
    other,
    conversationId: convId,
    chainId: conv.chainId,
    blockHeight: currentBlock(),
  });
});

// ── POST /chat/conversations/:id/messages ─── broadcast encrypted message ─────
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

  const txHash      = genTxHash(convId, me, nonce);
  const blockHeight = currentBlock();

  const [msg] = await db.insert(messagesTable).values({
    conversationId: convId,
    senderId: me,
    encryptedContent,
    nonce,
    txHash,
    blockHeight,
    chainConfirmed: true,
  }).returning();

  await db.update(conversationsTable)
    .set({ lastMessageAt: new Date() })
    .where(eq(conversationsTable.id, convId));

  res.status(201).json({ message: msg, txHash, blockHeight });
});

export default router;
