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
 * Verify the caller owns the record and provides the correct guard.
 *
 * Query params:
 *   - `sid` = module_user_id
 *   - `d`   = current guard value ("init" before promotion, "g_<hex>" after)
 *
 * Steps:
 *   1. Look up the record by id + userId + moduleUserId — scoping by
 *      userId is the primary authorisation: we never even consider rows
 *      the caller doesn't own.
 *   2. Compare `d` to the stored guard via `timingSafeEqual` — no early
 *      return on mismatch to avoid leaking timing.
 *   3. On success, attach the loaded row to the context so the handler
 *      doesn't re-query.
 *
 * Failure returns 404 for "no such row under this user" and 403 for
 * "wrong guard". The 404/403 split intentionally exposes nothing about
 * the existence of rows owned by other users — unknown id and
 * other-user-id both map to 404.
 */
export function requireGuard(table: EntryTable): MiddlewareHandler<{ Variables: GuardVariables }> {
  return async (c, next) => {
    const user = c.get('user');
    const id = c.req.param('id');
    const sid = c.req.query('sid');
    const d = c.req.query('d');

    if (!id) return c.json({ error: 'missing_id' }, 400);
    if (!sid || !d) return c.json({ error: 'missing_guard_params' }, 400);

    const [row] = await db
      .select()
      .from(table)
      .where(and(eq(table.id, id), eq(table.userId, user.id), eq(table.moduleUserId, sid)))
      .limit(1);

    if (!row) return c.json({ error: 'not_found' }, 404);

    if (!constantTimeEqual(row.guard, d)) {
      return c.json({ error: 'guard_mismatch' }, 403);
    }

    c.set('entry', row);
    await next();
  };
}
