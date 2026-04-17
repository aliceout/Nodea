import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import {
  RegisterBodySchema,
  LoginBodySchema,
  ChangePasswordBodySchema,
  ChangeEmailBodySchema,
  DeleteSelfBodySchema,
  type AuthMeResponse,
} from '@nodea/shared/schemas/auth';
import { db } from '../db/client.ts';
import { users } from '../db/schema.ts';
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
import { requireUser, type AuthVariables } from '../middleware/require-user.ts';
import { rateLimit } from '../middleware/rate-limit.ts';

export const authRoutes = new Hono<{ Variables: AuthVariables }>();

const registerLimiter = rateLimit({ max: 5, windowMs: 60_000, keyPrefix: 'register' });
const loginLimiter = rateLimit({ max: 10, windowMs: 60_000, keyPrefix: 'login' });

authRoutes.post('/register', registerLimiter, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = RegisterBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const body = parsed.data;

  const policy = checkPasswordPolicy(body.password, [body.email]);
  if (!policy.ok) return c.json({ error: 'weak_password', reason: policy.reason }, 400);

  const passwordHash = await hashPassword(body.password);

  const outcome = await consumeInviteAndCreateUser(body.inviteCode, async (tx) => {
    const userId = randomUUID();
    try {
      await tx.insert(users).values({
        id: userId,
        email: body.email.toLowerCase(),
        passwordHash,
        encryptionSalt: body.encryptionSalt,
        encryptedKey: body.encryptedKey,
      });
    } catch (err) {
      // Unique constraint on email → rethrow as a tagged error so the outer
      // layer can distinguish it from generic failures.
      if (err instanceof Error && err.message.includes('users_email_unique')) {
        throw new EmailTakenError();
      }
      throw err;
    }
    return { userId, result: userId };
  }).catch((err) => {
    if (err instanceof EmailTakenError) return { ok: false as const, reason: 'email_taken' as const };
    throw err;
  });

  if (!outcome.ok) {
    return c.json({ error: 'register_failed', reason: outcome.reason }, 400);
  }

  const userId = outcome.result;
  const session = await createSession(userId);
  await setSessionCookie(c, session.id, session.expiresAt);

  return c.json({ id: userId }, 201);
});

class EmailTakenError extends Error {}

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

authRoutes.get('/me', requireUser, (c) => {
  const user = c.get('user');
  const body: AuthMeResponse = {
    id: user.id,
    email: user.email,
    role: user.role,
    onboardingStatus: user.onboardingStatus,
    onboardingVersion: user.onboardingVersion,
    encryptionSalt: user.encryptionSalt,
    encryptedKey: user.encryptedKey,
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
    if (err instanceof Error && err.message.includes('users_email_unique')) {
      return c.json({ error: 'email_taken' }, 409);
    }
    throw err;
  }

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
