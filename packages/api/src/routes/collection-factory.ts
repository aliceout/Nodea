import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import {
  CreateEntryBodySchema,
  UpdateEntryBodySchema,
  INIT_GUARD,
} from '@nodea/shared/schemas/entries';
import { db } from '../db/client.ts';
import type { EntryRow, EntryTable } from '../db/schema.ts';
import { requireUser } from '../middleware/require-user.ts';
import { requireGuard, type GuardVariables } from '../middleware/require-guard.ts';

/**
 * Public view of an entry. The minimum-readable-surface design only
 * exposes :
 *   - `id`         server-generated UUID handle (used in /records/:id)
 *   - `module_user_id`  the access scope sid
 *   - `cipher_iv`  AES-GCM IV (required to decrypt the payload)
 *   - `payload`    encrypted JSON
 *
 * `guard` is never returned (it's the shared secret authenticating
 * mutations). Timestamps are not stored at all server-side ; any
 * created_at / updated_at the client wants must live inside the
 * encrypted payload (so the operator can't correlate write activity
 * across modules to deanonymise users).
 */
function toView(row: EntryRow) {
  return {
    id: row.id,
    module_user_id: row.moduleUserId,
    cipher_iv: row.cipherIv,
    payload: row.payload,
  };
}

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
  const router = new Hono<{ Variables: GuardVariables }>();

  router.use('*', requireUser);

  // --- LIST ---
  // Returns rows in their physical insertion order. Server-side
  // ordering by date is no longer possible (no timestamp columns
  // exist) and is intentionally not provided ; the client is
  // expected to order client-side after decrypting the payload.
  //
  // The scope sid is read from the `X-Sid` header — see
  // `requireGuard` for the rationale (SEC-01 : keep the access
  // identifier and the HMAC guard out of URLs and therefore out of
  // request logs). LIST does not require the guard ; reading rows
  // requires only the sid + an authenticated session.
  router.get('/records', async (c) => {
    const sid = c.req.header('x-sid');
    if (!sid) return c.json({ error: 'missing_sid' }, 400);

    const rows = await db
      .select()
      .from(table)
      .where(eq(table.moduleUserId, sid));

    return c.json({ records: rows.map(toView) });
  });

  // --- CREATE (only accepts guard: "init") ---
  router.post('/records', async (c) => {
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
        cipherIv: body.cipher_iv,
        payload: body.payload,
        guard: INIT_GUARD,
      })
      .returning();

    if (!row) return c.json({ error: 'insert_failed' }, 500);
    return c.json(toView(row), 201);
  });

  // --- UPDATE (guard-protected; supports one-time promotion init → g_...) ---
  router.patch('/records/:id', requireGuard(table), async (c) => {
    const entry = c.get('entry');
    const raw = await c.req.json().catch(() => null);
    const parsed = UpdateEntryBodySchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
    const body = parsed.data;

    const updates: Partial<typeof table.$inferInsert> = {};
    if (body.cipher_iv !== undefined) updates.cipherIv = body.cipher_iv;
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
      return c.json(toView(entry));
    }

    const [row] = await db
      .update(table)
      .set(updates)
      .where(eq(table.id, entry.id))
      .returning();

    if (!row) return c.json({ error: 'update_failed' }, 500);
    return c.json(toView(row));
  });

  // --- DELETE (guard-protected) ---
  router.delete('/records/:id', requireGuard(table), async (c) => {
    const entry = c.get('entry');
    await db.delete(table).where(eq(table.id, entry.id));
    return c.json({ ok: true });
  });

  return router;
}
