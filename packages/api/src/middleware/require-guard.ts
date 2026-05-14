import { timingSafeEqual } from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.ts';
import type { EntryRow, EntryTable } from '../db/schema.ts';
import type { AuthVariables } from './require-user.ts';

export interface GuardVariables extends AuthVariables {
  entry: EntryRow;
  /** Set by `requireCollection` so downstream handlers can run the
   *  right table query without re-reading the X-Collection header. */
  table: EntryTable;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

/**
 * Resolve the target collection table from the `X-Collection`
 * request header. Issue #67 (b1) — the URL has been collapsed to a
 * single `/records` endpoint so Nginx access logs no longer reveal
 * which module is being touched. The module identifier moves into a
 * custom HTTP header instead (default Nginx + Hono loggers don't
 * record custom headers).
 *
 * The middleware refuses any X-Collection value that's not in the
 * server-side registry of known collections — defence-in-depth
 * against a forged header trying to query an arbitrary table.
 *
 * Stores the resolved table on the context so `requireGuard` and the
 * route handlers downstream can run their queries without re-parsing
 * the header.
 */
export function requireCollection(
  byName: ReadonlyMap<string, EntryTable>,
): MiddlewareHandler<{ Variables: GuardVariables }> {
  return async (c, next) => {
    const name = c.req.header('x-collection');
    if (!name) return c.json({ error: 'missing_collection' }, 400);
    const table = byName.get(name);
    if (!table) return c.json({ error: 'unknown_collection' }, 400);
    c.set('table', table);
    await next();
  };
}

/**
 * Verify the caller provides the correct guard for the targeted entry.
 *
 * Required headers:
 *   - `X-Collection` = collection name (resolved into a table by
 *                      `requireCollection`, which runs first).
 *   - `X-Sid`        = module_user_id (the access scope identifier)
 *   - `X-Guard`      = current guard value ("init" before promotion,
 *                      "g_<hex>" after)
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
 * `requireUser` + `requireCollection` run ahead of this middleware on
 * the route factory ; an unauthenticated caller never reaches it, and
 * the resolved `table` always exists when this runs.
 */
export const requireGuard: MiddlewareHandler<{ Variables: GuardVariables }> = async (
  c: Context<{ Variables: GuardVariables }>,
  next,
) => {
  const table = c.get('table');
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
