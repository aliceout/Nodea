import { eq } from 'drizzle-orm';
import {
  RequestResetBodySchema,
  ResetPasswordFinishBodySchema,
  ResetPasswordStartBodySchema,
  ResetPasswordStartResponseSchema,
  type ResetPasswordStartResponse,
} from '@nodea/shared';

import { sendMail } from '../auth/mailer.ts';
import {
  createRegistrationResponse,
  opaqueReady,
} from '../auth/opaque.ts';
import {
  consumeResetPending,
  storeResetPending,
} from '../auth/opaque-pending-state.ts';
import { createResetToken, findActiveResetToken } from '../auth/reset-tokens.ts';
import { revokeAllUserSessions } from '../auth/session.ts';
import { getConfig } from '../config.ts';
import { db } from '../db/client.ts';
import {
  modulesConfig,
  opaqueRecords,
  passwordResetTokens,
  userPreferences,
  users,
} from '../db/schema.ts';
import { renderPasswordResetEmail } from '../services/email/templates/password-reset.ts';
import { extractEmailLanguage } from '../services/email/i18n.ts';
import {
  createRoute,
  errorContent,
  jsonContent,
  makeAuthedRouter,
  okContent,
} from '../openapi/index.ts';

import { requestResetLimiter, resetLimiter } from './auth-shared.ts';

export const authResetRoutes = makeAuthedRouter();

const requestResetRoute = createRoute({
  method: 'post',
  path: '/request-reset',
  tags: ['auth-reset'],
  summary: 'Request a reset email (always 200, anti-enum)',
  middleware: [requestResetLimiter] as const,
  request: {
    body: {
      content: {
        'application/json': { schema: RequestResetBodySchema },
      },
    },
  },
  responses: {
    200: okContent('Reset email queued (or no-op if email unknown)'),
    400: errorContent('Invalid body'),
    429: errorContent('Rate limit exceeded'),
  },
});

const resetStartRoute = createRoute({
  method: 'post',
  path: '/reset/start',
  tags: ['auth-reset'],
  summary: 'Reset — step 1 (token validation + OPAQUE start)',
  middleware: [resetLimiter] as const,
  request: {
    body: {
      content: {
        'application/json': { schema: ResetPasswordStartBodySchema },
      },
    },
  },
  responses: {
    200: jsonContent(ResetPasswordStartResponseSchema, 'OPAQUE registration response + reset token'),
    400: errorContent('Invalid body or token'),
    429: errorContent('Rate limit exceeded'),
  },
});

const resetFinishRoute = createRoute({
  method: 'post',
  path: '/reset/finish',
  tags: ['auth-reset'],
  summary: 'Reset — step 2 (rotate envelope + purge user blobs)',
  middleware: [resetLimiter] as const,
  request: {
    body: {
      content: {
        'application/json': { schema: ResetPasswordFinishBodySchema },
      },
    },
  },
  responses: {
    200: okContent('Reset completed'),
    400: errorContent('Invalid body or token'),
    429: errorContent('Rate limit exceeded'),
  },
});

/**
 * Start a password-reset flow.
 *
 * Always responds 200 regardless of whether the email matches
 * a user. The response shape leaks nothing ; the only
 * side-channel would be timing (mailer round-trip on the
 * happy branch). Rate limited to 5 requests per IP per hour
 * to blunt enumeration attempts.
 */
authResetRoutes.openapi(requestResetRoute, async (c) => {
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
    const rendered = renderPasswordResetEmail({ link, language: extractEmailLanguage(c) });
    try {
      await sendMail({
        to: email,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
      });
    } catch (err) {
      console.error('[auth] reset-password mailer failed', err);
      // Never surface the failure to the caller — still 200
      // so an attacker can't distinguish « email exists but
      // SMTP is down » from the happy path.
    }
  }

  return c.json({ ok: true as const }, 200);
});

