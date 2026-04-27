import type { MiddlewareHandler } from 'hono';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { sessions, users, type Session, type User } from '../db/schema.ts';
import { readSessionCookie } from '../auth/cookies.ts';

/**
 * Hono Variables exposed by `requireMfaPending`. The handler stores
 * BOTH the user (for any user-shape needs) AND the full session row
 * (so the route can read `mfa_*_verified` flags + the WebAuthn
 * challenge / pending fields).
 */
export interface MfaPendingVariables {
  user: User;
  sessionId: string;
  pendingSession: Session;
}

/**
 * Resolve a `mfa_pending` session from the cookie. Refuses any
 * other kind — a `full` cookie can't be used to drive MFA routes,
 * and a `mfa_pending` cookie can't be used for data routes (cf.
 * `requireUser`, which keeps `kind='full'`). Auth-Spec §5.2:
 * "loadSession refuses any kind mismatch".
 *
 * Same shape as `requireUser` so route handlers can `c.get('user')`
 * uniformly.
 */
export const requireMfaPending: MiddlewareHandler<{
  Variables: MfaPendingVariables;
}> = async (c, next) => {
  const sessionId = await readSessionCookie(c);
  if (!sessionId) return c.json({ error: 'unauthenticated' }, 401);

  const now = new Date();
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.id, sessionId),
        eq(sessions.kind, 'mfa_pending'),
        gt(sessions.expiresAt, now),
      ),
    )
    .limit(1);

  if (!row) return c.json({ error: 'unauthenticated' }, 401);
  c.set('user', row.user);
  c.set('sessionId', sessionId);
  c.set('pendingSession', row.session);
  await next();
};
