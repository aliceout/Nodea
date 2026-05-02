import { Hono } from 'hono';
import { and, count, eq } from 'drizzle-orm';
import {
  ChangeEmailBodySchema,
  ChangeUsernameBodySchema,
  DeleteSelfBodySchema,
  type AuthMeCryptoResponse,
  type AuthMeResponse,
} from '@nodea/shared';

import { clearSessionCookie } from '../auth/cookies.ts';
import { db } from '../db/client.ts';
import {
  authFactors,
  mfaTotp,
  mfaTotpRecoveryCodes,
  users,
} from '../db/schema.ts';
import { requireFreshPassword } from '../middleware/require-fresh-reauth.ts';
import { rateLimit } from '../middleware/rate-limit.ts';
import { requireUser, type AuthVariables } from '../middleware/require-user.ts';

import { isUniqueViolation } from './auth-shared.ts';

export const authAccountRoutes = new Hono<{ Variables: AuthVariables }>();

/**
 * Rate limit on email change : one change per IP per 24 h. Closes
 * a hijack scenario where a stolen session cookie would otherwise
 * let an attacker swap the account email silently and then trigger
 * `/request-reset` on their own address to lock the legitimate
 * user out. The 24 h window is wide enough that an honest user
 * who mistypes never hits it twice in the same day ; narrow enough
 * that a real attack triggers the limiter on the first try.
 */
const changeEmailLimiter = rateLimit({
  max: 1,
  windowMs: 24 * 60 * 60 * 1000,
  keyPrefix: 'rl:change-email',
});

/**
 * Authenticated user introspection. Surfaces identity + role +
 * MFA flags so the front can drive the sidebar tip + Settings
 * + ProtectedRoute without a separate round-trip per concern.
 *
 * **What's NOT here** : the OPAQUE wrap blobs
 * (`wrappedMainKey`, `wrappedKekPassword`, …). API-14 split
 * them off to [`GET /auth/me/crypto`](#me-crypto) — this
 * endpoint is hit on every page load (sidebar, header,
 * ProtectedRoute) and shipping ~2 KB of crypto blobs that 95 %
 * of callers never touch is wasteful. The client fetches the
 * crypto endpoint only at unwrap moments (change-password,
 * recovery-code setup, passkey enroll).
 *
 * Phase 4 added the passkey counts so the sidebar tip +
 * Settings can branch on enrollment state without a separate
 * round-trip. Two `SELECT count` queries (total +
 * PRF-capable) rather than one with a CASE sum — keeps each
 * query trivially analysable, and a user has at most a
 * handful of passkeys so the second pass is free.
 *
 * Phase 5 added TOTP enabled state + remaining backup codes.
 * `enabled_at` is NOT NULL only after the user passed the
 * verify step (Auth-Spec §8.2) — pending enrollments read as
 * « not enabled » so the UI can resume / restart the flow.
 */
authAccountRoutes.get('/me', requireUser, async (c) => {
  const user = c.get('user');

  const [totalRow] = await db
    .select({ value: count() })
    .from(authFactors)
    .where(eq(authFactors.userId, user.id));
  const [prfRow] = await db
    .select({ value: count() })
    .from(authFactors)
    // PRF-capable passkeys : `kind='passkey'` filter is
    // implicit (the table currently has no other kinds), but
    // the `prf_supported` flag IS the discriminator we care
    // about for §6.1 mode-max.
    .where(
      and(
        eq(authFactors.userId, user.id),
        eq(authFactors.prfSupported, true),
      ),
    );

  const [totpRow] = await db
    .select({ enabledAt: mfaTotp.enabledAt })
    .from(mfaTotp)
    .where(eq(mfaTotp.userId, user.id))
    .limit(1);
  const totpEnabled = totpRow?.enabledAt != null;

  // The user has at most 10 backup codes (Auth-Spec §8.1) so
  // loading all of them and counting unused rows in JS is
  // cheaper + simpler than two `count()` queries with a
  // `usedAt IS NULL` predicate.
  let totpBackupCodesRemaining = 0;
  if (totpEnabled) {
    const rows = await db
      .select({ usedAt: mfaTotpRecoveryCodes.usedAt })
      .from(mfaTotpRecoveryCodes)
      .where(eq(mfaTotpRecoveryCodes.userId, user.id));
    totpBackupCodesRemaining = rows.filter((r) => r.usedAt === null).length;
  }

  const body: AuthMeResponse = {
    id: user.id,
    email: user.email,
    username: user.username ?? null,
    role: user.role,
    onboardingStatus: user.onboardingStatus,
    onboardingVersion: user.onboardingVersion,
    recoveryCodeSet: user.recoveryCodeHash !== null,
    passkeysCount: totalRow?.value ?? 0,
    passkeysPrfCount: prfRow?.value ?? 0,
    totpEnabled,
    totpBackupCodesRemaining,
    securityMode: user.securityMode,
  };
  return c.json(body);
});