/**
 * Consume a reset token — step 1 (Auth-Roadmap Phase 2D,
 * OPAQUE).
 *
 * Validates the reset token + runs OPAQUE
 * `createRegistrationResponse` for the new password the user
 * is about to commit to. Returns
 * `{ registrationResponse, resetToken }` — the latter is a
 * fresh single-use marker the client echoes at /finish.
 *
 * No DB mutation here. The reset token (`tokenRow`) stays
 * valid until /finish marks it used, so a botched /finish
 * (network drop, malformed body) lets the user retry without
 * going through /request-reset again.
 *
 * Wrong / expired / already-used token → 400 `invalid_token`.
 */
authResetRoutes.openapi(resetStartRoute, async (c) => {
  await opaqueReady;
  const raw = await c.req.json().catch(() => null);
  const parsed = ResetPasswordStartBodySchema.safeParse(raw);
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

  let registrationResponse: string;
  try {
    ({ registrationResponse } = createRegistrationResponse({
      userIdentifier: user.email,
      registrationRequest: body.registrationRequest,
    }));
  } catch {
    return c.json({ error: 'invalid_body' }, 400);
  }

  const resetToken = storeResetPending(user.id, user.email);
  const response: ResetPasswordStartResponse = {
    registrationResponse,
    resetToken,
    userId: user.id,
  };
  return c.json(response, 200);
});

/**
 * Consume a reset token — step 2 : purge every user-owned
 * encrypted row, replace every credential blob, mark the
 * reset token used.
 *
 * Reset is destructive — the OLD main key is unrecoverable,
 * so the client generates a fresh main key + fresh KEK and
 * ships the new wrap blobs alongside the OPAQUE
 * `registrationRecord`. Every pre-reset ciphertext (mood
 * entries, etc.) is purged in the same transaction.
 *
 * Purge semantics : the records we still CAN identify by
 * user_id (1:1-per-user FK-linked tables — `modulesConfig`,
 * `userPreferences`) are wiped. The encrypted user→sids
 * mapping in `modulesConfig` is the anchor for any future
 * client recovery — wiping it cuts the user off from the
 * orphan entry rows below.
 *
 * The per-module entry tables (mood_entries, goals_entries,
 * …) carry no `user_id` column by design — the server cannot
 * link a row to a user, so we cannot purge them here. Those
 * rows become orphans : encrypted with the lost main key,
 * unreadable by anyone, taking up space in the table
 * indefinitely. This is the documented trade-off of « the
 * server never links user to data » (cf. `docs/Architecture.md` §7).
 * Bounded growth, accepted.
 */
authResetRoutes.openapi(resetFinishRoute, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = ResetPasswordFinishBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const body = parsed.data;

  const pending = consumeResetPending(body.resetToken);
  if (!pending) return c.json({ error: 'invalid_token' }, 400);

  // The pending entry binds the reset to a specific user.
  // Re-find the active reset-token row that started the flow
  // so we can mark it used at the same transaction ; if it's
  // gone the flow expired between /start and /finish and we
  // bail.
  const [tokenRow] = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, pending.userId))
    .limit(1);
  if (!tokenRow) return c.json({ error: 'invalid_token' }, 400);

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, pending.userId))
    .limit(1);
  if (!user) return c.json({ error: 'invalid_token' }, 400);

  await db.transaction(async (tx) => {
    await tx.delete(modulesConfig).where(eq(modulesConfig.userId, user.id));
    await tx.delete(userPreferences).where(eq(userPreferences.userId, user.id));

    await tx
      .update(opaqueRecords)
      .set({ envelope: body.registrationRecord })
      .where(eq(opaqueRecords.userId, user.id));

    await tx
      .update(users)
      .set({
        wrappedMainKey: body.wrappedMainKey,
        wrappedMainKeyIv: body.wrappedMainKeyIv,
        wrappedKekPassword: body.wrappedKekPassword,
        wrappedKekPasswordIv: body.wrappedKekPasswordIv,
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
  return c.json({ ok: true as const }, 200);
});
