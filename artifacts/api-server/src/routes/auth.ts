import { Router, type IRouter } from "express";
import { randomBytes, pbkdf2Sync } from "crypto";
import { db } from "@workspace/db";
import {
  appUsersTable, userSessionsTable, userInvitesTable, featureFlagsTable,
  systemSettingsTable,
} from "@workspace/db";
import { eq, and, gt, sql } from "drizzle-orm";

const router: IRouter = Router();

function hashPassword(password: string, salt: string): string {
  return pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
}
function genSalt() { return randomBytes(16).toString("hex"); }
function genToken() { return randomBytes(32).toString("hex"); }
function genVerificationToken() { return randomBytes(16).toString("hex"); }

function storePasswordHash(password: string): string {
  const salt = genSalt();
  const hash = hashPassword(password, salt);
  return `${salt}:${hash}`;
}
function verifyPasswordHash(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  return hashPassword(password, salt) === hash;
}

async function getSetting(key: string): Promise<string | null> {
  const [row] = await db.select().from(systemSettingsTable)
    .where(eq(systemSettingsTable.key, key)).limit(1);
  return row?.value ?? null;
}

async function getSessionUser(token: string) {
  const now = new Date();
  const [session] = await db.select({
    session: userSessionsTable,
    user: appUsersTable,
  }).from(userSessionsTable)
    .innerJoin(appUsersTable, eq(userSessionsTable.userId, appUsersTable.id))
    .where(and(eq(userSessionsTable.token, token), gt(userSessionsTable.expiresAt, now)))
    .limit(1);
  return session ?? null;
}

// ── POST /auth/signup ────────────────────────────────────────────────────────
router.post("/auth/signup", async (req, res): Promise<void> => {
  const { email, password, displayName, inviteCode } = req.body ?? {};

  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" }); return;
  }
  if (typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" }); return;
  }

  const emailVerificationRequired = (await getSetting("email_verification_required")) === "true";
  const inviteOnly = (await getSetting("invite_only")) === "true";
  const signupEnabled = (await getSetting("signup_enabled")) !== "false";

  if (!signupEnabled) {
    res.status(403).json({ error: "New registrations are currently closed" }); return;
  }

  if (inviteOnly) {
    if (!inviteCode) {
      res.status(403).json({ error: "An invite code is required to register" }); return;
    }
    const [invite] = await db.select().from(userInvitesTable)
      .where(and(eq(userInvitesTable.code, inviteCode), eq(userInvitesTable.isUsed, false)))
      .limit(1);
    if (!invite) {
      res.status(403).json({ error: "Invalid or already-used invite code" }); return;
    }
    const now = new Date();
    if (invite.expiresAt && invite.expiresAt < now) {
      res.status(403).json({ error: "Invite code has expired" }); return;
    }
    if (invite.email && invite.email.toLowerCase() !== email.toLowerCase()) {
      res.status(403).json({ error: "This invite code is for a different email address" }); return;
    }
  }

  const [existing] = await db.select({ id: appUsersTable.id })
    .from(appUsersTable).where(eq(appUsersTable.email, email.toLowerCase())).limit(1);
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" }); return;
  }

  const verificationToken = emailVerificationRequired ? genVerificationToken() : null;
  const [user] = await db.insert(appUsersTable).values({
    email:                  email.toLowerCase(),
    passwordHash:           storePasswordHash(password),
    displayName:            displayName ?? null,
    isEmailVerified:        !emailVerificationRequired,
    emailVerificationToken: verificationToken,
    inviteCodeUsed:         inviteCode ?? null,
  }).returning();

  if (inviteCode) {
    await db.update(userInvitesTable)
      .set({ isUsed: true, usedByUserId: user.id })
      .where(eq(userInvitesTable.code, inviteCode));
  }

  if (emailVerificationRequired) {
    req.log.info({ email: user.email, token: verificationToken }, "Email verification required");
    res.status(201).json({
      success: true,
      requiresVerification: true,
      message: "Account created. Please verify your email before logging in.",
      debugVerificationToken: process.env.NODE_ENV === "development" ? verificationToken : undefined,
    });
    return;
  }

  const token = genToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(userSessionsTable).values({ userId: user.id, token, expiresAt });
  await db.update(appUsersTable).set({ lastLoginAt: new Date() }).where(eq(appUsersTable.id, user.id));

  res.status(201).json({
    success: true,
    token,
    user: { id: user.id, email: user.email, displayName: user.displayName, isEmailVerified: user.isEmailVerified },
  });
});

