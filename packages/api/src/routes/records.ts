import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
  CreateEntryBodySchema,
  EntryViewSchema,
  UpdateEntryBodySchema,
  INIT_GUARD,
} from '@nodea/shared/schemas/entries';
import { OpenAPIHono } from '@hono/zod-openapi';
import { db } from '../db/client.ts';
import type { EntryRow, EntryTable } from '../db/schema.ts';
import type { CollectionDef } from '../collections.ts';
import { requireUser } from '../middleware/require-user.ts';
import {
  requireCollection,
  requireGuard,
  type GuardVariables,
} from '../middleware/require-guard.ts';
import {
  createRoute,
  defaultInvalidBodyHook,
  errorContent,
  jsonContent,
  okContent,
  z,
} from '../openapi/index.ts';

/**
 * Unified records endpoint (issue #67).
 *
 * One router at `/records` for every encrypted collection on the
 * Hono API. The collection name moves from the URL into the
 * `X-Collection` request header — Nginx and Hono's default loggers
 * don't record custom headers, so the server-side activity log no
 * longer reveals which module a given request targeted.
 *
 * The DB schema is unchanged : the 9 collection tables stay
 * separate. The `requireCollection` middleware resolves the header
 * value into the corresponding `EntryTable` and stores it on the
 * request context ; downstream handlers and `requireGuard` use that
 * resolved table.
 *
 * Public view of an entry — minimum-readable-surface :
 *   - `id`             server-generated UUID handle
 *   - `moduleUserId`   the access scope sid
 *   - `cipherIv`       AES-GCM IV (required to decrypt the payload)
 *   - `payload`        encrypted JSON
 *
 * `guard` is never returned (it's the shared secret authenticating
 * mutations). Timestamps are not stored at all server-side ; any
 * `createdAt` / `updatedAt` the client wants must live inside the
 * encrypted payload (so the operator can't correlate write activity
 * across modules to deanonymise users).
 *
 * Authorisation model — **sid + guard only**, restored from the
 * original PocketBase scheme. Entry rows carry no `user_id`, so the
 * server cannot link a row to a specific user even with full DB
 * access. `requireUser` runs first to gate against unauthenticated
 * callers (rate-limit + logging anchor) but the access decision
 * itself depends only on knowing the right `module_user_id` and the
 * right HMAC guard.
 */
function toView(row: EntryRow) {
  return {
    id: row.id,
    moduleUserId: row.moduleUserId,
    cipherIv: row.cipherIv,
    payload: row.payload,
  };
}

const EntryListResponseSchema = z.object({
  data: z.array(EntryViewSchema),
  meta: z.looseObject({}),
});

