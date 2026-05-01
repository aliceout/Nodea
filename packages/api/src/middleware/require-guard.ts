import { timingSafeEqual } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.ts';
import type { EntryRow, EntryTable } from '../db/schema.ts';
import type { AuthVariables } from './require-user.ts';

export interface GuardVariables extends AuthVariables {
  entry: EntryRow;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

/**
 * Verify the caller provides the correct guard for the targeted entry.
 *
 * Required headers:
 *   - `X-Sid`   = module_user_id (the access scope identifier)
 *   - `X-Guard` = current guard value ("init" before promotion,
 *                 "g_<hex>" after)
 *
 * **Headers, not query params** — moved out of the URL by SEC-01 so
 * the HMAC guard never lands in `hono/logger()` output, nginx access
 * logs, browser referrer, or any future log shipping pipeline.
 * CLAUDE.md §Error handling forbids logging crypto material ; the
 * guard is HMAC-derived from the main key, so a single leaked log
 * line was enough to let any reader forge mutations on that record.
 *
 * Authorisation model — **sid + guard only**, no `user_id` involvement.
 * The server does not know which user an entry belongs to; access is
 * gated entirely on knowing the right `module_user_id` and the right
 * HMAC guard. Both require the user's main key to compute, so an
 * attacker without the key cannot mutate an entry even with a valid
 * session cookie.
 *
 * Steps:
 *   1. Look up the record by id + moduleUserId — sid is the primary
 *      scope.
 *   2. Compare `X-Guard` to the stored guard via `timingSafeEqual` — no
 *      early return on mismatch to avoid leaking timing.
 *   3. On success, attach the loaded row to the context so the handler
 *      doesn't re-query.
 *
 * Failure returns 404 for "no such row under this sid" and 403 for
 * "wrong guard". The 404/403 split intentionally exposes nothing about
 * existence of rows under other sids — unknown id and other-sid id
 * both map to 404.
 *
 * `requireUser` still runs ahead of this middleware on the route
 * factory so an unauthenticated caller never reaches it ; the user
 * context is kept for logging / rate-limit purposes, not for the
 * authorisation decision itself.
 */
export function requireGuard(table: EntryTable): MiddlewareHandler<{ Variables: GuardVariables }> {
  return async (c, next) => {
    const id = c.req.param('id');
    const sid = c.req.header('x-sid');
    const d = c.req.header('x-guard');

    if (!id) return c.json({ error: 'missing_id' }, 400);
    if (!sid || !d) return c.json({ error: 'missing_guard_params' }, 400);

    const [row] = await db
      .select()
      .from(table)
      .where(and(eq(table.id, id), eq(table.moduleUserId, sid)))
      .limit(1);

    if (!row) return c.json({ error: 'not_found' }, 404);

    if (!constantTimeEqual(row.guard, d)) {
      return c.json({ error: 'guard_mismatch' }, 403);
    }

    c.set('entry', row);
    await next();
  };
}
