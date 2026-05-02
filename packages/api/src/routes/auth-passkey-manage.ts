import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import {
  PasskeyDeleteBodySchema,
  PasskeyRenameWithProofBodySchema,
  type PasskeyListItem,
  type PasskeyListResponse,
} from '@nodea/shared';

import { db } from '../db/client.ts';
import { authFactors, users } from '../db/schema.ts';
import { requireFreshPassword } from '../middleware/require-fresh-reauth.ts';
import { requireUser, type AuthVariables } from '../middleware/require-user.ts';
import { getEmailService } from '../services/email/index.ts';
import { renderSecurityModeDowngradedEmail } from '../services/email/templates/security-mode-downgraded.ts';
import { extractEmailLanguage } from '../services/email/i18n.ts';

import { manageLimiter } from './passkey-helpers.ts';

export const authPasskeyManageRoutes = new Hono<{ Variables: AuthVariables }>();

/* ============================================================================
 * GET /auth/passkeys/list
 * ========================================================================== */

authPasskeyManageRoutes.get(
  '/passkeys/list',
  requireUser,
  manageLimiter,
  async (c) => {
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
    return c.json(response);
  },
);

/* ============================================================================
 * PATCH /auth/passkeys/:id/label
 * ========================================================================== */

authPasskeyManageRoutes.patch(
  '/passkeys/:id/label',
  requireUser,
  requireFreshPassword,
  manageLimiter,
  async (c) => {
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
    return c.json({ ok: true });
  },
);

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
authPasskeyManageRoutes.post(
  '/passkeys/:id/remove',
  requireUser,
  requireFreshPassword,
  manageLimiter,
  async (c) => {
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

    // §6.1 downgrade auto : if the deletion took the last
    // PRF-capable passkey AND the user is in `maximum`, fall
    // back to `password_or_passkey`. Only applies when the
    // deleted credential was PRF-capable — non-PRF removals
    // never trigger downgrade.
    if (result[0]?.prfSupported && user.securityMode === 'maximum') {
      const remaining = await db
        .select({ id: authFactors.id })
        .from(authFactors)
        .where(
          and(
            eq(authFactors.userId, user.id),
            eq(authFactors.prfSupported, true),
          ),
        )
        .limit(1);
      if (remaining.length === 0) {
        await db
          .update(users)
          .set({ securityMode: 'password_or_passkey', updatedAt: new Date() })
          .where(eq(users.id, user.id));
        try {
          const rendered = renderSecurityModeDowngradedEmail({
            language: extractEmailLanguage(c),
            trigger: 'last_prf_passkey_removed',
            previousMode: 'maximum',
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
    }

    return c.json({ ok: true });
  },
);
