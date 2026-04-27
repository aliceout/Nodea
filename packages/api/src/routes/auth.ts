import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import {
  RegisterBodySchema,
  ChangePasswordBodySchema,
  ChangeEmailBodySchema,
  ChangeUsernameBodySchema,
  DeleteSelfBodySchema,
  RequestResetBodySchema,
  ResetPasswordBodySchema,
  OpaqueLoginStartBodySchema,
  OpaqueLoginFinishBodySchema,
  type AuthMeResponse,
  type OpaqueLoginStartResponse,
} from '@nodea/shared';
import { db } from '../db/client.ts';
import {
  opaqueRecords,
  users,
  passwordResetTokens,
  modulesConfig,
  userPreferences,
  moodEntries,
  goalsEntries,
  passageEntries,
  habitsItemsEntries,
  habitsLogsEntries,
  libraryItemsEntries,
  libraryReviewsEntries,
  reviewEntries,
} from '../db/schema.ts';
import { hashPassword, verifyPassword } from '../auth/password.ts';
import { checkPasswordPolicy } from '../auth/password-policy.ts';
import { consumeInviteAndCreateUser } from '../auth/invites.ts';
import {
  finishLogin as opaqueFinishLogin,
  opaqueReady,
  startLogin as opaqueStartLogin,
} from '../auth/opaque.ts';
import {
  consumeLoginState,
  storeLoginState,
} from '../auth/opaque-login-state.ts';
import {
  createSession,
  revokeSession,
  revokeAllUserSessions,
} from '../auth/session.ts';
import {
  clearSessionCookie,
  setSessionCookie,
} from '../auth/cookies.ts';
import { createResetToken, findActiveResetToken } from '../auth/reset-tokens.ts';
import { sendMail } from '../auth/mailer.ts';
import { renderPasswordResetEmail } from '../services/email/templates/password-reset.ts';
import { getConfig } from '../config.ts';
import { requireUser, type AuthVariables } from '../middleware/require-user.ts';
import { rateLimit } from '../middleware/rate-limit.ts';

export const authRoutes = new Hono<{ Variables: AuthVariables }>();

/**
 * Match a Postgres unique-constraint violation by SQLSTATE + constraint
 * name. We used to string-match on `err.message`, but drizzle-orm 0.45
 * no longer inlines the constraint name there; postgres.js always
 * surfaces `code` (SQLSTATE `23505` = unique_violation) and
 * `constraint_name` on the underlying error object.
 */
function isUniqueViolation(err: unknown, constraint: string): boolean {
  // drizzle-orm 0.45+ wraps the underlying driver error in a
  // `DrizzleQueryError` that exposes the real postgres.js error on
  // `.cause`. Walk the chain so this helper keeps working regardless of
  // which ORM layer caught the throw.
  let e: unknown = err;
  while (typeof e === 'object' && e !== null) {
    const rec = e as { code?: unknown; constraint_name?: unknown; cause?: unknown };
    if (rec.code === '23505' && rec.constraint_name === constraint) return true;
    if (rec.cause && rec.cause !== e) {
      e = rec.cause;
      continue;
    }
    return false;
  }
  return false;
}

const registerLimiter = rateLimit({ max: 5, windowMs: 60_000, keyPrefix: 'register' });
const loginLimiter = rateLimit({ max: 10, windowMs: 60_000, keyPrefix: 'login' });
/** 5 requests per hour per IP — matches the issue (#22) requirement. */
const requestResetLimiter = rateLimit({
  max: 5,
  windowMs: 60 * 60_000,
  keyPrefix: 'request-reset',
});
/** Mild cap on reset consumption to slow any brute-force of stolen tokens. */
const resetLimiter = rateLimit({ max: 10, windowMs: 60_000, keyPrefix: 'reset' });

// The legacy single-shot `POST /auth/register` was removed when the
// invite model switched to email-bound tokens. Registrations now go
// through `routes/auth-register-v2.ts` which is mounted at the same
// path AND owns the bare `/auth/register` route. Admin tooling /
// seed scripts insert directly into the `users` table without going
// through HTTP — see `seedAdmin` in `test/helpers.ts` and the
// equivalent in `seed.ts`.

