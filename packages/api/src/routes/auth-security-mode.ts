import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { SecurityModeChangeBodySchema } from '@nodea/shared';
import { db } from '../db/client.ts';
import { authFactors, mfaTotp, users } from '../db/schema.ts';
import {
  finishLogin as opaqueFinishLogin,
  opaqueReady,
} from '../auth/opaque.ts';
import { consumeLoginState } from '../auth/opaque-login-state.ts';
import { rateLimit } from '../middleware/rate-limit.ts';
import { requireUser, type AuthVariables } from '../middleware/require-user.ts';

/**
 * Security-mode change route (Auth-Roadmap Phase 5D, Auth-Spec §6.1).
 *
 * One route:
 *
 *   - `POST /auth/security-mode/change` — moves the user between
 *     `password_or_passkey`, `always_totp`, and `maximum`. Validates
 *     the prerequisites (TOTP enabled / PRF-passkey enrolled) and
 *     refuses with a clear 400 error code when they're not met.
 *     Requires a fresh OPAQUE password proof per the matrice (§6).
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

async function verifyPasswordProof(
  user: { email: string },
  body: { proofLoginToken: string; proofFinishLoginRequest: string },
): Promise<'ok' | 'invalid'> {
  await opaqueReady;
  const pending = consumeLoginState(body.proofLoginToken);
  if (!pending) return 'invalid';
  if (pending.userIdentifier !== user.email.toLowerCase()) return 'invalid';
  try {
    opaqueFinishLogin({
      serverLoginState: pending.state,
      finishLoginRequest: body.proofFinishLoginRequest,
    });
  } catch {
    return 'invalid';
  }
  return 'ok';
}

authSecurityModeRoutes.post(
  '/security-mode/change',
  requireUser,
  limiter,
  async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = SecurityModeChangeBodySchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
    const { mode } = parsed.data;
    const user = c.get('user');

    const proof = await verifyPasswordProof(user, parsed.data);
    if (proof !== 'ok') return c.json({ error: 'invalid_credentials' }, 401);

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
