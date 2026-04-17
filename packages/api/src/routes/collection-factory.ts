import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { and, desc, eq } from 'drizzle-orm';
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
 * Public view of an entry. `guard` is never returned — it is the shared
 * secret that authenticates mutations. Emitting it in read responses
 * would defeat its whole purpose.
 */
function toView(row: EntryRow) {
  return {
    id: row.id,
    module_user_id: row.moduleUserId,
    cipher_iv: row.cipherIv,
    payload: row.payload,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

/**
 * Build the 4 REST routes for a given encrypted collection.
 *
 * Every mutation goes through `requireGuard(table)` so the
 * (user, sid, guard) tuple is validated in a single place. There is
 * no way to add a collection without these guarantees — the route
 * factory is parameterised by the Drizzle table itself.
 */
export function createCollectionRoutes(table: EntryTable) {
  const router = new Hono<{ Variables: GuardVariables }>();

  router.use('*', requireUser);

  // --- LIST ---
  router.get('/records', async (c) => {
    const user = c.get('user');
    const sid = c.req.query('sid');
    if (!sid) return c.json({ error: 'missing_sid' }, 400);

    const rows = await db
      .select()
      .from(table)
      .where(and(eq(table.userId, user.id), eq(table.moduleUserId, sid)))
      .orderBy(desc(table.createdAt));

    return c.json({ records: rows.map(toView) });
  });

  // --- CREATE (only accepts guard: "init") ---
  router.post('/records', async (c) => {
    const user = c.get('user');
    const raw = await c.req.json().catch(() => null);
    const parsed = CreateEntryBodySchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
    const body = parsed.data;

    const id = randomUUID();
    const [row] = await db
      .insert(table)
      .values({
        id,
        userId: user.id,
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
    const user = c.get('user');
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

    updates.updatedAt = new Date();

    const [row] = await db
      .update(table)
      .set(updates)
      .where(and(eq(table.id, entry.id), eq(table.userId, user.id)))
      .returning();

    if (!row) return c.json({ error: 'update_failed' }, 500);
    return c.json(toView(row));
  });

  // --- DELETE (guard-protected) ---
  router.delete('/records/:id', requireGuard(table), async (c) => {
    const user = c.get('user');
    const entry = c.get('entry');
    await db.delete(table).where(and(eq(table.id, entry.id), eq(table.userId, user.id)));
    return c.json({ ok: true });
  });

  return router;
}