/**
 * OPAQUE login — step 1 (Auth-Roadmap Phase 2C).
 *
 * Public, rate-limited. Anti-enumeration is built into OPAQUE
 * itself: when the email doesn't match a record, we pass
 * `registrationRecord = null` to `server.startLogin` and the lib
 * produces a syntactically valid but cryptographically dead
 * response that fails at the client's `finishLogin` step. The
 * server response shape and timing are identical between known
 * and unknown identifiers — no dummy-hash trick needed.
 *
 * Server state for the protocol's second round-trip lives in an
 * in-memory map (`opaque-login-state.ts`) keyed by `loginToken`.
 * Single-use, 5-minute TTL.
 */
authRoutes.post('/login/start', loginLimiter, async (c) => {
  await opaqueReady;

  const raw = await c.req.json().catch(() => null);
  const parsed = OpaqueLoginStartBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const body = parsed.data;
  const userIdentifier = body.email.toLowerCase();

  // Load the registration record — null when the email is unknown.
  // The OPAQUE lib handles the null case opaquely (anti-enum).
  const [record] = await db
    .select({ envelope: opaqueRecords.envelope })
    .from(opaqueRecords)
    .innerJoin(users, eq(opaqueRecords.userId, users.id))
    .where(eq(users.email, userIdentifier))
    .limit(1);

  let serverLoginState: string;
  let loginResponse: string;
  try {
    const result = opaqueStartLogin({
      userIdentifier,
      registrationRecord: record?.envelope ?? null,
      startLoginRequest: body.startLoginRequest,
    });
    serverLoginState = result.serverLoginState;
    loginResponse = result.loginResponse;
  } catch {
    // Malformed `startLoginRequest` (truncated base64, bad point).
    // Same shape as the success path so a probing attacker can't
    // tell it apart from "unknown identifier" without trying the
    // full handshake.
    return c.json({ error: 'invalid_body' }, 400);
  }

  const loginToken = storeLoginState(serverLoginState, userIdentifier);

  const response: OpaqueLoginStartResponse = { loginResponse, loginToken };
  return c.json(response);
});

/**
 * OPAQUE login — step 2 (Auth-Roadmap Phase 2C).
 *
 * The client sends back its `finishLoginRequest`, computed from
 * the `loginResponse` it got at /start. The server verifies the
 * proof, looks up the user (via the identifier captured at /start
 * — the client can't swap identities mid-protocol), runs the
 * activation gate, then emits a session cookie. No further auth
 * factors in V1; Phase 4/5 will branch into `mfa_pending` here.
 *
 * Failure modes all return `invalid_credentials` 401 with no
 * client-visible distinction between unknown user, wrong password,
 * expired token, and tampered finishLoginRequest — anti-enum.
 */
authRoutes.post('/login/finish', loginLimiter, async (c) => {
  await opaqueReady;

  const raw = await c.req.json().catch(() => null);
  const parsed = OpaqueLoginFinishBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const body = parsed.data;

  const pending = consumeLoginState(body.loginToken);
  if (!pending) return c.json({ error: 'invalid_credentials' }, 401);

  try {
    opaqueFinishLogin({
      serverLoginState: pending.state,
      finishLoginRequest: body.finishLoginRequest,
    });
  } catch {
    return c.json({ error: 'invalid_credentials' }, 401);
  }

  // Look up the user we agreed on at /start. The userIdentifier was
  // baked into `serverLoginState`, so by the time finishLogin
  // succeeded we know the password matched THIS row — no risk of
  // identifier confusion. If the row vanished between /start and
  // /finish (manual delete, race with /admin), bail with the same
  // generic 401.
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, pending.userIdentifier))
    .limit(1);
  if (!user) return c.json({ error: 'invalid_credentials' }, 401);

  // Activation gate (Auth-Roadmap Phase 1 simplified): accounts
  // created via the new register flow are inactive until the user
  // clicks the magic link in their activation email.
  if (user.emailVerifiedAt === null) {
    return c.json({ error: 'account_not_activated' }, 403);
  }

  const session = await createSession(user.id);
  await setSessionCookie(c, session.id, session.expiresAt);
  return c.json({ id: user.id });
});

authRoutes.post('/logout', requireUser, async (c) => {
  const sessionId = c.get('sessionId');
  await revokeSession(sessionId);
  clearSessionCookie(c);
  return c.json({ ok: true });
});

/**
 * Start a password-reset flow.
 *
 * Always responds 200 regardless of whether the email matches a user.
 * The response shape leaks nothing; the only side-channel would be
 * timing, which `verifyPassword` / mailer work mask poorly but
 * `hashPassword` during register already accepts. Rate limited to
 * 5 requests per IP per hour to blunt enumeration attempts.
 */
