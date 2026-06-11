import { and, count, eq, ne, sql } from 'drizzle-orm';
import {
  AuthMeCryptoResponseSchema,
  AuthMeResponseSchema,
  ChangeEmailBodySchema,
  ChangeUsernameBodySchema,
  DeleteSelfBodySchema,
  type AuthMeCryptoResponse,
  type AuthMeResponse,
} from '@nodea/shared';

import { clearSessionCookie } from '../auth/cookies.ts';
import { sendMail } from '../auth/mailer.ts';
import { db } from '../db/client.ts';
import {
  authFactors,
  mfaTotp,
  mfaTotpRecoveryCodes,
  opaqueRecords,
  sessions,
  users,
} from '../db/schema.ts';
import { requireFreshPassword } from '../middleware/require-fresh-reauth.ts';
import { rateLimit } from '../middleware/rate-limit.ts';
import { requireUser } from '../middleware/require-user.ts';
import {
  createRoute,
  errorContent,
  jsonContent,
  makeAuthedRouter,
  okContent,
} from '../openapi/index.ts';

import { isUniqueViolation } from './auth-shared.ts';

export const authAccountRoutes = makeAuthedRouter();

/**
 * Rate limit on email change : one change per ACCOUNT per 24 h.
 * Closes a hijack scenario where a stolen session cookie would
 * otherwise let an attacker swap the account email silently and
 * then trigger `/request-reset` on their own address to lock the
 * legitimate user out. The 24 h window is wide enough that an
 * honest user who mistypes never hits it twice in the same day ;
 * narrow enough that a real attack triggers the limiter on the
 * first try.
 *
 * Audit 2026-06 : previously keyed by IP and mounted BEFORE
 * `requireUser` — one anonymous request burned the day's budget
 * for every user behind the same NAT. Now keyed on the
 * authenticated user id and mounted last in the chain, so only a
 * fully re-authenticated call consumes the quota.
 */
const changeEmailLimiter = rateLimit({
  max: 1,
  windowMs: 24 * 60 * 60 * 1000,
  keyPrefix: 'rl:change-email',
  keyFn: (c) => {
    const user = c.get('user') as { id?: string } | undefined;
    return user?.id ?? null;
  },
});

/**
 * Cooldown between two successful email changes (Auth-Spec §13). The
 * 24 h limiter above is an anti-hammer rate-limit ; this is the
 * business rule : after moving your email you can't move it again for
 * 7 days. Enforced from `users.email_changed_at` (stamped on every
 * successful change), so it survives restarts unlike the in-memory
 * limiter, and yields a clear « retry after » instead of a generic 429.
 */
const EMAIL_CHANGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

const meRoute = createRoute({
  method: 'get',
  path: '/me',
  tags: ['auth-account'],
  summary: 'Read authenticated user identity + factor flags',
  middleware: [requireUser] as const,
  responses: {
    200: jsonContent(AuthMeResponseSchema, 'User profile + MFA state'),
    401: errorContent('Unauthenticated'),
  },
});

const meCryptoRoute = createRoute({
  method: 'get',
  path: '/me/crypto',
  tags: ['auth-account'],
  summary: 'Read OPAQUE wrap blobs for KEK unwrap operations',
  middleware: [requireUser] as const,
  responses: {
    200: jsonContent(AuthMeCryptoResponseSchema, 'OPAQUE wrap envelope'),
    401: errorContent('Unauthenticated'),
  },
});

const changeEmailRoute = createRoute({
  method: 'patch',
  path: '/email',
  tags: ['auth-account'],
  summary: 'Change account email (re-auth gated)',
  middleware: [requireUser, requireFreshPassword, changeEmailLimiter] as const,
  request: {
    body: {
      content: {
        'application/json': { schema: ChangeEmailBodySchema },
      },
    },
  },
  responses: {
    200: okContent('Email updated (or no-op)'),
    400: errorContent('Invalid body'),
    401: errorContent('Unauthenticated or stale re-auth'),
    409: errorContent('Email already taken'),
    429: errorContent('Rate limit exceeded'),
  },
});

