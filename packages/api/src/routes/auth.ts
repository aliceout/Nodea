import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import {
  RegisterBodySchema,
  LoginBodySchema,
  ChangePasswordBodySchema,
  ChangeEmailBodySchema,
  ChangeUsernameBodySchema,
  DeleteSelfBodySchema,
  RequestResetBodySchema,
  ResetPasswordBodySchema,
  type AuthMeResponse,
} from '@nodea/shared/schemas/auth';
import { db } from '../db/client.ts';
import {
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

authRoutes.post('/login', loginLimiter, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = LoginBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const body = parsed.data;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, body.email.toLowerCase()))
    .limit(1);

  // Always verify *something* to keep timing constant between
  // "unknown email" and "wrong password".
  const passwordOk = await verifyPassword(
    user?.passwordHash ?? '$argon2id$v=19$m=19456,t=2,p=1$aaaaaaaaaaaaaaaa$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    body.password,
  );
  if (!user || !passwordOk) {
    return c.json({ error: 'invalid_credentials' }, 401);
  }

  // Activation gate (Auth-Roadmap Phase 1 simplified): accounts
  // created via the new register flow are inactive until the user
  // clicks the magic link in their activation email. Refuse login
  // until then with a distinct status code so the UI can surface a
  // helpful "active d'abord" message instead of a generic
  // "wrong password". Legacy users (and admin seeds) have
  // `email_verified_at` set at creation, so they bypass this gate.
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
  // `encryptionSalt` / `encryptedKey` are NULL for OPAQUE-registered
  // accounts (Phase 2B onwards). The client picks the unwrap path
  // based on which side is filled — legacy Argon2id when the salt is
  // present, OPAQUE when not.
  const body: AuthMeResponse = {
    id: user.id,
    email: user.email,
    username: user.username ?? null,
    role: user.role,
    onboardingStatus: user.onboardingStatus,
    onboardingVersion: user.onboardingVersion,
    encryptionSalt: user.encryptionSalt ?? null,
    encryptedKey: user.encryptedKey ?? null,
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
 * Not password-gated — a username is a public identifier, not a
 * credential (see `ChangeUsernameBodySchema` comment). Pass `null` to
 * clear the current value. The partial unique index rejects collisions
 * and we surface those as 409.
 */
authRoutes.patch('/username', requireUser, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = ChangeUsernameBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const user = c.get('user');
  const newUsername = parsed.data.username;

  if ((user.username ?? null) === newUsername) return c.json({ ok: true });

  try {
    await db
      .update(users)
      .set({ username: newUsername, updatedAt: new Date() })
      .where(eq(users.id, user.id));
  } catch (err) {
    if (isUniqueViolation(err, 'users_username_unique')) {
      return c.json({ error: 'username_taken' }, 409);
    }
    throw err;
  }

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
