/**
 * Public announcement feed: `GET /announcements` — active banners for the
 * signed-in user.
 *
 * Where: api route layer, mounted at `/announcements` (requireUser, read-
 * only; authoring is admin-only via `/admin/announcements`).
 *
 * Non-obvious: "active" is a time-window filter (publish/expiry bounds)
 * computed in the query; serialization is shared via
 * `announcements-serialize.ts`.
 */
import { and, desc, eq, isNull, or, lte, gte } from 'drizzle-orm';
import { AnnouncementListResponseSchema } from '@nodea/shared';
import { db } from '../db/client.ts';
import { announcements } from '../db/schema.ts';
import { requireUser } from '../middleware/require-user.ts';
import {
  createRoute,
  errorContent,
  jsonContent,
  makeAuthedRouter,
  z,
} from '../openapi/index.ts';
import { serializePublic } from './announcements-serialize.ts';

/**
 * Public feed of active announcements. Authenticated users only — the
 * content is plaintext but we don't want unauthenticated scrapers.
 *
 * A row is considered "live" when `active = true` AND (now is between
 * `start_at` and `end_at` if set). Admin CRUD lives in
 * `routes/admin.ts` under `/admin/announcements`.
 */
export const announcementsRoutes = makeAuthedRouter();

const listAnnouncementsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['announcements'],
  summary: 'List live announcements',
  middleware: [requireUser] as const,
  request: {
    query: z.object({
      limit: z.string().optional().openapi({ example: '10' }),
    }),
  },
  responses: {
    200: jsonContent(AnnouncementListResponseSchema, 'Live announcements'),
    401: errorContent('Unauthenticated'),
  },
});

announcementsRoutes.openapi(listAnnouncementsRoute, async (c) => {
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
  return c.json({ data: rows.map(serializePublic), meta: {} }, 200);
});
