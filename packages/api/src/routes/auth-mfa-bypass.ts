import { Hono } from 'hono';
import { and, eq, isNull } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import {
  MfaBypassRequestBodySchema,
  type MfaBypassCancelResponse,
  type MfaBypassConfirmResponse,
  type MfaBypassRequestResponse,
} from '@nodea/shared';
import { db } from '../db/client.ts';
import { mfaBypassRequests, users } from '../db/schema.ts';
import {
  BYPASS_APPLY_DELAY_MS,
  BYPASS_REQUEST_TTL_MS,
  bypassEligibility,
  hashBypassToken,
  newBypassToken,
} from '../auth/mfa-bypass.ts';
import { renderMfaBypassEmail } from '../services/email/templates/mfa-bypass.ts';
import { getEmailService } from '../services/email/index.ts';
import { getConfig } from '../config.ts';
import { rateLimit } from '../middleware/rate-limit.ts';
import type { AuthVariables } from '../middleware/require-user.ts';
import {
  requireMfaPending,
  type MfaPendingVariables,
} from '../middleware/require-mfa-pending.ts';

/**
 * MFA bypass routes (Auth-Roadmap Phase 6, Auth-Spec §7.8).
 *
 * Three surfaces:
 *
 *   - `POST /auth/mfa/bypass/request` (mfa_pending) — kicks off the
 *     bypass. Validates §6.2 eligibility, generates the token pair,
 *     emails the user.
 *   - `GET  /auth/mfa/bypass/confirm?t=<token>` (anon) — flips
 *     `confirmed_at`. The 48h "real" delay starts here. Renders a
 *     small confirmation HTML page (no JS) so the email-click UX
 *     doesn't depend on the SPA being loaded.
 *   - `GET  /auth/mfa/bypass/cancel?t=<token>` (anon) — flips
 *     `cancelled_at`. Same minimalist HTML response.
 *
 * Lazy application happens at login time (`auth.ts` /
 * `auth-passkey.ts` call `applyConsumableBypass`). No cron needed —
 * the bypass is consumed when the user next authenticates. A
 * successful full-session login also auto-cancels any pending
 * request (`cancelPendingBypassesForUser`), so there's no separate
 * "active" surface in Settings — the bypass either applies, gets
 * cancelled, or expires.
 */
export const authMfaBypassRoutes = new Hono<{
  Variables: AuthVariables & MfaPendingVariables;
}>();

const requestLimiter = rateLimit({
  max: 3,
  windowMs: 60 * 60_000,
  keyPrefix: 'mfa-bypass-request',
});

const linkLimiter = rateLimit({
  max: 20,
  windowMs: 60 * 60_000,
  keyPrefix: 'mfa-bypass-link',
});

/* ============================================================================
 * POST /auth/mfa/bypass/request — initiate bypass from /login/mfa
 * ========================================================================== */

authMfaBypassRoutes.post(
  '/mfa/bypass/request',
  requireMfaPending,
  requestLimiter,
  async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = MfaBypassRequestBodySchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
    const { factor } = parsed.data;
    const user = c.get('user');
    const pendingSession = c.get('pendingSession');

    // §6.2 eligibility check.
    const eligibility = bypassEligibility(user, pendingSession, factor);
    if (eligibility === 'not_required') {
      // The mode doesn't require this factor — bypass is moot. UI
      // shouldn't surface the option, so this is defence in depth.
      return c.json({ error: 'factor_not_required' }, 400);
    }
    if (eligibility === 'multi_factor_loss') {
      return c.json({ error: 'multi_factor_loss' }, 409);
    }

    // One bypass active at a time. The unique partial index would
    // also enforce this at the DB level (`mfa_bypass_one_active`),
    // but we surface a clearer error code here.
    const [existing] = await db
      .select({ id: mfaBypassRequests.id })
      .from(mfaBypassRequests)
      .where(
        and(
          eq(mfaBypassRequests.userId, user.id),
          isNull(mfaBypassRequests.cancelledAt),
          isNull(mfaBypassRequests.consumedAt),
        ),
      )
      .limit(1);
    if (existing) {
      return c.json({ error: 'bypass_already_active' }, 409);
    }

    const confirm = newBypassToken();
    const cancel = newBypassToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + BYPASS_REQUEST_TTL_MS);

    await db.insert(mfaBypassRequests).values({
      id: randomUUID(),
      userId: user.id,
      factor,
      confirmTokenHash: confirm.hash,
      cancelTokenHash: cancel.hash,
      confirmedAt: null,
      expiresAt,
      cancelledAt: null,
      consumedAt: null,
    });

    // Email both links. They target the SPA's `/auth/bypass/{confirm,
    // cancel}?t=…` routes, which mount a React component that calls
    // the corresponding API endpoint and renders a styled page with a
    // countdown — same look as `/totp`, `/passkeys`, `/activate`.
    const config = getConfig();
    const base = (config.WEB_BASE_URL ?? config.WEBAUTHN_ORIGIN).replace(/\/$/, '');
    const confirmLink = `${base}/auth/bypass/confirm?t=${confirm.token}`;
    const cancelLink = `${base}/auth/bypass/cancel?t=${cancel.token}`;
    const rendered = renderMfaBypassEmail({
      factor,
      confirmLink,
      cancelLink,
    });
    await getEmailService().send({
      to: user.email,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      tag: 'mfa-bypass-request',
    });

    // The earliest the bypass becomes applicable is delay-after-
    // confirmation. We don't know when the user will confirm, so we
    // surface "now + delay" as the floor — the UI uses it as
    // "earliest possible" not "exact".
    const earliestApplyAt = new Date(now.getTime() + BYPASS_APPLY_DELAY_MS);
    const response: MfaBypassRequestResponse = {
      earliestApplyAt: earliestApplyAt.toISOString(),
    };
    return c.json(response);
  },
);

