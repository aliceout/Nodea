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
 *     `password_or_passkey`, `always_2fa`, and `maximum`. Validates
 *     the prerequisites (always_2fa: TOTP enabled OR a passkey
 *     enrolled — issue #72 made both acceptable as the 2nd factor
 *     at login, so both unlock activation; maximum: TOTP enabled
 *     AND a PRF-capable passkey) and refuses with a clear 400 error
 *     code when they're not met (`second_factor_required` /
 *     `totp_required` / `passkey_required`).
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

/** Aborts the activation transaction carrying the wire error code to return.
 *  Caught just outside the tx so a failed gate rolls back with no partial
 *  write (audit 2026-07 — the gate + write used to run un-transactioned). */
class GateError extends Error {
  constructor(
    readonly code:
      | 'second_factor_required'
      | 'totp_required'
      | 'passkey_required',
  ) {
    super(code);
  }
}

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
  // always reachable; `always_2fa` needs a 2nd factor available
  // (TOTP enabled OR at least one passkey enrolled — issue #72
  // accepted both at login, so accept both at activation too);
  // `maximum` keeps the strict requirement of TOTP enabled AND
  // at least one PRF-capable passkey.
  // Activation gate + mode write in ONE transaction, behind a row lock on the
  // user, so a concurrent factor-removal + §6.1 downgrade (e.g. /auth/totp/
  // disable on another tab) can't slip between the gate reads and the write
  // and persist a stricter-than-satisfiable mode (audit 2026-07). The lock
  // serialises against the downgrade's `UPDATE users`, so the gate reads
  // observe the same factor set the write commits under.
  try {
    await db.transaction(async (tx) => {
      await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, user.id))
        .for('update');

      if (mode === 'always_2fa') {
        const [totp] = await tx
          .select({ enabledAt: mfaTotp.enabledAt })
          .from(mfaTotp)
          .where(eq(mfaTotp.userId, user.id))
          .limit(1);
        const hasTotp = !!totp && totp.enabledAt !== null;
        if (!hasTotp) {
          const [anyPasskey] = await tx
            .select({ id: authFactors.id })
            .from(authFactors)
            .where(
              and(
                eq(authFactors.userId, user.id),
                eq(authFactors.kind, 'passkey'),
              ),
            )
            .limit(1);
          if (!anyPasskey) throw new GateError('second_factor_required');
        }
      }
      if (mode === 'maximum') {
        const [totp] = await tx
          .select({ enabledAt: mfaTotp.enabledAt })
          .from(mfaTotp)
          .where(eq(mfaTotp.userId, user.id))
          .limit(1);
        if (!totp || totp.enabledAt === null) throw new GateError('totp_required');
        const [prf] = await tx
          .select({ id: authFactors.id })
          .from(authFactors)
          .where(
            and(
              eq(authFactors.userId, user.id),
              eq(authFactors.prfSupported, true),
            ),
          )
          .limit(1);
        if (!prf) throw new GateError('passkey_required');
      }

      await tx
        .update(users)
        .set({ securityMode: mode, updatedAt: new Date() })
        .where(eq(users.id, user.id));
    });
  } catch (e) {
    if (e instanceof GateError) return c.json({ error: e.code }, 400);
    throw e;
  }

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
