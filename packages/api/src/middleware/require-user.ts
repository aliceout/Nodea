import type { MiddlewareHandler } from 'hono';
import { readSessionCookie } from '../auth/cookies.ts';
import { resolveSession } from '../auth/session.ts';
import type { User } from '../db/schema.ts';

export interface AuthVariables {
  user: User;
  sessionId: string;
}

export const requireUser: MiddlewareHandler<{ Variables: AuthVariables }> = async (c, next) => {
  const sessionId = await readSessionCookie(c);
  if (!sessionId) return c.json({ error: 'unauthenticated' }, 401);
  const user = await resolveSession(sessionId);
  if (!user) return c.json({ error: 'unauthenticated' }, 401);
  c.set('user', user);
  c.set('sessionId', sessionId);
  await next();
};

export const requireAdmin: MiddlewareHandler<{ Variables: AuthVariables }> = async (c, next) => {
  const user = c.get('user');
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'forbidden' }, 403);
  }
  await next();
};
