import { Router } from "express";
import { db } from "@workspace/db";
import {
  validatorsTable, tokensTable, aiModelsTable, adminUsersTable, systemSettingsTable,
} from "@workspace/db";
import { eq, count, sql, ilike } from "drizzle-orm";
import {
  AdminListValidatorsQueryParams,
  AdminCreateValidatorBody,
  AdminUpdateValidatorParams,
  AdminUpdateValidatorBody,
  AdminDeleteValidatorParams,
  AdminListTokensQueryParams,
  AdminCreateTokenBody,
  AdminUpdateTokenParams,
  AdminUpdateTokenBody,
  AdminDeleteTokenParams,
  AdminListAiModelsQueryParams,
  AdminCreateAiModelBody,
  AdminUpdateAiModelParams,
  AdminUpdateAiModelBody,
  AdminDeleteAiModelParams,
  AdminListUsersQueryParams,
  AdminCreateUserBody,
  AdminUpdateUserParams,
  AdminUpdateUserBody,
  AdminDeleteUserParams,
  AdminUpdateSettingParams,
  AdminUpdateSettingBody,
} from "@workspace/api-zod";

const router = Router();

// ── STATS ────────────────────────────────────────────────────────────────────

router.get("/admin/stats", async (req, res) => {
  try {
    const [valCounts] = await db
      .select({
        total: count(),
        active: sql<number>`SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END)::int`,
        jailed: sql<number>`SUM(CASE WHEN status = 'jailed' THEN 1 ELSE 0 END)::int`,
        totalStaked: sql<string>`COALESCE(SUM(total_staked::numeric), 0)::text`,
        uptimeAvg: sql<number>`ROUND(AVG(uptime::numeric)::numeric, 3)`,
      })
      .from(validatorsTable);

    const [[{ tokenCount }], [{ modelCount }], [{ userCount }]] = await Promise.all([
      db.select({ tokenCount: count() }).from(tokensTable),
      db.select({ modelCount: count() }).from(aiModelsTable),
      db.select({ userCount: count() }).from(adminUsersTable),
    ]);

    res.json({
      totalValidators: valCounts.total,
      activeValidators: valCounts.active ?? 0,
      jailedValidators: valCounts.jailed ?? 0,
      totalTokens: tokenCount,
      totalAiModels: modelCount,
      totalAdminUsers: userCount,
      totalStaked: valCounts.totalStaked ?? "0",
      networkTps: 847.3,
      latestBlock: 284710,
      uptimeAvg: Number(valCounts.uptimeAvg ?? 99),
    });
    return;
  } catch (err) {
    req.log.error({ err }, "admin stats error");
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

// ── VALIDATORS ───────────────────────────────────────────────────────────────

router.get("/admin/validators", async (req, res) => {
  const parsed = AdminListValidatorsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }
  const { page = 1, limit = 20, status } = parsed.data;
  const offset = (page - 1) * limit;
  try {
    const where = status ? eq(validatorsTable.status, status as "active" | "inactive" | "jailed") : undefined;
    const [validators, [{ total }]] = await Promise.all([
      db.select().from(validatorsTable).where(where).limit(limit).offset(offset).orderBy(validatorsTable.rank),
      db.select({ total: count() }).from(validatorsTable).where(where),
    ]);
    res.json({ validators, total, page, limit });
    return;
  } catch (err) {
    req.log.error({ err }, "admin list validators error");
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

router.post("/admin/validators", async (req, res) => {
  const parsed = AdminCreateValidatorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  try {
    const [created] = await db.insert(validatorsTable).values(parsed.data).returning();
    res.status(201).json(created);
    return;
  } catch (err) {
    req.log.error({ err }, "admin create validator error");
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

router.patch("/admin/validators/:id", async (req, res) => {
  const paramsParsed = AdminUpdateValidatorParams.safeParse(req.params);
  const bodyParsed = AdminUpdateValidatorBody.safeParse(req.body);
  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid params or body" });
    return;
  }
  try {
    const [updated] = await db
      .update(validatorsTable)
      .set(bodyParsed.data)
      .where(eq(validatorsTable.id, paramsParsed.data.id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Validator not found" });
      return;
    }
    res.json(updated);
    return;
  } catch (err) {
    req.log.error({ err }, "admin update validator error");
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

router.delete("/admin/validators/:id", async (req, res) => {
  const parsed = AdminDeleteValidatorParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  try {
    await db.delete(validatorsTable).where(eq(validatorsTable.id, parsed.data.id));
    res.status(204).send();
    return;
  } catch (err) {
    req.log.error({ err }, "admin delete validator error");
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

// ── TOKENS ───────────────────────────────────────────────────────────────────

router.get("/admin/tokens", async (req, res) => {
  const parsed = AdminListTokensQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }
  const { page = 1, limit = 20 } = parsed.data;
  const offset = (page - 1) * limit;
  try {
    const [tokens, [{ total }]] = await Promise.all([
      db.select().from(tokensTable).limit(limit).offset(offset).orderBy(tokensTable.id),
      db.select({ total: count() }).from(tokensTable),
    ]);
    res.json({ tokens, total, page, limit });
    return;
  } catch (err) {
    req.log.error({ err }, "admin list tokens error");
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

router.post("/admin/tokens", async (req, res) => {
  const parsed = AdminCreateTokenBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  try {
    const [created] = await db.insert(tokensTable).values(parsed.data).returning();
    res.status(201).json(created);
    return;
  } catch (err) {
    req.log.error({ err }, "admin create token error");
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

router.patch("/admin/tokens/:id", async (req, res) => {
  const paramsParsed = AdminUpdateTokenParams.safeParse(req.params);
  const bodyParsed = AdminUpdateTokenBody.safeParse(req.body);
  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid params or body" });
    return;
  }
  try {
    const [updated] = await db
      .update(tokensTable)
      .set(bodyParsed.data)
      .where(eq(tokensTable.id, paramsParsed.data.id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Token not found" });
      return;
    }
    res.json(updated);
    return;
  } catch (err) {
    req.log.error({ err }, "admin update token error");
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

router.delete("/admin/tokens/:id", async (req, res) => {
  const parsed = AdminDeleteTokenParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  try {
    await db.delete(tokensTable).where(eq(tokensTable.id, parsed.data.id));
    res.status(204).send();
    return;
  } catch (err) {
    req.log.error({ err }, "admin delete token error");
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

// ── AI MODELS ────────────────────────────────────────────────────────────────

router.get("/admin/ai-models", async (req, res) => {
  const parsed = AdminListAiModelsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }
  const { page = 1, limit = 20 } = parsed.data;
  const offset = (page - 1) * limit;
  try {
    const [models, [{ total }]] = await Promise.all([
      db.select().from(aiModelsTable).limit(limit).offset(offset).orderBy(aiModelsTable.modelIndex),
      db.select({ total: count() }).from(aiModelsTable),
    ]);
    res.json({ models, total, page, limit });
    return;
  } catch (err) {
    req.log.error({ err }, "admin list ai models error");
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

router.post("/admin/ai-models", async (req, res) => {
  const parsed = AdminCreateAiModelBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  try {
    const [created] = await db.insert(aiModelsTable).values(parsed.data).returning();
    res.status(201).json(created);
    return;
  } catch (err) {
    req.log.error({ err }, "admin create ai model error");
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

router.patch("/admin/ai-models/:id", async (req, res) => {
  const paramsParsed = AdminUpdateAiModelParams.safeParse(req.params);
  const bodyParsed = AdminUpdateAiModelBody.safeParse(req.body);
  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid params or body" });
    return;
  }
  try {
    const [updated] = await db
      .update(aiModelsTable)
      .set(bodyParsed.data)
      .where(eq(aiModelsTable.id, paramsParsed.data.id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "AI model not found" });
      return;
    }
    res.json(updated);
    return;
  } catch (err) {
    req.log.error({ err }, "admin update ai model error");
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

router.delete("/admin/ai-models/:id", async (req, res) => {
  const parsed = AdminDeleteAiModelParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  try {
    await db.delete(aiModelsTable).where(eq(aiModelsTable.id, parsed.data.id));
    res.status(204).send();
    return;
  } catch (err) {
    req.log.error({ err }, "admin delete ai model error");
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

// ── ADMIN USERS ───────────────────────────────────────────────────────────────

router.get("/admin/users", async (req, res) => {
  const parsed = AdminListUsersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }
  const { page = 1, limit = 20 } = parsed.data;
  const offset = (page - 1) * limit;
  try {
    const [allUsers, [{ total }]] = await Promise.all([
      db.select({
        id: adminUsersTable.id,
        username: adminUsersTable.username,
        email: adminUsersTable.email,
        role: adminUsersTable.role,
        displayName: adminUsersTable.displayName,
        isActive: adminUsersTable.isActive,
        lastLogin: adminUsersTable.lastLogin,
        createdAt: adminUsersTable.createdAt,
        updatedAt: adminUsersTable.updatedAt,
      }).from(adminUsersTable).limit(limit).offset(offset).orderBy(adminUsersTable.id),
      db.select({ total: count() }).from(adminUsersTable),
    ]);
    res.json({ users: allUsers, total, page, limit });
    return;
  } catch (err) {
    req.log.error({ err }, "admin list users error");
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

router.post("/admin/users", async (req, res) => {
  const parsed = AdminCreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  try {
    const { password, ...rest } = parsed.data;
    const passwordHash = `hashed_${password}`;
    const [created] = await db.insert(adminUsersTable).values({ ...rest, passwordHash }).returning({
      id: adminUsersTable.id,
      username: adminUsersTable.username,
      email: adminUsersTable.email,
      role: adminUsersTable.role,
      displayName: adminUsersTable.displayName,
      isActive: adminUsersTable.isActive,
      lastLogin: adminUsersTable.lastLogin,
      createdAt: adminUsersTable.createdAt,
      updatedAt: adminUsersTable.updatedAt,
    });
    res.status(201).json(created);
    return;
  } catch (err) {
    req.log.error({ err }, "admin create user error");
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

router.patch("/admin/users/:id", async (req, res) => {
  const paramsParsed = AdminUpdateUserParams.safeParse(req.params);
  const bodyParsed = AdminUpdateUserBody.safeParse(req.body);
  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid params or body" });
    return;
  }
  try {
    const [updated] = await db
      .update(adminUsersTable)
      .set(bodyParsed.data)
      .where(eq(adminUsersTable.id, paramsParsed.data.id))
      .returning({
        id: adminUsersTable.id,
        username: adminUsersTable.username,
        email: adminUsersTable.email,
        role: adminUsersTable.role,
        displayName: adminUsersTable.displayName,
        isActive: adminUsersTable.isActive,
        lastLogin: adminUsersTable.lastLogin,
        createdAt: adminUsersTable.createdAt,
        updatedAt: adminUsersTable.updatedAt,
      });
    if (!updated) {
      res.status(404).json({ error: "Admin user not found" });
      return;
    }
    res.json(updated);
    return;
  } catch (err) {
    req.log.error({ err }, "admin update user error");
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

router.delete("/admin/users/:id", async (req, res) => {
  const parsed = AdminDeleteUserParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  try {
    await db.delete(adminUsersTable).where(eq(adminUsersTable.id, parsed.data.id));
    res.status(204).send();
    return;
  } catch (err) {
    req.log.error({ err }, "admin delete user error");
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

// ── SYSTEM SETTINGS ───────────────────────────────────────────────────────────

router.get("/admin/settings", async (req, res) => {
  try {
    const settings = await db.select().from(systemSettingsTable).orderBy(systemSettingsTable.category, systemSettingsTable.key);
    res.json(settings);
    return;
  } catch (err) {
    req.log.error({ err }, "admin list settings error");
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

router.patch("/admin/settings/:key", async (req, res) => {
  const paramsParsed = AdminUpdateSettingParams.safeParse(req.params);
  const bodyParsed = AdminUpdateSettingBody.safeParse(req.body);
  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid params or body" });
    return;
  }
  try {
    const [updated] = await db
      .update(systemSettingsTable)
      .set({ value: bodyParsed.data.value })
      .where(eq(systemSettingsTable.key, paramsParsed.data.key))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Setting not found" });
      return;
    }
    res.json(updated);
    return;
  } catch (err) {
    req.log.error({ err }, "admin update setting error");
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

export default router;
