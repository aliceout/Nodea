import { and, eq } from 'drizzle-orm';
import {
  PasskeyDeleteBodySchema,
  PasskeyListResponseSchema,
  PasskeyRenameWithProofBodySchema,
  type PasskeyListItem,
  type PasskeyListResponse,
} from '@nodea/shared';

import { db } from '../db/client.ts';
import { authFactors, mfaTotp, users } from '../db/schema.ts';
import { requireFreshPassword } from '../middleware/require-fresh-reauth.ts';
import { requireUser } from '../middleware/require-user.ts';
import { getEmailService } from '../services/email/index.ts';
import { renderSecurityModeDowngradedEmail } from '../services/email/templates/security-mode-downgraded.ts';
import { extractEmailLanguage } from '../services/email/i18n.ts';
import {
  createRoute,
  errorContent,
  jsonContent,
  makeAuthedRouter,
  okContent,
  z,
} from '../openapi/index.ts';

import { manageLimiter } from './passkey-helpers.ts';

export const authPasskeyManageRoutes = makeAuthedRouter();

const listRoute = createRoute({
  method: 'get',
  path: '/passkeys/list',
  tags: ['auth-passkey'],
  summary: 'List enrolled passkeys',
  middleware: [requireUser, manageLimiter] as const,
  responses: {
    200: jsonContent(PasskeyListResponseSchema, 'Passkey list'),
    401: errorContent('Unauthenticated'),
    429: errorContent('Rate limit exceeded'),
  },
});

const renameRoute = createRoute({
  method: 'patch',
  path: '/passkeys/{id}/label',
  tags: ['auth-passkey'],
  summary: 'Rename a passkey (re-auth gated)',
  middleware: [requireUser, requireFreshPassword, manageLimiter] as const,
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: { 'application/json': { schema: PasskeyRenameWithProofBodySchema } },
    },
  },
  responses: {
    200: okContent('Renamed'),
    400: errorContent('Invalid body'),
    401: errorContent('Unauthenticated or stale re-auth'),
    404: errorContent('Passkey not found'),
    429: errorContent('Rate limit exceeded'),
  },
});

const removeRoute = createRoute({
  method: 'post',
  path: '/passkeys/{id}/remove',
  tags: ['auth-passkey'],
  summary: 'Remove a passkey (re-auth gated, may auto-downgrade mode)',
  middleware: [requireUser, requireFreshPassword, manageLimiter] as const,
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: { 'application/json': { schema: PasskeyDeleteBodySchema } },
    },
  },
  responses: {
    200: okContent('Removed'),
    400: errorContent('Invalid body'),
    401: errorContent('Unauthenticated or stale re-auth'),
    404: errorContent('Passkey not found'),
    429: errorContent('Rate limit exceeded'),
  },
});

/* ============================================================================
 * GET /auth/passkeys/list
 * ========================================================================== */

authPasskeyManageRoutes.openapi(listRoute, async (c) => {
  const user = c.get('user');
  const rows = await db
    .select({
      id: authFactors.id,
      label: authFactors.label,
      prfSupported: authFactors.prfSupported,
      transports: authFactors.transports,
      createdAt: authFactors.createdAt,
      lastUsedAt: authFactors.lastUsedAt,
    })
    .from(authFactors)
    .where(eq(authFactors.userId, user.id));

  const data: PasskeyListItem[] = rows.map((row) => ({
    id: row.id,
    label: row.label,
    prfSupported: row.prfSupported,
    transports: row.transports,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
  }));
  const prfCount = data.filter((p) => p.prfSupported).length;

  // Uniform `{ data, meta }` envelope (audit API-06). `prfCount`
  // moved from a top-level field into `meta` ; the client surfaces
  // it through `apiPasskeyList()` without consumers having to
  // know about the envelope.
  const response: PasskeyListResponse = { data, meta: { prfCount } };
  return c.json(response, 200);
});

/* ============================================================================
 * PATCH /auth/passkeys/:id/label
 * ========================================================================== */