authRoutes.post('/request-reset', requestResetLimiter, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = RequestResetBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const email = parsed.data.email.toLowerCase();

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (user) {
    const { token } = await createResetToken(user.id);
    const base = getConfig().WEB_BASE_URL ?? '';
    const link = base
      ? `${base.replace(/\/$/, '')}/reset?token=${encodeURIComponent(token)}`
      : `/reset?token=${encodeURIComponent(token)}`;
    const rendered = renderPasswordResetEmail({ link });
    try {
      await sendMail({
        to: email,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
      });
    } catch (err) {
      console.error('[auth] reset-password mailer failed', err);
      // Never surface the failure to the caller — still 200 so an
      // attacker can't distinguish "email exists but SMTP is down"
      // from the happy path.
    }
  }

  return c.json({ ok: true });
});

/**
 * Consume a reset token.
 *
 * The client has already generated a fresh main key locally. We:
 *   1. Look up the token (hashed) and check it's active.
 *   2. In a transaction, PURGE every user-owned encrypted row
 *      (entries + modules_config + user_preferences). The old
 *      ciphertexts are unreadable without the lost main key —
 *      keeping them around would be data garbage at best, and a
 *      subtle attack surface at worst.
 *   3. Rotate password hash + encryption envelope.
 *   4. Mark the token used.
 *   5. Revoke every existing session.
 *
 * Wrong / expired / already-used token → 400 (`invalid_token`). Weak
 * new password → 400 (`weak_password`).
 */
authRoutes.post('/reset', resetLimiter, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = ResetPasswordBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const body = parsed.data;

  const tokenRow = await findActiveResetToken(body.token);
  if (!tokenRow) return c.json({ error: 'invalid_token' }, 400);

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, tokenRow.userId))
    .limit(1);
  if (!user) return c.json({ error: 'invalid_token' }, 400);

  const policy = checkPasswordPolicy(body.newPassword, [user.email]);
  if (!policy.ok) return c.json({ error: 'weak_password', reason: policy.reason }, 400);

  const newHash = await hashPassword(body.newPassword);

  await db.transaction(async (tx) => {
    // Purge every user-owned encrypted row. FK cascade would also do
    // this if we deleted the user, but we keep the user row (and its
    // id) so invites they created keep their `created_by` foreign key.
    await tx.delete(moodEntries).where(eq(moodEntries.userId, user.id));
    await tx.delete(goalsEntries).where(eq(goalsEntries.userId, user.id));
    await tx.delete(passageEntries).where(eq(passageEntries.userId, user.id));
    await tx.delete(habitsItemsEntries).where(eq(habitsItemsEntries.userId, user.id));
    await tx.delete(habitsLogsEntries).where(eq(habitsLogsEntries.userId, user.id));
    await tx.delete(libraryItemsEntries).where(eq(libraryItemsEntries.userId, user.id));
    await tx.delete(libraryReviewsEntries).where(eq(libraryReviewsEntries.userId, user.id));
    await tx.delete(reviewEntries).where(eq(reviewEntries.userId, user.id));
    await tx.delete(modulesConfig).where(eq(modulesConfig.userId, user.id));
    await tx.delete(userPreferences).where(eq(userPreferences.userId, user.id));

    await tx
      .update(users)
      .set({
        passwordHash: newHash,
        encryptionSalt: body.encryptionSalt,
        encryptedKey: body.encryptedKey,
        onboardingStatus: 'pending',
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, tokenRow.id));
  });

  await revokeAllUserSessions(user.id);
  return c.json({ ok: true });
});

authRoutes.get('/me', requireUser, (c) => {
  const user = c.get('user');
  // Both credential models surface here: legacy Argon2id
  // (`encryptionSalt` + `encryptedKey`) for accounts created
  // pre-Phase-2B, OPAQUE (`wrappedMainKey{,Iv}` + `wrappedKekPassword
  // {,Iv}`) for accounts created in 2B onwards. The client picks
  // the unwrap path based on which side is filled. Phase 2D drops
  // the legacy columns once the seeded admin is re-enrolled.
  const body: AuthMeResponse = {
    id: user.id,
    email: user.email,
    username: user.username ?? null,
    role: user.role,
    onboardingStatus: user.onboardingStatus,
    onboardingVersion: user.onboardingVersion,
    encryptionSalt: user.encryptionSalt ?? null,
    encryptedKey: user.encryptedKey ?? null,
    wrappedMainKey: user.wrappedMainKey ?? null,
    wrappedMainKeyIv: user.wrappedMainKeyIv ?? null,
    wrappedKekPassword: user.wrappedKekPassword ?? null,
    wrappedKekPasswordIv: user.wrappedKekPasswordIv ?? null,
  };
  return c.json(body);
});