/**
 * <a id="me-crypto"></a>
 * `GET /auth/me/crypto` — OPAQUE wrap blobs (API-14 split).
 *
 * Read by the client only at the moments where it actually
 * unwraps the KEK : change-password, recovery-code setup,
 * passkey enrollment. Keeping these blobs out of `/auth/me`
 * saves ~2 KB on every page load (sidebar / header / route
 * guard) where the crypto data is never used.
 *
 * Same auth as `/me` (`requireUser`). The blobs are themselves
 * encrypted (E2E), so their over-exposure is a bandwidth
 * concern, not a security one.
 */
authAccountRoutes.get('/me/crypto', requireUser, async (c) => {
  const user = c.get('user');
  const body: AuthMeCryptoResponse = {
    wrappedMainKey: user.wrappedMainKey ?? null,
    wrappedMainKeyIv: user.wrappedMainKeyIv ?? null,
    wrappedKekPassword: user.wrappedKekPassword ?? null,
    wrappedKekPasswordIv: user.wrappedKekPasswordIv ?? null,
  };
  return c.json(body);
});

/**
 * Change the authenticated user's email — re-auth gated by
 * the `requireFreshPassword` middleware (Phase 7B).
 *
 * The envelope stays untouched : email isn't part of the KEK
 * derivation in V1. Only the `email` column moves. Future
 * Phase 2+ design intends a re-register OPAQUE on email
 * change because the `userIdentifier` baked into the envelope
 * IS the email — that's a separate spec section (§7.6) and
 * not implemented here.
 */
authAccountRoutes.patch('/email', changeEmailLimiter, requireUser, requireFreshPassword, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = ChangeEmailBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const body = parsed.data;
  const user = c.get('user');

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
 * Not password-gated — a username is a free-form display
 * name, not a credential (see `ChangeUsernameBodySchema`
 * comment). Duplicates are allowed : two users named « Alice »
 * don't conflict because the actual identifier is `users.id`
 * (and `email` for login). Pass `null` to clear the current
 * value.
 */
authAccountRoutes.patch('/username', requireUser, async (c) => {
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
 * Idempotent : calling it on a user that's already `complete`
 * returns `ok: true` without touching the row. Flipping the
 * flag is the only side-effect — actual onboarding choices
 * (modules, preferences) are persisted through their own
 * encrypted endpoints.
 */
authAccountRoutes.post('/onboarding/complete', requireUser, async (c) => {
  const user = c.get('user');
  if (user.onboardingStatus === 'complete') return c.json({ ok: true });

  await db
    .update(users)
    .set({ onboardingStatus: 'complete', updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return c.json({ ok: true });
});

/**
 * Self-delete the authenticated user — re-auth gated by the
 * `requireFreshPassword` middleware (Phase 7B).
 *
 * Every row owned by this user is removed by the FK
 * `ON DELETE CASCADE` chain : sessions, modules_config,
 * opaque_records, and every *_entries. Invites the user
 * created keep their row with `created_by` set to NULL.
 *
 * After the delete the session row is gone ; the cookie is
 * also explicitly cleared in the response so the browser
 * forgets it.
 */
authAccountRoutes.delete('/me', requireUser, requireFreshPassword, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = DeleteSelfBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const user = c.get('user');

  await db.delete(users).where(eq(users.id, user.id));
  clearSessionCookie(c);
  return c.json({ ok: true });
});