const changeUsernameRoute = createRoute({
  method: 'patch',
  path: '/username',
  tags: ['auth-account'],
  summary: 'Change display username',
  middleware: [requireUser] as const,
  request: {
    body: {
      content: {
        'application/json': { schema: ChangeUsernameBodySchema },
      },
    },
  },
  responses: {
    200: okContent('Username updated'),
    400: errorContent('Invalid body'),
    401: errorContent('Unauthenticated'),
  },
});

const onboardingCompleteRoute = createRoute({
  method: 'post',
  path: '/onboarding/complete',
  tags: ['auth-account'],
  summary: 'Mark onboarding complete (idempotent)',
  middleware: [requireUser] as const,
  responses: {
    200: okContent('Onboarding completed'),
    401: errorContent('Unauthenticated'),
  },
});

const deleteSelfRoute = createRoute({
  method: 'delete',
  path: '/me',
  tags: ['auth-account'],
  summary: 'Self-delete account (re-auth gated, cascades to all rows)',
  middleware: [requireUser, requireFreshPassword] as const,
  request: {
    body: {
      content: {
        'application/json': { schema: DeleteSelfBodySchema },
      },
    },
  },
  responses: {
    200: okContent('Account deleted'),
    400: errorContent('Invalid body'),
    401: errorContent('Unauthenticated or stale re-auth'),
  },
});

/**
 * Authenticated user introspection. Surfaces identity + role +
 * MFA flags so the front can drive the sidebar tip + Settings
 * + ProtectedRoute without a separate round-trip per concern.
 *
 * **What's NOT here** : the OPAQUE wrap blobs
 * (`wrappedMainKey`, `wrappedKekPassword`, …). API-14 split
 * them off to `GET /auth/me/crypto` — this endpoint is hit on
 * every page load (sidebar, header, ProtectedRoute) and shipping
 * ~2 KB of crypto blobs that 95 % of callers never touch is
 * wasteful. The client fetches the crypto endpoint only at
 * unwrap moments (change-password, recovery-code setup, passkey
 * enroll).
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
authAccountRoutes.openapi(meRoute, async (c) => {
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
  return c.json(body, 200);
});

/**
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
authAccountRoutes.openapi(meCryptoRoute, async (c) => {
  const user = c.get('user');
  const body: AuthMeCryptoResponse = {
    wrappedMainKey: user.wrappedMainKey ?? null,
    wrappedMainKeyIv: user.wrappedMainKeyIv ?? null,
    wrappedKekPassword: user.wrappedKekPassword ?? null,
    wrappedKekPasswordIv: user.wrappedKekPasswordIv ?? null,
  };
  return c.json(body, 200);
});

/**
 * Change the authenticated user's email — re-auth gated by
 * the `requireFreshPassword` middleware (Phase 7B).
 *
 * The envelope stays untouched : email isn't part of the KEK
 * derivation in V1, and login no longer derives the OPAQUE
 * `userIdentifier` from the *current* email — it replays the
 * registration-time identifier stored on `opaque_records`. This
 * route PINS that identifier (`COALESCE(existing, oldEmail)`) in
 * the same transaction as the email move, so the envelope stays
 * loggable after the change (audit 2026-06 passe 2 ; the original
 * 2026-06 fix added the column + login fallback but never stamped
 * it here, re-opening the lockout for pre-0020 accounts).
 *
 * Post-change hardening (same audit) :
 *   - a notification email goes to the OLD address, so the
 *     rightful owner learns about a hijack while their inbox
 *     still receives it. Best-effort — a mailer hiccup doesn't
 *     roll back the change.
 *   - every OTHER session is revoked. The caller keeps theirs
 *     (they just proved the password) ; a stolen parallel
 *     session loses access the moment the email moves.
 */
