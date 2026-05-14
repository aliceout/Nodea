import type { MiddlewareHandler } from 'hono';
import { getSessionReauth } from '../auth/session.ts';
import type { AuthVariables } from './require-user.ts';

/**
 * Re-auth freshness middlewares (Auth-Roadmap Phase 7A,
 * Auth-Spec §5.3 + §6).
 *
 * Mutating Settings actions need a recent factor proof — the
 * matrix in §6 dictates whether password is mandatory or whether a
 * passkey assertion suffices. We track freshness server-side via
 * `sessions.reauth_password_at` / `reauth_passkey_at` (stamped on
 * every successful auth path, plus the dedicated `/auth/reauth/*`
 * endpoints). The middleware just checks the timestamp window.
 *
 * Window is 5 minutes. Both middlewares chain AFTER `requireUser`
 * so the session id is already in the context.
 *
 * On miss, we 401 with a discriminated body so the SPA knows
 * which re-auth modal to surface:
 *
 *   { error: 'reauth_required', reauth_required: 'password' }
 *   { error: 'reauth_required', reauth_required: 'password_or_passkey' }
 */

const FRESH_WINDOW_MS = 5 * 60 * 1000;

function isFresh(t: Date | null, now: number): boolean {
  if (t === null) return false;
  return now - t.getTime() <= FRESH_WINDOW_MS;
}

/**
 * Guard a mutating action that strictly requires a fresh password
 * proof — not a passkey. Used for: change security mode, enroll /
 * disable / regen TOTP, add / remove passkey, regenerate recovery
 * code, change email, logout-all (per §6).
 *
 * Change-password itself is the only spot where a passkey
 * substitutes for password (use `requireFreshPasswordOrPasskey`
 * there).
 */
export const requireFreshPassword: MiddlewareHandler<{
  Variables: AuthVariables;
}> = async (c, next) => {
  const sessionId = c.get('sessionId');
  if (!sessionId) {
    // Defensive — `requireUser` should have set this. If it didn't,
    // surface a 401 rather than crash the handler.
    return c.json({ error: 'unauthenticated' }, 401);
  }
  const reauth = await getSessionReauth(sessionId);
  const now = Date.now();
  if (!reauth || !isFresh(reauth.password, now)) {
    return c.json(
      { error: 'reauth_required', reauth_required: 'password' },
      401,
    );
  }
  await next();
};

/**
 * Guard for actions where the user can refresh access via either
 * factor. The only entry in the matrix today is `/auth/change-
 * password/{start,finish}` — the password is the only credential
 * mutable via an alternative factor (Auth-Spec §6).
 */
export const requireFreshPasswordOrPasskey: MiddlewareHandler<{
  Variables: AuthVariables;
}> = async (c, next) => {
  const sessionId = c.get('sessionId');
  if (!sessionId) {
    return c.json({ error: 'unauthenticated' }, 401);
  }
  const reauth = await getSessionReauth(sessionId);
  const now = Date.now();
  if (!reauth || (!isFresh(reauth.password, now) && !isFresh(reauth.passkey, now))) {
    return c.json(
      {
        error: 'reauth_required',
        reauth_required: 'password_or_passkey',
      },
      401,
    );
  }
  await next();
};
