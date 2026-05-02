import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { ModulesConfigBodySchema } from '@nodea/shared/schemas/entries';
import { db } from '../db/client.ts';
import { modulesConfig } from '../db/schema.ts';
import { requireUser, type AuthVariables } from '../middleware/require-user.ts';

/**
 * Modules config — per-user settings (which modules are active + per-module
 * opaque encrypted blobs). The table is keyed PK on `user_id` (1:1), so
 * `requireUser` is sufficient; no HMAC guard is needed because:
 *
 *   - Every mutation and read is scoped by the session's user id.
 *   - There is no record id exposed client-side: the user IS the record.
 *   - There is no "rotating" shared state the client needs to prove it
 *     knew before — a compromised server could tamper with this payload,
 *     but so it could with the user row itself; the mitigation for that
 *     is the E2E encryption of `payload`, not an extra guard.
 *
 * This exemption is intentional and documented in CLAUDE.md and the
 * Migration Roadmap.
 *
 * **Method choice — PUT, not PATCH** (audit API-04). The body
 * `{ cipher_iv, payload }` is an indivisible pair: an IV without its
 * ciphertext (or a ciphertext without its IV) cannot be decrypted, so
 * a partial update has no meaning here. PUT signals « replace the
 * entire encrypted blob » and is idempotent — two identical calls
 * yield the same row state.
 */
export const modulesConfigRoutes = new Hono<{ Variables: AuthVariables }>();

modulesConfigRoutes.use('*', requireUser);

modulesConfigRoutes.get('/', async (c) => {
  const user = c.get('user');
  const [row] = await db
    .select()
    .from(modulesConfig)
    .where(eq(modulesConfig.userId, user.id))
    .limit(1);
  if (!row) return c.json({ cipherIv: null, payload: null });
  return c.json({
    cipherIv: row.cipherIv,
    payload: row.payload,
    updatedAt: row.updatedAt.toISOString(),
  });
});

modulesConfigRoutes.put('/', async (c) => {
  const user = c.get('user');
  const raw = await c.req.json().catch(() => null);
  const parsed = ModulesConfigBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);

  const values = {
    userId: user.id,
    cipherIv: parsed.data.cipherIv,
    payload: parsed.data.payload,
    updatedAt: new Date(),
  };

  await db
    .insert(modulesConfig)
    .values(values)
    .onConflictDoUpdate({
      target: modulesConfig.userId,
      set: {
        cipherIv: values.cipherIv,
        payload: values.payload,
        updatedAt: values.updatedAt,
      },
    });

  return c.json({
    cipherIv: values.cipherIv,
    payload: values.payload,
    updatedAt: values.updatedAt.toISOString(),
  });
});
