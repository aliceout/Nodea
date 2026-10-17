/**
 * Admin announcement CRUD: `GET`/`POST /admin/announcements`,
 * `PATCH`/`DELETE /admin/announcements/{id}`.
 *
 * Where: api admin route layer (mounted at `/admin`, behind requireAdmin).
 * Authors the banners users read via the public `/announcements` feed.
 */
import { desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import {
  AnnouncementCreateBodySchema,
  AnnouncementListResponseSchema,
  AnnouncementResponseSchema,
  AnnouncementUpdateBodySchema,
} from '@nodea/shared';
import { db } from '../db/client.ts';
import { announcements } from '../db/schema.ts';
import { requireUser, requireAdmin } from '../middleware/require-user.ts';
import { serialize as serializeAnnouncement } from './announcements-serialize.ts';
import {
  createRoute,
  errorContent,
  jsonContent,
  makeAuthedRouter,
  okContent,
  z,
} from '../openapi/index.ts';

/**
 * Admin / announcements sub-router. Full CRUD on banners surfaced to
 * end users. The public `/announcements` endpoint in
 * `routes/announcements.ts` filters down to live ones; this router
 * lists everything (incl. inactive / out-of-window). Mounted by
 * `admin.ts` (the barrel) under `/admin`.
 */
export const adminAnnouncementsRoutes = makeAuthedRouter();

const adminMiddlewares = [requireUser, requireAdmin];

const listAnnouncementsAdminRoute = createRoute({
  method: 'get',
  path: '/announcements',
  tags: ['admin-announcements'],
  summary: 'List every announcement (incl. inactive)',
  middleware: adminMiddlewares,
  responses: {
    200: jsonContent(AnnouncementListResponseSchema, 'All announcements'),
    401: errorContent('Unauthenticated'),
    403: errorContent('Forbidden'),
  },
});

const createAnnouncementRoute = createRoute({
  method: 'post',
  path: '/announcements',
  tags: ['admin-announcements'],
  summary: 'Create an announcement',
  middleware: adminMiddlewares,
  request: { body: { content: { 'application/json': { schema: AnnouncementCreateBodySchema } } } },
  responses: {
    201: jsonContent(AnnouncementResponseSchema, 'Announcement created'),
    400: errorContent('Invalid body'),
    401: errorContent('Unauthenticated'),
    403: errorContent('Forbidden'),
    500: errorContent('Internal error'),
  },
});

const updateAnnouncementRoute = createRoute({
  method: 'patch',
  path: '/announcements/{id}',
  tags: ['admin-announcements'],
  summary: 'Update an announcement',
  middleware: adminMiddlewares,
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: AnnouncementUpdateBodySchema } } },
  },
  responses: {
    200: jsonContent(AnnouncementResponseSchema, 'Updated announcement'),
    400: errorContent('Invalid body or missing id'),
    401: errorContent('Unauthenticated'),
    403: errorContent('Forbidden'),
    404: errorContent('Announcement not found'),
  },
});

const deleteAnnouncementRoute = createRoute({
  method: 'delete',
  path: '/announcements/{id}',
  tags: ['admin-announcements'],
  summary: 'Delete an announcement',
  middleware: adminMiddlewares,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: okContent('Announcement deleted'),
    400: errorContent('Missing id'),
    401: errorContent('Unauthenticated'),
    403: errorContent('Forbidden'),
    404: errorContent('Announcement not found'),
  },
});

/**
 * List every announcement — including inactive and out-of-window ones.
 * The public `/announcements` endpoint in `routes/announcements.ts`
 * filters to the live ones for normal users.
 */
adminAnnouncementsRoutes.openapi(listAnnouncementsAdminRoute, async (c) => {
  const rows = await db
    .select()
    .from(announcements)
    .orderBy(desc(announcements.createdAt));
  // Uniform `{ data, meta }` envelope (audit API-06).
  return c.json({ data: rows.map(serializeAnnouncement), meta: {} }, 200);
});

adminAnnouncementsRoutes.openapi(createAnnouncementRoute, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = AnnouncementCreateBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const body = parsed.data;

  const admin = c.get('user');
  const [row] = await db
    .insert(announcements)
    .values({
      id: randomUUID(),
      title: body.title,
      body: body.body,
      active: body.active,
      startAt: body.startAt ? new Date(body.startAt) : null,
      endAt: body.endAt ? new Date(body.endAt) : null,
      createdBy: admin.id,
    })
    .returning();

  if (!row) return c.json({ error: 'internal_error' }, 500);
  c.header('location', `/admin/announcements/${row.id}`);
  return c.json(serializeAnnouncement(row), 201);
});

adminAnnouncementsRoutes.openapi(updateAnnouncementRoute, async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'missing_id' }, 400);

  const raw = await c.req.json().catch(() => null);
  const parsed = AnnouncementUpdateBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const body = parsed.data;

  const patch: Partial<typeof announcements.$inferInsert> = { updatedAt: new Date() };
  if (body.title !== undefined) patch.title = body.title;
  if (body.body !== undefined) patch.body = body.body;
  if (body.active !== undefined) patch.active = body.active;
  if (body.startAt !== undefined) patch.startAt = body.startAt ? new Date(body.startAt) : null;
  if (body.endAt !== undefined) patch.endAt = body.endAt ? new Date(body.endAt) : null;

  const [row] = await db
    .update(announcements)
    .set(patch)
    .where(eq(announcements.id, id))
    .returning();

  if (!row) return c.json({ error: 'not_found' }, 404);
  return c.json(serializeAnnouncement(row), 200);
});

adminAnnouncementsRoutes.openapi(deleteAnnouncementRoute, async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'missing_id' }, 400);

  const result = await db
    .delete(announcements)
    .where(eq(announcements.id, id))
    .returning({ id: announcements.id });

  if (result.length === 0) return c.json({ error: 'not_found' }, 404);
  return c.json({ ok: true as const }, 200);
});
