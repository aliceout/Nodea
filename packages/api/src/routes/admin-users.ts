/**
 * Admin user management: `GET /admin/users`, `DELETE /admin/users/{id}`.
 *
 * Where: api admin route layer (mounted at `/admin`, behind requireAdmin).
 *
 * Non-obvious: deleting a user cascades to their auth rows + 1:1 tables
 * (sessions, modules_config, …) via FK ON DELETE CASCADE; entry rows carry
 * no user FK and are purged separately. The admin never sees plaintext.
 */
import { asc, eq } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { users } from '../db/schema.ts';
import { requireUser, requireAdmin } from '../middleware/require-user.ts';
import {
  createRoute,
  errorContent,
  jsonContent,
  makeAuthedRouter,
  okContent,
  z,
} from '../openapi/index.ts';

/**
 * Admin / users sub-router. Lists + deletes accounts. A user delete
 * cascades all their data (sessions, every `*_entries`,
 * `modules_config`) via FK CASCADE; invites the deleted user
 * created are preserved with `created_by = NULL`. Mounted by
 * `admin.ts` (the barrel) under `/admin`.
 */
export const adminUsersRoutes = makeAuthedRouter();

const UserListItemSchema = z.object({
  id: z.string(),
  email: z.string(),
  username: z.string().nullable(),
  role: z.string(),
  onboardingStatus: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
const UserListResponseSchema = z.object({
  data: z.array(UserListItemSchema),
  meta: z.looseObject({}),
});

const adminMiddlewares = [requireUser, requireAdmin];

const listUsersRoute = createRoute({
  method: 'get',
  path: '/users',
  tags: ['admin-users'],
  summary: 'List every user',
  middleware: adminMiddlewares,
  responses: {
    200: jsonContent(UserListResponseSchema, 'User list'),
    401: errorContent('Unauthenticated'),
    403: errorContent('Forbidden'),
  },
});

const deleteUserRoute = createRoute({
  method: 'delete',
  path: '/users/{id}',
  tags: ['admin-users'],
  summary: 'Delete a user (cascades all rows)',
  middleware: adminMiddlewares,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: okContent('User deleted'),
    400: errorContent('Missing id or self-delete attempt'),
    401: errorContent('Unauthenticated'),
    403: errorContent('Forbidden'),
    404: errorContent('User not found'),
  },
});

/** List every user. Payload never includes password_hash. */
adminUsersRoutes.openapi(listUsersRoute, async (c) => {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      role: users.role,
      onboardingStatus: users.onboardingStatus,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .orderBy(asc(users.email));
  // Uniform `{ data, meta }` envelope (audit API-06).
  return c.json(
    {
      data: rows.map((r) => ({
        id: r.id,
        email: r.email,
        username: r.username ?? null,
        role: r.role,
        onboardingStatus: r.onboardingStatus,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
      meta: {},
    },
    200,
  );
});

/**
 * Delete a user and all their data via FK CASCADE (sessions, every
 * *_entries, modules_config). Invites the user created are preserved
 * with `created_by` set to NULL (ON DELETE SET NULL).
 *
 * An admin cannot delete themselves through this endpoint — would be
 * easy to lock yourself out and there's no recovery path.
 */
adminUsersRoutes.openapi(deleteUserRoute, async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'missing_id' }, 400);

  const self = c.get('user');
  if (self.id === id) return c.json({ error: 'cannot_delete_self' }, 400);

  const result = await db
    .delete(users)
    .where(eq(users.id, id))
    .returning({ id: users.id });

  if (result.length === 0) return c.json({ error: 'not_found' }, 404);
  return c.json({ ok: true as const }, 200);
});