authPasskeyManageRoutes.openapi(renameRoute, async (c) => {
  const id = c.req.param('id');
  const raw = await c.req.json().catch(() => null);
  const parsed = PasskeyRenameWithProofBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const body = parsed.data;
  const user = c.get('user');

  const result = await db
    .update(authFactors)
    .set({ label: body.label })
    .where(and(eq(authFactors.id, id), eq(authFactors.userId, user.id)))
    .returning({ id: authFactors.id });

  if (result.length === 0) return c.json({ error: 'not_found' }, 404);
  return c.json({ ok: true as const }, 200);
});

/* ============================================================================
 * POST /auth/passkeys/:id/remove
 * ========================================================================== */

/**
 * Remove a passkey + run the §6.1 mode-max downgrade
 * automatically when the deletion took the last PRF-capable
 * passkey of a user in `maximum`. Falls back to
 * `password_or_passkey` so the user doesn't get locked out of
 * a passkey-required mode they no longer have a passkey for.
 *
 * The downgrade is committed before the notification email
 * goes out — an SMTP hiccup must not flip the route to 5xx.
 */
authPasskeyManageRoutes.openapi(removeRoute, async (c) => {
  const id = c.req.param('id');
  const raw = await c.req.json().catch(() => null);
  const parsed = PasskeyDeleteBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const user = c.get('user');

  const result = await db
    .delete(authFactors)
    .where(and(eq(authFactors.id, id), eq(authFactors.userId, user.id)))
    .returning({
      id: authFactors.id,
      prfSupported: authFactors.prfSupported,
    });

  if (result.length === 0) return c.json({ error: 'not_found' }, 404);

  // §6.1 downgrade auto. Two branches:
  //  - `maximum` strictly requires a PRF-capable passkey. Removing
  //    the last PRF credential downgrades to `password_or_passkey`.
  //    Non-PRF removals never affect `maximum`.
  //  - `always_2fa` (since #72) accepts a passkey as the sole 2nd
  //    factor. Removing the last passkey of *any* kind, while the
  //    user has no TOTP enabled, downgrades to `password_or_passkey`.
  let downgradeTrigger:
    | 'last_prf_passkey_removed'
    | 'last_passkey_removed'
    | null = null;
  let downgradedFrom: 'always_2fa' | 'maximum' | null = null;
  if (result[0]?.prfSupported && user.securityMode === 'maximum') {
    const [remainingPrf] = await db
      .select({ id: authFactors.id })
      .from(authFactors)
      .where(
        and(
          eq(authFactors.userId, user.id),
          eq(authFactors.prfSupported, true),
        ),
      )
      .limit(1);
    if (!remainingPrf) {
      downgradeTrigger = 'last_prf_passkey_removed';
      downgradedFrom = 'maximum';
    }
  } else if (user.securityMode === 'always_2fa') {
    const [remainingAny] = await db
      .select({ id: authFactors.id })
      .from(authFactors)
      .where(
        and(
          eq(authFactors.userId, user.id),
          eq(authFactors.kind, 'passkey'),
        ),
      )
      .limit(1);
    if (!remainingAny) {
      const [totp] = await db
        .select({ enabledAt: mfaTotp.enabledAt })
        .from(mfaTotp)
        .where(eq(mfaTotp.userId, user.id))
        .limit(1);
      const hasTotp = !!totp && totp.enabledAt !== null;
      if (!hasTotp) {
        downgradeTrigger = 'last_passkey_removed';
        downgradedFrom = 'always_2fa';
      }
    }
  }

  if (downgradeTrigger && downgradedFrom) {
    await db
      .update(users)
      .set({ securityMode: 'password_or_passkey', updatedAt: new Date() })
      .where(eq(users.id, user.id));
    try {
      const rendered = renderSecurityModeDowngradedEmail({
        language: extractEmailLanguage(c),
        trigger: downgradeTrigger,
        previousMode: downgradedFrom,
      });
      await getEmailService().send({
        to: user.email,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
        tag: 'security-mode-downgraded',
      });
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          '[auth/passkey] downgrade notification mail failed',
          err,
        );
      }
    }
  }

  return c.json({ ok: true as const }, 200);
});
