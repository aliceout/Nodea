import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { SecurityModeChangeBodySchema } from '@nodea/shared';
import { db } from '../db/client.ts';
import { authFactors, mfaTotp, users } from '../db/schema.ts';
import { rateLimit } from '../middleware/rate-limit.ts';
import { requireUser, type AuthVariables } from '../middleware/require-user.ts';
import { requireFreshPassword } from '../middleware/require-fresh-reauth.ts';

/**
 * Security-mode change route (Auth-Roadmap Phase 5D + 7B,
 * Auth-Spec §6.1).
 *
 *   - `POST /auth/security-mode/change` — moves the user between
 *     `password_or_passkey`, `always_totp`, and `maximum`. Validates
 *     the prerequisites (TOTP enabled / PRF-passkey enrolled) and
 *     refuses with a clear 400 error code when they're not met.
 *
 * Re-auth gate: `requireFreshPassword` (Phase 7B). The Phase 5D
 * MVP embedded an OPAQUE proof in the body; that's now done out-
 * of-band via `POST /auth/reauth/password` and the freshness
 * window covers this route for 5 minutes.
 *
 * Downgrade auto (§6.1) is wired separately on the de-enrollment
 * routes (`/auth/totp/disable`, `/auth/passkey/:id/remove`); this
 * route only handles upgrades / explicit re-selections.
 */
export const authSecurityModeRoutes = new Hono<{ Variables: AuthVariables }>();

const limiter = rateLimit({
  max: 10,
  windowMs: 15 * 60_000,
  keyPrefix: 'security-mode-change',
});

authSecurityModeRoutes.post(
  '/security-mode/change',
  requireUser,
  requireFreshPassword,
  limiter,
  async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = SecurityModeChangeBodySchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
    const { mode } = parsed.data;
    const user = c.get('user');

    // Activation gate (Auth-Spec §6.1). `password_or_passkey` is
    // always reachable; `always_totp` needs TOTP enabled; `maximum`
    // additionally needs a PRF-capable passkey enrolled.
    if (mode === 'always_totp' || mode === 'maximum') {
      const [totp] = await db
        .select({ enabledAt: mfaTotp.enabledAt })
        .from(mfaTotp)
        .where(eq(mfaTotp.userId, user.id))
        .limit(1);
      if (!totp || totp.enabledAt === null) {
        return c.json({ error: 'totp_required' }, 400);
      }
    }
    if (mode === 'maximum') {
      const [prf] = await db
        .select({ id: authFactors.id })
        .from(authFactors)
        .where(
          and(
            eq(authFactors.userId, user.id),
            eq(authFactors.prfSupported, true),
          ),
        )
        .limit(1);
      if (!prf) {
        return c.json({ error: 'passkey_required' }, 400);
      }
    }

    await db
      .update(users)
      .set({ securityMode: mode, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    return c.json({ ok: true, mode });
  },
);
