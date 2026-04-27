import { Hono, type Context } from 'hono';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import {
  MfaBypassRequestBodySchema,
  type MfaBypassActiveResponse,
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
import { requireUser, type AuthVariables } from '../middleware/require-user.ts';
import {
  requireMfaPending,
  type MfaPendingVariables,
} from '../middleware/require-mfa-pending.ts';

/**
 * MFA bypass routes (Auth-Roadmap Phase 6, Auth-Spec §7.8).
 *
 * Five surfaces:
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
 *   - `GET  /auth/mfa/bypass/active` (full session) — returns the
 *     active request (if any) so the Settings UI can show "you have
 *     a pending bypass, cancel it here" without polling.
 *   - `POST /auth/mfa/bypass/cancel` (full session) — cancels the
 *     active bypass without going through the email link. Used by
 *     the Settings cancel button.
 *
 * Lazy application happens at login time (`auth.ts` /
 * `auth-passkey.ts` call `applyConsumableBypass`). No cron needed —
 * the bypass is consumed when the user next authenticates.
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

    // Email both links. They target the API directly (server-rendered
    // HTML pages) via the `/api` reverse-proxy prefix — the SPA does
    // not host the confirm/cancel pages. Vite forwards `/api/*` to the
    // Hono dev server, and prod nginx mirrors that layout.
    const config = getConfig();
    const base = (config.WEB_BASE_URL ?? config.WEBAUTHN_ORIGIN).replace(/\/$/, '');
    const confirmLink = `${base}/api/auth/mfa/bypass/confirm?t=${confirm.token}`;
    const cancelLink = `${base}/api/auth/mfa/bypass/cancel?t=${cancel.token}`;
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
 * ========================================================================== */

authMfaBypassRoutes.get('/mfa/bypass/confirm', linkLimiter, async (c) => {
  const token = c.req.query('t');
  if (!token || token.length < 16 || token.length > 256) {
    return htmlPage(
      c,
      'Lien invalide',
      'Le lien de confirmation est invalide ou tronqué.',
      400,
    );
  }
  const hash = hashBypassToken(token);
  const [request] = await db
    .select()
    .from(mfaBypassRequests)
    .where(eq(mfaBypassRequests.confirmTokenHash, hash))
    .limit(1);
  if (!request) {
    return htmlPage(
      c,
      'Lien expiré ou inconnu',
      'Le lien de confirmation est invalide. Tu peux relancer une demande depuis la page de connexion.',
      404,
    );
  }
  const now = new Date();
  if (request.cancelledAt !== null) {
    return htmlPage(
      c,
      'Demande annulée',
      'Cette demande de récupération a déjà été annulée.',
      410,
    );
  }
  if (request.consumedAt !== null) {
    return htmlPage(
      c,
      'Demande déjà consommée',
      'Cette demande de récupération a déjà été appliquée à un login précédent.',
      410,
    );
  }
  if (request.expiresAt < now) {
    return htmlPage(
      c,
      'Demande expirée',
      'Cette demande a expiré. Relance une demande depuis la page de connexion.',
      410,
    );
  }
  if (request.confirmedAt !== null) {
    return htmlPage(
      c,
      'Demande déjà confirmée',
      `Cette demande est déjà confirmée. Tu pourras te connecter sans ${factorLabel(request.factor)} 48h après ${request.confirmedAt.toISOString()}.`,
      200,
    );
  }

  await db
    .update(mfaBypassRequests)
    .set({ confirmedAt: now })
    .where(eq(mfaBypassRequests.id, request.id));

  const earliestApply = new Date(now.getTime() + BYPASS_APPLY_DELAY_MS);
  return htmlPage(
    c,
    'Demande validée',
    `Tu pourras te connecter sans ${factorLabel(request.factor)} à partir du ${earliestApply.toLocaleString('fr-FR')}.`,
    200,
  );
});

/* ============================================================================
 * GET /auth/mfa/bypass/cancel?t=… — email-link cancellation
 * ========================================================================== */

authMfaBypassRoutes.get('/mfa/bypass/cancel', linkLimiter, async (c) => {
  const token = c.req.query('t');
  if (!token || token.length < 16 || token.length > 256) {
    return htmlPage(
      c,
      'Lien invalide',
      'Le lien d’annulation est invalide ou tronqué.',
      400,
    );
  }
  const hash = hashBypassToken(token);
  const [request] = await db
    .select()
    .from(mfaBypassRequests)
    .where(eq(mfaBypassRequests.cancelTokenHash, hash))
    .limit(1);
  if (!request) {
    return htmlPage(c, 'Lien inconnu', 'Ce lien n’est pas valide.', 404);
  }
  if (request.cancelledAt !== null) {
    return htmlPage(
      c,
      'Déjà annulée',
      'Cette demande a déjà été annulée.',
      200,
    );
  }
  if (request.consumedAt !== null) {
    return htmlPage(
      c,
      'Trop tard',
      'Cette demande a déjà été appliquée — il est trop tard pour l’annuler. Si ce n’est pas toi, va sur la page de connexion et utilise « reset destructif ».',
      410,
    );
  }

  await db
    .update(mfaBypassRequests)
    .set({ cancelledAt: new Date() })
    .where(eq(mfaBypassRequests.id, request.id));

  return htmlPage(
    c,
    'Demande annulée',
    'La demande de récupération est annulée. Tu peux te reconnecter normalement avec tous tes facteurs habituels.',
    200,
  );
});

/* ============================================================================
 * GET /auth/mfa/bypass/active — Settings status row
 * ========================================================================== */

authMfaBypassRoutes.get('/mfa/bypass/active', requireUser, async (c) => {
  const user = c.get('user');
  const [request] = await db
    .select()
    .from(mfaBypassRequests)
    .where(
      and(
        eq(mfaBypassRequests.userId, user.id),
        isNull(mfaBypassRequests.cancelledAt),
        isNull(mfaBypassRequests.consumedAt),
      ),
    )
    .orderBy(desc(mfaBypassRequests.createdAt))
    .limit(1);

  const response: MfaBypassActiveResponse = {
    active: request
      ? {
          factor: request.factor,
          confirmedAt: request.confirmedAt
            ? request.confirmedAt.toISOString()
            : null,
          expiresAt: request.expiresAt.toISOString(),
          earliestApplyAt: request.confirmedAt
            ? new Date(
                request.confirmedAt.getTime() + BYPASS_APPLY_DELAY_MS,
              ).toISOString()
            : null,
        }
      : null,
  };
  return c.json(response);
});

/* ============================================================================
 * POST /auth/mfa/bypass/cancel — Settings cancel button
 * ========================================================================== */

authMfaBypassRoutes.post('/mfa/bypass/cancel', requireUser, async (c) => {
  const user = c.get('user');
  const result = await db
    .update(mfaBypassRequests)
    .set({ cancelledAt: new Date() })
    .where(
      and(
        eq(mfaBypassRequests.userId, user.id),
        isNull(mfaBypassRequests.cancelledAt),
        isNull(mfaBypassRequests.consumedAt),
      ),
    )
    .returning({ id: mfaBypassRequests.id });
  if (result.length === 0) {
    return c.json({ error: 'no_active_bypass' }, 404);
  }
  return c.json({ ok: true });
});

/* ============================================================================
 * Local helpers
 * ========================================================================== */

function factorLabel(factor: 'totp' | 'passkey'): string {
  return factor === 'totp' ? 'TOTP' : 'passkey';
}

/**
 * Render a minimal HTML page for the email-link endpoints. The
 * email-click UX shouldn't require the SPA to be loaded; this
 * server-side page works in any browser, even with JS disabled.
 */
function htmlPage(
  c: Context,
  title: string,
  message: string,
  status: number,
): Response {
  const body = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} — Nodea</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #fafaf6; color: #1f1f1c; margin: 0; padding: 48px 24px; min-height: 100vh; box-sizing: border-box; }
    main { max-width: 480px; margin: 0 auto; background: #fff; border: 1px solid #e7e7e0; border-radius: 12px; padding: 32px; }
    h1 { margin: 0 0 16px 0; font-size: 22px; font-weight: 600; letter-spacing: -0.02em; }
    p { margin: 0 0 16px 0; line-height: 1.55; color: #4a4a44; }
    a { color: #3d5641; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <p><a href="/login">← Retour à la connexion</a></p>
  </main>
</body>
</html>`;
  // Hono's `c.html` overloads accept a status code as the second
  // arg; we cast through `unknown` because the union of accepted
  // status codes is narrower than the `number` we use here.
  return c.html(body, status as Parameters<Context['html']>[1]);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