// ── POST /auth/login ─────────────────────────────────────────────────────────
router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" }); return;
  }

  const [user] = await db.select().from(appUsersTable)
    .where(eq(appUsersTable.email, email.toLowerCase())).limit(1);

  if (!user || !verifyPasswordHash(password, user.passwordHash)) {
    res.status(401).json({ error: "Invalid email or password" }); return;
  }
  if (!user.isActive) {
    res.status(403).json({ error: "Your account has been deactivated. Contact support." }); return;
  }

  const emailVerificationRequired = (await getSetting("email_verification_required")) === "true";
  if (emailVerificationRequired && !user.isEmailVerified) {
    res.status(403).json({ error: "Please verify your email before logging in.", requiresVerification: true }); return;
  }

  const token = genToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(userSessionsTable).values({ userId: user.id, token, expiresAt });
  await db.update(appUsersTable).set({ lastLoginAt: new Date() }).where(eq(appUsersTable.id, user.id));

  res.json({
    success: true, token,
    user: { id: user.id, email: user.email, displayName: user.displayName, isEmailVerified: user.isEmailVerified },
  });
});

// ── GET /auth/me ─────────────────────────────────────────────────────────────
router.get("/auth/me", async (req, res): Promise<void> => {
  const token = (req.headers.authorization ?? "").replace("Bearer ", "").trim();
  if (!token) { res.status(401).json({ error: "No token provided" }); return; }

  const session = await getSessionUser(token);
  if (!session) { res.status(401).json({ error: "Invalid or expired session" }); return; }

  res.json({
    user: {
      id: session.user.id, email: session.user.email,
      displayName: session.user.displayName,
      isEmailVerified: session.user.isEmailVerified,
      isActive: session.user.isActive,
      createdAt: session.user.createdAt instanceof Date ? session.user.createdAt.toISOString() : session.user.createdAt,
    },
  });
});

// ── POST /auth/logout ────────────────────────────────────────────────────────
router.post("/auth/logout", async (req, res): Promise<void> => {
  const token = (req.headers.authorization ?? "").replace("Bearer ", "").trim();
  if (token) {
    await db.delete(userSessionsTable).where(eq(userSessionsTable.token, token));
  }
  res.json({ success: true });
});

// ── POST /auth/verify-email ──────────────────────────────────────────────────
router.post("/auth/verify-email", async (req, res): Promise<void> => {
  const { token } = req.body ?? {};
  if (!token) { res.status(400).json({ error: "Verification token is required" }); return; }

  const [user] = await db.select().from(appUsersTable)
    .where(eq(appUsersTable.emailVerificationToken, token)).limit(1);
  if (!user) { res.status(400).json({ error: "Invalid or already-used verification token" }); return; }

  await db.update(appUsersTable)
    .set({ isEmailVerified: true, emailVerificationToken: null })
    .where(eq(appUsersTable.id, user.id));

  res.json({ success: true, message: "Email verified successfully. You can now log in." });
});

// ── GET /features (public feature flags) ────────────────────────────────────
router.get("/features", async (_req, res): Promise<void> => {
  const flags = await db.select().from(featureFlagsTable)
    .where(eq(featureFlagsTable.isPublic, true));
  const result: Record<string, boolean> = {};
  for (const f of flags) result[f.key] = f.isEnabled;
  res.json(result);
});

export default router;
export { getSessionUser };
