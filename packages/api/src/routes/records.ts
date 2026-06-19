import { randomUUID } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  BulkCreateEntryBodySchema,
  BulkCreateEntryResponseSchema,
  BulkPromoteGuardsBodySchema,
  BulkPromoteGuardsResponseSchema,
  CreateEntryBodySchema,
  EntryViewSchema,
  UpdateEntryBodySchema,
  WipeBySidBodySchema,
  WipeBySidResponseSchema,
  INIT_GUARD,
} from '@nodea/shared/schemas/entries';
import { OpenAPIHono } from '@hono/zod-openapi';
import { db } from '../db/client.ts';
import type { EntryRow, EntryTable } from '../db/schema.ts';
import type { CollectionDef } from '../collections.ts';
import { rateLimit } from '../middleware/rate-limit.ts';
import { requireUser } from '../middleware/require-user.ts';
import { requireFreshPassword } from '../middleware/require-fresh-reauth.ts';
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

// Per-IP rate limits on the encrypted-record write surface. Picked
// generous enough that a bulk import (50 imports of 500 records via
// the existing 2-RT-per-record path = ~200 RT/min from one client) is
// not throttled, but tight enough that a single misbehaving client
// can't pin the api with 10k record creates per minute. Bumps the
// per-route bucket independently so a read-mostly client isn't
// drained by another tab pushing writes.
const recordsCreateLimiter = rateLimit({
  max: 600,
  windowMs: 60_000,
  keyPrefix: 'records-create',
});
const recordsUpdateLimiter = rateLimit({
  max: 600,
  windowMs: 60_000,
  keyPrefix: 'records-update',
});
// Bulk variants process up to BULK_MAX_ENTRIES (100) rows per call, so
// a 60/min cap matches the same "rows per minute" budget as the
// single-row 600/min limit. Tighter than that breaks legitimate
// import flows (a full archive restore can fan out to many batches).
const recordsBulkCreateLimiter = rateLimit({
  max: 60,
  windowMs: 60_000,
  keyPrefix: 'records-bulk-create',
});
const recordsBulkPromoteLimiter = rateLimit({
  max: 60,
  windowMs: 60_000,
  keyPrefix: 'records-bulk-promote',
});
// Wipe-by-sid is a per-user maintenance action — never expected
// to fire more than a handful of times per session. 10/min/IP
// catches a runaway client without throttling the legitimate use
// case (wiping a multi-collection module via N back-to-back calls).
const recordsWipeLimiter = rateLimit({
  max: 10,
  windowMs: 60_000,
  keyPrefix: 'records-wipe',
});
// LIST and DELETE were the only unthrottled routes on the surface
// (audit 2026-06). Reads are cheap but a scripted scraper hammering
// the full-collection LIST has no business above 300/min ; deletes
// align with the write budget.
const recordsListLimiter = rateLimit({
  max: 300,
  windowMs: 60_000,
  keyPrefix: 'records-list',
});
const recordsDeleteLimiter = rateLimit({
  max: 600,
  windowMs: 60_000,
  keyPrefix: 'records-delete',
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
    middleware: [recordsListLimiter, requireUser, collectionResolver] as const,
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
    middleware: [recordsCreateLimiter, requireUser, collectionResolver] as const,
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

  const bulkCreateRoute = createRoute({
    method: 'post',
    path: '/records/bulk',
    tags: ['records'],
    summary: 'Create up to N encrypted records in one transaction',
    middleware: [recordsBulkCreateLimiter, requireUser, collectionResolver] as const,
    request: {
      headers: z.object({
        'x-collection': z.string().min(1),
      }),
      body: {
        content: {
          'application/json': { schema: BulkCreateEntryBodySchema },
        },
      },
    },
    responses: {
      201: jsonContent(BulkCreateEntryResponseSchema, 'Records created'),
      400: errorContent('Invalid body or unknown collection'),
      401: errorContent('Unauthenticated'),
      500: errorContent('Insert failed'),
    },
  });

  const bulkPromoteRoute = createRoute({
    method: 'post',
    path: '/records/promote-guards',
    tags: ['records'],
    summary: 'Promote multiple init-guards to their HMAC value in one transaction',
    middleware: [recordsBulkPromoteLimiter, requireUser, collectionResolver] as const,
    request: {
      headers: z.object({
        'x-collection': z.string().min(1),
      }),
      body: {
        content: {
          'application/json': { schema: BulkPromoteGuardsBodySchema },
        },
      },
    },
    responses: {
      200: jsonContent(BulkPromoteGuardsResponseSchema, 'Guards promoted'),
      400: errorContent('Invalid body, unknown collection, or some target is not at init guard'),
      401: errorContent('Unauthenticated'),
      404: errorContent('One or more targeted records not found under sid'),
      500: errorContent('Update failed'),
    },
  });

  const wipeRoute = createRoute({
    method: 'post',
    path: '/records/wipe',
    tags: ['records'],
    summary: 'Delete every record under the given sid (re-auth gated)',
    middleware: [
      recordsWipeLimiter,
      requireUser,
      requireFreshPassword,
      collectionResolver,
    ] as const,
    request: {
      headers: z.object({
        'x-collection': z.string().min(1),
      }),
      body: {
        content: {
          'application/json': { schema: WipeBySidBodySchema },
        },
      },
    },
    responses: {
      200: jsonContent(WipeBySidResponseSchema, 'Rows deleted'),
      400: errorContent('Invalid body or unknown collection'),
      401: errorContent('Unauthenticated or re-auth required'),
    },
  });

  const updateRoute = createRoute({
    method: 'patch',
    path: '/records/{id}',
    tags: ['records'],
    summary: 'Update an encrypted record (guard-protected)',
    middleware: [recordsUpdateLimiter, requireUser, collectionResolver, requireGuard] as const,
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
    middleware: [
      recordsDeleteLimiter,
      requireUser,
      collectionResolver,
      requireGuard,
    ] as const,
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

  // --- BULK CREATE (issue #127) ---
  // All entries land with `guard = "init"` and a server-generated id.
  // One multi-value INSERT inside a transaction so the batch is
  // atomic (a Postgres failure halfway through rolls every row back
  // and returns 500). The returned `data` array preserves input
  // order — clients rely on it to derive the per-entry HMAC guard
  // from the ids during the follow-up `/records/promote-guards`
  // call.
  // Per-route validation hook that distinguishes the aggregate-payload
  // size failure (« bulk_payload_too_large ») from the generic
  // « invalid_body ». The size cap is the one schema rule a
  // well-behaved client can run into legitimately ; every other
  // failure is a wire-shape bug. Without a dedicated code the client
  // can't fall back to splitting the batch on its own.
  //
  // Mirrors the @hono/zod-openapi `Hook` signature with the same
  // light typing trick `defaultInvalidBodyHook` uses : we only care
  // about the discriminant + the issues array, no need to drag the
  // full union through the file.
  function bulkCreateInvalidBodyHook(
    result: {
      success: boolean;
      error?: { issues: ReadonlyArray<{ code: string; message: string }> };
    },
    c: Parameters<typeof defaultInvalidBodyHook>[1],
  ) {
    if (!result.success) {
      const tooLarge =
        result.error?.issues.some(
          (i) => i.code === 'custom' && i.message === 'bulk_payload_too_large',
        ) ?? false;
      return c.json(
        { error: tooLarge ? 'bulk_payload_too_large' : 'invalid_body' },
        400,
      );
    }
    return undefined;
  }

  router.openapi(
    bulkCreateRoute,
    async (c) => {
      const table = c.get('table');
      // OpenAPI hook already validated + ran the per-route hook above ;
      // we can safely re-read the parsed body straight from the lib.
      const body = c.req.valid('json');

      const values = body.entries.map((entry) => ({
        id: randomUUID(),
        moduleUserId: body.sid,
        cipherIv: entry.cipherIv,
        payload: entry.payload,
        guard: INIT_GUARD,
      }));

      const rows = await db.transaction(async (tx) => {
        return tx.insert(table).values(values).returning();
      });

      if (rows.length !== values.length) {
        return c.json({ error: 'insert_failed' }, 500);
      }
      return c.json({ data: rows.map(toView) }, 201);
    },
    bulkCreateInvalidBodyHook,
  );

  // --- BULK PROMOTE GUARDS (issue #127) ---
  // Atomic promotion of N init-guards to their final HMAC value.
  // Steps (all inside one transaction) :
  //   1. SELECT every targeted row by id under the caller's sid.
  //   2. Refuse if not all promotions match a row, or any matched
  //      row is no longer at the init guard (already promoted, or
  //      raced).
  //   3. Apply the new guards via N UPDATEs. The transaction makes
  //      this all-or-nothing — a partial failure rolls back so the
  //      client retries from a consistent state.
  // The route does no body / payload mutation ; content updates
  // keep going through the single-row PATCH for now.
  router.openapi(bulkPromoteRoute, async (c) => {
    const table = c.get('table');
    const raw = await c.req.json().catch(() => null);
    const parsed = BulkPromoteGuardsBodySchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
    const body = parsed.data;

    const ids = body.promotions.map((p) => p.id);
    // Defence : reject any duplicate id up-front so the SELECT below
    // can use `inArray` without us double-promoting on collisions.
    if (new Set(ids).size !== ids.length) {
      return c.json({ error: 'invalid_body' }, 400);
    }

    const result = await db.transaction(async (tx) => {
      // `FOR UPDATE` locks the targeted rows for the rest of the
      // transaction. Without it, a concurrent single-row PATCH from
      // another tab could promote a guard between the SELECT below
      // and the UPDATE further down, and we'd silently overwrite the
      // other tab's promoted value with whatever guard the bulk
      // request shipped. The race window is tiny in practice (only
      // happens if the user has two sessions racing on the same
      // freshly-init records) but the cost of the lock is also tiny
      // for ≤ 100 rows.
      const rows = await tx
        .select()
        .from(table)
        .where(and(eq(table.moduleUserId, body.sid), inArray(table.id, ids)))
        .for('update');

      if (rows.length !== ids.length) {
        return { kind: 'not_found' as const };
      }
      if (rows.some((r) => r.guard !== INIT_GUARD)) {
        return { kind: 'guard_already_promoted' as const };
      }

      // Single batched UPDATE instead of one query per promotion: a
      // `CASE WHEN id = … THEN <guard>` over the locked rows. Values stay
      // parameterized (Drizzle `sql` placeholders), so no user input is
      // interpolated. Every targeted id has a matching WHEN branch, so no
      // row is set to NULL.
      const guardCases = body.promotions.map(
        (p) => sql`when ${table.id} = ${p.id} then ${p.guard}`,
      );
      await tx
        .update(table)
        .set({ guard: sql`case ${sql.join(guardCases, sql` `)} end` })
        .where(and(eq(table.moduleUserId, body.sid), inArray(table.id, ids)));
      return { kind: 'ok' as const, promoted: body.promotions.length };
    });

    if (result.kind === 'not_found') return c.json({ error: 'not_found' }, 404);
    if (result.kind === 'guard_already_promoted')
      return c.json({ error: 'guard_already_promoted' }, 400);
    return c.json({ promoted: result.promoted }, 200);
  });

  // --- WIPE BY SID ---
  // Bulk-delete every row whose `module_user_id` matches the sid in
  // the body. Drives the « Vider toutes les entrées » action in
  // Settings → Modules. Re-auth-gated via `requireFreshPassword` —
  // even a stolen session cookie can't trigger the destruction
  // without a fresh password proof in the last 5 minutes.
  //
  // No per-row guard verification : a wipe doesn't operate on the
  // « I know the secret for this specific row » trust model — it's
  // a maintenance op scoped by sid (which is itself crypto material
  // derived from mainKey, like LIST).
  //
  // Threat-model honesty (audit 2026-06) : `requireFreshPassword`
  // proves the CALLER re-typed their own password — it does NOT
  // bind the caller to the sid. The sole inter-user barrier on this
  // destructive route is the secrecy of the sid. That is the
  // documented sid+guard model (same as LIST/CREATE), but unlike a
  // PATCH/DELETE no row-secret is ever demanded ; if a sid ever
  // leaks through a side channel, any fresh-authed account could
  // wipe that module. Exception documented in docs/Database.md
  // alongside the modules_config guard exemption.
  router.openapi(wipeRoute, async (c) => {
    const table = c.get('table');
    const body = c.req.valid('json');

    const deleted = await db
      .delete(table)
      .where(eq(table.moduleUserId, body.sid))
      .returning({ id: table.id });

    return c.json({ deleted: deleted.length }, 200);
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
