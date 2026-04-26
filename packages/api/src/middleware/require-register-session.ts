import type { MiddlewareHandler } from 'hono';
import { readRegisterCookie } from '../auth/cookies.ts';
import { resolveSession } from '../auth/session.ts';
import type { User } from '../db/schema.ts';

/**
 * Auth-Spec.md §11.1 — `requireRegisterSession`.
 *
 * Reads the register cookie (`nodea_register`), resolves it to a session
 * of `kind='register'`, and exposes the user + sessionId on the request
 * context. Refuses every other session kind with 401 — the legacy
 * `nodea_session` cookie cannot be used to access register routes,
 * even if its underlying session is valid.
 *
 * Used by `GET /auth/register/state` (resume helper) and the upcoming
 * `set-password` / `save-recovery-code` / `finish` routes (Phase 2+).
 */
export interface RegisterAuthVariables {
  registerUser: User;
  registerSessionId: string;
}

export const requireRegisterSession: MiddlewareHandler<{
  Variables: RegisterAuthVariables;
}> = async (c, next) => {
  const sessionId = await readRegisterCookie(c);
  if (!sessionId) return c.json({ error: 'no_register_session' }, 401);
  const user = await resolveSession(sessionId, 'register');
  if (!user) return c.json({ error: 'no_register_session' }, 401);
  c.set('registerUser', user);
  c.set('registerSessionId', sessionId);
  await next();
};
