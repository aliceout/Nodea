import { and, eq } from 'drizzle-orm';
import {
  SecurityModeChangeBodySchema,
  SecurityModeSchema,
} from '@nodea/shared';
import { db } from '../db/client.ts';
import { authFactors, mfaTotp, users } from '../db/schema.ts';
import {
  createSession,
  revokeAllUserSessions,
} from '../auth/session.ts';
import { setSessionCookie } from '../auth/cookies.ts';
import { rateLimit } from '../middleware/rate-limit.ts';
import { requireUser } from '../middleware/require-user.ts';
import { requireFreshPassword } from '../middleware/require-fresh-reauth.ts';
import {
  createRoute,
  errorContent,
  jsonContent,
  makeAuthedRouter,
  z,
} from '../openapi/index.ts';

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
 * routes (`/auth/totp/disable`, `/auth/passkeys/:id/remove`); this
 * route only handles upgrades / explicit re-selections.
 */
export const authSecurityModeRoutes = makeAuthedRouter();

const limiter = rateLimit({
  max: 10,
  windowMs: 15 * 60_000,
  keyPrefix: 'security-mode-change',
});

const SecurityModeChangeResponseSchema = z.object({
  ok: z.literal(true),
  mode: SecurityModeSchema,
});

const changeRoute = createRoute({
  method: 'post',
  path: '/security-mode/change',
  tags: ['auth'],
  summary: 'Change security mode (re-auth gated)',
  middleware: [requireUser, requireFreshPassword, limiter] as const,
  request: {
    body: {
      content: {
        'application/json': { schema: SecurityModeChangeBodySchema },
      },
    },
  },
  responses: {
    200: jsonContent(SecurityModeChangeResponseSchema, 'Mode updated'),
    400: errorContent('Invalid body / TOTP or passkey prerequisite missing'),
    401: errorContent('Unauthenticated or stale re-auth'),
    429: errorContent('Rate limit exceeded'),
  },
});

authSecurityModeRoutes.openapi(changeRoute, async (c) => {
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

  // Auth-Spec §5.4 — every security-mode change rotates sessions
  // (same policy as change-password). Revoking & re-minting here
  // ensures any other live session of this user that authenticated
  // under the previous policy is forced through a fresh login under
  // the new policy. The caller has just proved password via the
  // `requireFreshPassword` gate, so the new session is stamped
  // fresh wrt password.
  await revokeAllUserSessions(user.id);
  const session = await createSession(user.id, {
    reauthFresh: { password: true },
  });
  await setSessionCookie(c, session.id, session.expiresAt);

  return c.json({ ok: true as const, mode }, 200);
});