/* ============================================================================
 * GET /auth/mfa/bypass/confirm?t=… — email-link confirmation
 *
 * Returns JSON for the SPA (`/auth/bypass/confirm` route) which is
 * the actual email-link target. The SPA renders a styled page with
 * a countdown to `earliestApplyAt`.
 * ========================================================================== */

authMfaBypassRoutes.get('/mfa/bypass/confirm', linkLimiter, async (c) => {
  const token = c.req.query('t');
  if (!token || token.length < 16 || token.length > 256) {
    const body: MfaBypassConfirmResponse = { status: 'unknown' };
    return c.json(body, 400);
  }
  const hash = hashBypassToken(token);
  const [request] = await db
    .select()
    .from(mfaBypassRequests)
    .where(eq(mfaBypassRequests.confirmTokenHash, hash))
    .limit(1);
  if (!request) {
    const body: MfaBypassConfirmResponse = { status: 'unknown' };
    return c.json(body, 404);
  }
  const now = new Date();
  if (request.cancelledAt !== null) {
    const body: MfaBypassConfirmResponse = { status: 'cancelled' };
    return c.json(body, 410);
  }
  if (request.consumedAt !== null) {
    const body: MfaBypassConfirmResponse = { status: 'consumed' };
    return c.json(body, 410);
  }
  if (request.expiresAt < now) {
    const body: MfaBypassConfirmResponse = { status: 'expired' };
    return c.json(body, 410);
  }
  if (request.confirmedAt !== null) {
    const earliestApply = new Date(
      request.confirmedAt.getTime() + BYPASS_APPLY_DELAY_MS,
    );
    const body: MfaBypassConfirmResponse = {
      status: 'already_confirmed',
      factor: request.factor,
      earliestApplyAt: earliestApply.toISOString(),
    };
    return c.json(body);
  }

  await db
    .update(mfaBypassRequests)
    .set({ confirmedAt: now })
    .where(eq(mfaBypassRequests.id, request.id));

  const earliestApply = new Date(now.getTime() + BYPASS_APPLY_DELAY_MS);
  const body: MfaBypassConfirmResponse = {
    status: 'ok',
    factor: request.factor,
    earliestApplyAt: earliestApply.toISOString(),
  };
  return c.json(body);
});

/* ============================================================================
 * GET /auth/mfa/bypass/cancel?t=… — email-link cancellation
 * ========================================================================== */

authMfaBypassRoutes.get('/mfa/bypass/cancel', linkLimiter, async (c) => {
  const token = c.req.query('t');
  if (!token || token.length < 16 || token.length > 256) {
    const body: MfaBypassCancelResponse = { status: 'unknown' };
    return c.json(body, 400);
  }
  const hash = hashBypassToken(token);
  const [request] = await db
    .select()
    .from(mfaBypassRequests)
    .where(eq(mfaBypassRequests.cancelTokenHash, hash))
    .limit(1);
  if (!request) {
    const body: MfaBypassCancelResponse = { status: 'unknown' };
    return c.json(body, 404);
  }
  if (request.cancelledAt !== null) {
    const body: MfaBypassCancelResponse = {
      status: 'already_cancelled',
      factor: request.factor,
    };
    return c.json(body);
  }
  if (request.consumedAt !== null) {
    const body: MfaBypassCancelResponse = { status: 'consumed' };
    return c.json(body, 410);
  }

  await db
    .update(mfaBypassRequests)
    .set({ cancelledAt: new Date() })
    .where(eq(mfaBypassRequests.id, request.id));

  const body: MfaBypassCancelResponse = {
    status: 'ok',
    factor: request.factor,
  };
  return c.json(body);
});
