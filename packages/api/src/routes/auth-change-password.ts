import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import {
  ChangePasswordFinishBodySchema,
  ChangePasswordStartBodySchema,
  type ChangePasswordStartResponse,
} from '@nodea/shared';

import {
  setSessionCookie,
} from '../auth/cookies.ts';
import {
  createRegistrationResponse,
  opaqueReady,
} from '../auth/opaque.ts';
import {
  consumeChangePasswordPending,
  storeChangePasswordPending,
} from '../auth/opaque-pending-state.ts';
import {
  createSession,
  revokeAllUserSessions,
} from '../auth/session.ts';
import { db } from '../db/client.ts';
import { opaqueRecords, users } from '../db/schema.ts';
import {
  requireFreshPasswordOrPasskey,
} from '../middleware/require-fresh-reauth.ts';
import { requireUser, type AuthVariables } from '../middleware/require-user.ts';

export const authChangePasswordRoutes = new Hono<{ Variables: AuthVariables }>();

/**
 * Change password — step 1 (Phase 7B) : re-auth via either
 * fresh password OR fresh passkey timestamp (matrice §6 —
 * change-password is the one entry where a passkey can
 * substitute). Run OPAQUE `createRegistrationResponse` for
 * the new password, hand the client a single-use
 * `changePasswordToken` to echo at /finish.
 *
 * Two-step flow because OPAQUE registration is itself a
 * 2-round-trip handshake — the client can't compute the new
 * `registrationRecord` without the server's
 * `registrationResponse` first.
 */
authChangePasswordRoutes.post(
  '/change-password/start',
  requireUser,
  requireFreshPasswordOrPasskey,
  async (c) => {
    await opaqueReady;
    const raw = await c.req.json().catch(() => null);
    const parsed = ChangePasswordStartBodySchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
    const body = parsed.data;
    const user = c.get('user');

    let registrationResponse: string;
    try {
      ({ registrationResponse } = createRegistrationResponse({
        userIdentifier: user.email,
        registrationRequest: body.registrationRequest,
      }));
    } catch {
      return c.json({ error: 'invalid_body' }, 400);
    }

    const changePasswordToken = storeChangePasswordPending(user.id, user.email);
    const response: ChangePasswordStartResponse = {
      registrationResponse,
      changePasswordToken,
    };
    return c.json(response);
  },
);

/**
 * Change password — step 2 : replace the envelope + the KEK
 * wrap, rotate the session cookie. Main key isn't re-wrapped
 * (the whole point of the 2-layer wrap is that every existing
 * ciphertext stays readable across password changes).
 *
 * The `changePasswordToken` is consumed here. Mismatch
 * between the token's bound user and the calling session
 * means a privilege confusion attempt — same generic 401
 * either way.
 */
authChangePasswordRoutes.post(
  '/change-password/finish',
  requireUser,
  async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = ChangePasswordFinishBodySchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
    const body = parsed.data;
    const user = c.get('user');

    const pending = consumeChangePasswordPending(body.changePasswordToken);
    if (!pending || pending.userId !== user.id) {
      return c.json({ error: 'invalid_credentials' }, 401);
    }

    await db.transaction(async (tx) => {
      await tx
        .update(opaqueRecords)
        .set({ envelope: body.registrationRecord })
        .where(eq(opaqueRecords.userId, user.id));
      await tx
        .update(users)
        .set({
          wrappedKekPassword: body.wrappedKekPassword,
          wrappedKekPasswordIv: body.wrappedKekPasswordIv,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
    });

    // Revoke all sessions (incl. the caller's) and mint a
    // fresh one so the cookie ID rotates after the privilege
    // change. The OPAQUE proof was just verified above, so
    // the new session is fresh wrt password.
    await revokeAllUserSessions(user.id);
    const session = await createSession(user.id, {
      reauthFresh: { password: true },
    });
    await setSessionCookie(c, session.id, session.expiresAt);

    return c.json({ ok: true });
  },
);