export function createRecordsRoutes(collections: readonly CollectionDef[]) {
  const byName = new Map<string, EntryTable>(
    collections.map((c) => [c.name, c.table]),
  );

  const router = new OpenAPIHono<{ Variables: GuardVariables }>({
    defaultHook: defaultInvalidBodyHook,
  });

  const collectionResolver = requireCollection(byName);

  const listRoute = createRoute({
    method: 'get',
    path: '/records',
    tags: ['records'],
    summary: 'List records for the given access scope (sid)',
    middleware: [requireUser, collectionResolver] as const,
    request: {
      headers: z.object({
        'x-collection': z.string().min(1).openapi({
          description:
            'Collection name (issue #67) — moves the module identifier out of the URL.',
        }),
        'x-sid': z.string().min(1).openapi({ description: 'Module access scope sid' }),
      }),
    },
    responses: {
      200: jsonContent(EntryListResponseSchema, 'Records for the given sid'),
      400: errorContent('Missing or unknown collection / sid'),
      401: errorContent('Unauthenticated'),
    },
  });

  const createRoute_ = createRoute({
    method: 'post',
    path: '/records',
    tags: ['records'],
    summary: 'Create a new encrypted record',
    middleware: [requireUser, collectionResolver] as const,
    request: {
      headers: z.object({
        'x-collection': z.string().min(1),
      }),
      body: {
        content: {
          'application/json': { schema: CreateEntryBodySchema },
        },
      },
    },
    responses: {
      201: jsonContent(EntryViewSchema, 'Record created'),
      400: errorContent('Invalid body or unknown collection'),
      401: errorContent('Unauthenticated'),
      500: errorContent('Insert failed'),
    },
  });

  const updateRoute = createRoute({
    method: 'patch',
    path: '/records/{id}',
    tags: ['records'],
    summary: 'Update an encrypted record (guard-protected)',
    middleware: [requireUser, collectionResolver, requireGuard] as const,
    request: {
      headers: z.object({
        'x-collection': z.string().min(1),
      }),
      params: z.object({ id: z.string() }),
      body: {
        content: {
          'application/json': { schema: UpdateEntryBodySchema },
        },
      },
    },
    responses: {
      200: jsonContent(EntryViewSchema, 'Updated record'),
      400: errorContent('Invalid body, unknown collection, or guard already promoted'),
      401: errorContent('Unauthenticated'),
      403: errorContent('Guard mismatch'),
      404: errorContent('Record not found'),
      500: errorContent('Update failed'),
    },
  });

  const deleteRoute = createRoute({
    method: 'delete',
    path: '/records/{id}',
    tags: ['records'],
    summary: 'Delete an encrypted record (guard-protected)',
    middleware: [requireUser, collectionResolver, requireGuard] as const,
    request: {
      headers: z.object({
        'x-collection': z.string().min(1),
      }),
      params: z.object({ id: z.string() }),
    },
    responses: {
      200: okContent('Deleted'),
      400: errorContent('Unknown collection'),
      401: errorContent('Unauthenticated'),
      403: errorContent('Guard mismatch'),
      404: errorContent('Record not found'),
    },
  });

  // --- LIST ---
  // Returns rows in their physical insertion order. Server-side
  // ordering by date is no longer possible (no timestamp columns
  // exist) and is intentionally not provided ; the client is
  // expected to order client-side after decrypting the payload.
  //
  // **Contract on order (API-13)** — the response order is
  // **unspecified**. Clients MUST sort after decryption ; the
  // physical insertion order Postgres surfaces today is an
  // implementation detail, not a guarantee.
  router.openapi(listRoute, async (c) => {
    const table = c.get('table');
    const sid = c.req.header('x-sid');
    if (!sid) return c.json({ error: 'missing_sid' }, 400);

    const rows = await db
      .select()
      .from(table)
      .where(eq(table.moduleUserId, sid));

    c.header('x-order', 'unspecified');
    return c.json({ data: rows.map(toView), meta: {} }, 200);
  });

  // --- CREATE (only accepts guard: "init") ---
  router.openapi(createRoute_, async (c) => {
    const table = c.get('table');
    const raw = await c.req.json().catch(() => null);
    const parsed = CreateEntryBodySchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
    const body = parsed.data;

    const id = randomUUID();
    const [row] = await db
      .insert(table)
      .values({
        id,
        moduleUserId: body.sid,
        cipherIv: body.cipherIv,
        payload: body.payload,
        guard: INIT_GUARD,
      })
      .returning();

    if (!row) return c.json({ error: 'insert_failed' }, 500);
    c.header('location', `${c.req.path}/${row.id}`);
    return c.json(toView(row), 201);
  });

  // --- UPDATE (guard-protected; supports one-time promotion init → g_...) ---
  router.openapi(updateRoute, async (c) => {
    const table = c.get('table');
    const entry = c.get('entry');
    const raw = await c.req.json().catch(() => null);
    const parsed = UpdateEntryBodySchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
    const body = parsed.data;

    const updates: Partial<typeof table.$inferInsert> = {};
    if (body.cipherIv !== undefined) updates.cipherIv = body.cipherIv;
    if (body.payload !== undefined) updates.payload = body.payload;

    if (body.guard !== undefined) {
      // Promotion is allowed exactly once: when the current guard is still
      // the sentinel `"init"`. After promotion, the guard is frozen.
      if (entry.guard !== INIT_GUARD) {
        return c.json({ error: 'guard_already_promoted' }, 400);
      }
      updates.guard = body.guard;
    }

    if (Object.keys(updates).length === 0) {
      return c.json(toView(entry), 200);
    }

    const [row] = await db
      .update(table)
      .set(updates)
      .where(eq(table.id, entry.id))
      .returning();

    if (!row) return c.json({ error: 'update_failed' }, 500);
    return c.json(toView(row), 200);
  });

  // --- DELETE (guard-protected) ---
  router.openapi(deleteRoute, async (c) => {
    const table = c.get('table');
    const entry = c.get('entry');
    await db.delete(table).where(eq(table.id, entry.id));
    return c.json({ ok: true as const }, 200);
  });

  return router;
}
