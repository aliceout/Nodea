import { Hono } from 'hono';
import { and, desc, eq, isNull, or, lte, gte } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { announcements } from '../db/schema.ts';
import { requireUser, type AuthVariables } from '../middleware/require-user.ts';
import { serialize } from './announcements-serialize.ts';

/**
 * Public feed of active announcements. Authenticated users only — the
 * content is plaintext but we don't want unauthenticated scrapers.
 *
 * A row is considered "live" when `active = true` AND (now is between
 * `start_at` and `end_at` if set). Admin CRUD lives in
 * `routes/admin.ts` under `/admin/announcements`.
 */
export const announcementsRoutes = new Hono<{ Variables: AuthVariables }>();

announcementsRoutes.get('/', requireUser, async (c) => {
  const now = new Date();
  const limitParam = c.req.query('limit');
  const limit = Math.min(Math.max(Number(limitParam) || 10, 1), 50);

  const rows = await db
    .select()
    .from(announcements)
    .where(
      and(
        eq(announcements.active, true),
        or(isNull(announcements.startAt), lte(announcements.startAt, now)),
        or(isNull(announcements.endAt), gte(announcements.endAt, now)),
      ),
    )
    .orderBy(desc(announcements.createdAt))
    .limit(limit);

  // Uniform `{ data, meta }` envelope (audit API-06).
  return c.json({ data: rows.map(serialize), meta: {} });
});