authAccountRoutes.openapi(changeEmailRoute, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = ChangeEmailBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const body = parsed.data;
  const user = c.get('user');
  const sessionId = c.get('sessionId');

  const newEmail = body.newEmail.toLowerCase();
  if (newEmail === user.email) return c.json({ ok: true as const }, 200);
  const oldEmail = user.email;

  // 7-day cooldown (Auth-Spec §13). A no-op email change short-circuits
  // above, so this only gates a real move. Stamped on every success
  // below ; a NULL `email_changed_at` (never changed, or a legacy row)
  // means no cooldown applies.
  if (user.emailChangedAt) {
    const elapsed = Date.now() - user.emailChangedAt.getTime();
    if (elapsed < EMAIL_CHANGE_COOLDOWN_MS) {
      const retryAt = new Date(
        user.emailChangedAt.getTime() + EMAIL_CHANGE_COOLDOWN_MS,
      );
      return c.json(
        { error: 'email_change_cooldown', retryAt: retryAt.toISOString() },
        429,
      );
    }
  }

  // Email change + OPAQUE-identifier pin + session revocation in one
  // transaction (audit 2026-06 passe 2). The pin is the crux : the
  // OPAQUE envelope was registered under `oldEmail`, so login must
  // keep replaying that identifier after the email moves. We
  // `COALESCE` so an already-stamped row keeps its true
  // registration-time identifier (which may differ from `oldEmail`
  // if the user changed email twice) ; a NULL row — a pre-0020
  // account the 0021 backfill may not have reached yet — gets pinned
  // to `oldEmail`, the identifier it was last loggable under.
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ email: newEmail, emailChangedAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, user.id));

      await tx
        .update(opaqueRecords)
        .set({ userIdentifier: sql`COALESCE(${opaqueRecords.userIdentifier}, ${oldEmail})` })
        .where(eq(opaqueRecords.userId, user.id));

      // Revoke every session except the calling one — same posture
      // as change-password, minus the cookie rotation (the caller's
      // session just proved the password).
      await tx
        .delete(sessions)
        .where(and(eq(sessions.userId, user.id), ne(sessions.id, sessionId)));
    });
  } catch (err) {
    if (isUniqueViolation(err, 'users_email_unique')) {
      return c.json({ error: 'email_taken' }, 409);
    }
    throw err;
  }

  // Notify the OLD address. Best-effort : the change is already
  // committed, an SMTP hiccup must not surface as a failure to the
  // legitimate caller.
  const noticeText =
    `L'adresse email de votre compte Nodea vient d'être remplacée par ${newEmail}.\n\n` +
    `Si vous êtes à l'origine de ce changement, vous pouvez ignorer ce message.\n` +
    `Sinon, votre compte est peut-être compromis : utilisez votre code de récupération ` +
    `ou contactez l'administrateur·ice de votre instance sans attendre.`;
  try {
    await sendMail({
      to: oldEmail,
      subject: 'Nodea — votre adresse email a été modifiée',
      text: noticeText,
      html: noticeText.replace(/\n/g, '<br>'),
    });
  } catch (err) {
    // DEV-gated like every sibling mailer-failure log (audit 2026-06
    // passe 2) : SMTP errors routinely echo the envelope recipient
    // (`550 5.1.1 <old@addr>: ...`), so logging `err` in prod would
    // write the user's old email to stdout — the « identifier in
    // logs » class the project forbids.
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[auth/email] change notification send failed', err);
    }
  }

  return c.json({ ok: true as const }, 200);
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
authAccountRoutes.openapi(changeUsernameRoute, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = ChangeUsernameBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const user = c.get('user');
  const newUsername = parsed.data.username;

  if ((user.username ?? null) === newUsername) return c.json({ ok: true as const }, 200);

  await db
    .update(users)
    .set({ username: newUsername, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return c.json({ ok: true as const }, 200);
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
authAccountRoutes.openapi(onboardingCompleteRoute, async (c) => {
  const user = c.get('user');
  if (user.onboardingStatus === 'complete') return c.json({ ok: true as const }, 200);

  await db
    .update(users)
    .set({ onboardingStatus: 'complete', updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return c.json({ ok: true as const }, 200);
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
authAccountRoutes.openapi(deleteSelfRoute, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = DeleteSelfBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const user = c.get('user');

  await db.delete(users).where(eq(users.id, user.id));
  clearSessionCookie(c);
  return c.json({ ok: true as const }, 200);
});