authRoutes.post('/change-password', requireUser, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = ChangePasswordBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const body = parsed.data;
  const user = c.get('user');

  const currentOk = await verifyPassword(user.passwordHash, body.currentPassword);
  if (!currentOk) return c.json({ error: 'invalid_credentials' }, 401);

  const policy = checkPasswordPolicy(body.newPassword, [user.email]);
  if (!policy.ok) return c.json({ error: 'weak_password', reason: policy.reason }, 400);

  const newHash = await hashPassword(body.newPassword);
  await db
    .update(users)
    .set({
      passwordHash: newHash,
      encryptionSalt: body.encryptionSalt,
      encryptedKey: body.encryptedKey,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  // Revoke all other sessions; mint a fresh one so the caller stays signed in.
  await revokeAllUserSessions(user.id);
  const session = await createSession(user.id);
  await setSessionCookie(c, session.id, session.expiresAt);

  return c.json({ ok: true });
});

/**
 * Change the authenticated user's email.
 *
 * Password-gated. The encrypted envelope doesn't change (the email is
 * not part of the KEK derivation), so only the `email` column is
 * updated. The unique index on `email` lets the server reject duplicates
 * via the DB error path.
 */
authRoutes.patch('/email', requireUser, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = ChangeEmailBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const body = parsed.data;
  const user = c.get('user');

  const currentOk = await verifyPassword(user.passwordHash, body.currentPassword);
  if (!currentOk) return c.json({ error: 'invalid_credentials' }, 401);

  const newEmail = body.newEmail.toLowerCase();
  if (newEmail === user.email) return c.json({ ok: true });

  try {
    await db
      .update(users)
      .set({ email: newEmail, updatedAt: new Date() })
      .where(eq(users.id, user.id));
  } catch (err) {
    if (isUniqueViolation(err, 'users_email_unique')) {
      return c.json({ error: 'email_taken' }, 409);
    }
    throw err;
  }

  return c.json({ ok: true });
});

/**
 * Change the authenticated user's public display name.
 *
 * Not password-gated — a username is a free-form display name, not
 * a credential (see `ChangeUsernameBodySchema` comment). Duplicates
 * are allowed: two users named "Alice" don't conflict because the
 * actual identifier is `users.id` (and `email` for login). Pass
 * `null` to clear the current value.
 */
authRoutes.patch('/username', requireUser, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = ChangeUsernameBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const user = c.get('user');
  const newUsername = parsed.data.username;

  if ((user.username ?? null) === newUsername) return c.json({ ok: true });

  await db
    .update(users)
    .set({ username: newUsername, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return c.json({ ok: true });
});

/**
 * Mark the authenticated user's onboarding as complete.
 *
 * Idempotent: calling it on a user that's already `complete` returns
 * `ok: true` without touching the row. Flipping the flag is the only
 * side-effect — actual onboarding choices (modules, preferences) are
 * persisted through their own encrypted endpoints.
 */
authRoutes.post('/onboarding/complete', requireUser, async (c) => {
  const user = c.get('user');
  if (user.onboardingStatus === 'complete') return c.json({ ok: true });

  await db
    .update(users)
    .set({ onboardingStatus: 'complete', updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return c.json({ ok: true });
});

/**
 * Self-delete the authenticated user. Password-gated.
 *
 * Every row owned by this user is removed by the FK ON DELETE CASCADE
 * chain: sessions, modules_config, and every *_entries. Invites the
 * user created keep their row with `created_by` set to NULL.
 *
 * After the delete the session row is gone; the cookie is also
 * explicitly cleared in the response so the browser forgets it.
 */
authRoutes.delete('/me', requireUser, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = DeleteSelfBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const user = c.get('user');

  const currentOk = await verifyPassword(user.passwordHash, parsed.data.currentPassword);
  if (!currentOk) return c.json({ error: 'invalid_credentials' }, 401);

  await db.delete(users).where(eq(users.id, user.id));
  clearSessionCookie(c);
  return c.json({ ok: true });
});
