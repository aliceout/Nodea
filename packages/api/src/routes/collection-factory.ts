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
import { requireUser } from '../middleware/require-user.ts';
import { requireGuard, type GuardVariables } from '../middleware/require-guard.ts';
import {
  createRoute,
  errorContent,
  jsonContent,
  okContent,
  z,
} from '../openapi/index.ts';

/**
 * Public view of an entry. The minimum-readable-surface design only
 * exposes :
 *   - `id`             server-generated UUID handle (used in /records/:id)
 *   - `moduleUserId`   the access scope sid
 *   - `cipherIv`       AES-GCM IV (required to decrypt the payload)
 *   - `payload`        encrypted JSON
 *
 * `guard` is never returned (it's the shared secret authenticating
 * mutations). Timestamps are not stored at all server-side ; any
 * createdAt / updatedAt the client wants must live inside the
 * encrypted payload (so the operator can't correlate write activity
 * across modules to deanonymise users).
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
  meta: z.object({}).passthrough(),
});

/**
 * Build the 4 REST routes for a given encrypted collection.
 *
 * Authorisation model — **sid + guard only**, restored from the
 * original PocketBase scheme. Entry rows carry no `user_id`, so the
 * server cannot link a row to a specific user even with full DB
 * access. `requireUser` runs first to gate against unauthenticated
 * callers (rate-limit + logging anchor) but the access decision
 * itself depends only on knowing the right `module_user_id` and the
 * right HMAC guard, both of which require the user's main key to
 * compute.
 *
 * Adding a new collection = one line in `collections/registry.ts` ;
 * the factory mounts the same gauntlet for every collection so it
 * is impossible to forget the guard validation.
 */
export function createCollectionRoutes(table: EntryTable) {
  const router = new OpenAPIHono<{ Variables: GuardVariables }>({
    defaultHook: (result, c) => {
      if (!result.success) return c.json({ error: 'invalid_body' }, 400);
      return undefined;
    },
  });

  const listRoute = createRoute({
    method: 'get',
    path: '/records',
    tags: ['records'],
    summary: 'List records for the given access scope (sid)',
    middleware: [requireUser] as const,
    request: {
      headers: z.object({
        'x-sid': z.string().min(1).openapi({ description: 'Module access scope sid' }),
      }),
    },
    responses: {
      200: jsonContent(EntryListResponseSchema, 'Records for the given sid'),
      400: errorContent('Missing X-Sid header'),
      401: errorContent('Unauthenticated'),
    },
  });

  const createRoute_ = createRoute({
    method: 'post',
    path: '/records',
    tags: ['records'],
    summary: 'Create a new encrypted record',
    middleware: [requireUser] as const,
    request: {
      body: {
        content: {
          'application/json': { schema: CreateEntryBodySchema },
        },
      },
    },
    responses: {
      201: jsonContent(EntryViewSchema, 'Record created'),
      400: errorContent('Invalid body'),
      401: errorContent('Unauthenticated'),
      500: errorContent('Insert failed'),
    },
  });

  const updateRoute = createRoute({
    method: 'patch',
    path: '/records/{id}',
    tags: ['records'],
    summary: 'Update an encrypted record (guard-protected)',
    middleware: [requireUser, requireGuard(table)] as const,
    request: {
      params: z.object({ id: z.string() }),
      body: {
        content: {
          'application/json': { schema: UpdateEntryBodySchema },
        },
      },
    },
    responses: {
      200: jsonContent(EntryViewSchema, 'Updated record'),
      400: errorContent('Invalid body or guard already promoted'),
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
    middleware: [requireUser, requireGuard(table)] as const,
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      200: okContent('Deleted'),
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
  // implementation detail, not a guarantee. A `VACUUM FULL`,
  // `pg_repack`, replica failover, or a future replacement of the
  // storage layer can all change the order without notice. We surface
  // a `X-Order: unspecified` header on the response so any future
  // consumer (mobile client, partner SDK) sees the contract without
  // having to read this comment.
  //
  // The scope sid is read from the `X-Sid` header — see
  // `requireGuard` for the rationale (SEC-01 : keep the access
  // identifier and the HMAC guard out of URLs and therefore out of
  // request logs). LIST does not require the guard ; reading rows
  // requires only the sid + an authenticated session.
  router.openapi(listRoute, async (c) => {
    const sid = c.req.header('x-sid');
    if (!sid) return c.json({ error: 'missing_sid' }, 400);

    const rows = await db
      .select()
      .from(table)
      .where(eq(table.moduleUserId, sid));

    c.header('x-order', 'unspecified');
    // Uniform `{ data, meta }` envelope (audit API-06). `meta` is
    // empty for now — order/pagination metadata would land here if
    // it ever ships. Keeping the same envelope across every list
    // endpoint lets the upcoming mobile client share one parser.
    return c.json({ data: rows.map(toView), meta: {} }, 200);
  });

  // --- CREATE (only accepts guard: "init") ---
  router.openapi(createRoute_, async (c) => {
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
    // `c.req.path` is `/<module>/records` here (the path the router
    // saw); `Location` points to the canonical sub-URL of the new
    // row (API-05). Even when no `GET /<module>/records/:id` exists
    // today, the convention lets future tooling resolve the resource
    // without inferring the URL.
    c.header('location', `${c.req.path}/${row.id}`);
    return c.json(toView(row), 201);
  });

  // --- UPDATE (guard-protected; supports one-time promotion init → g_...) ---
  router.openapi(updateRoute, async (c) => {
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
    const entry = c.get('entry');
    await db.delete(table).where(eq(table.id, entry.id));
    return c.json({ ok: true as const }, 200);
  });

  return router;
}
