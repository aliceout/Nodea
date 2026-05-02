import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { UserPreferencesBodySchema } from '@nodea/shared/schemas/preferences';
import { db } from '../db/client.ts';
import { userPreferences } from '../db/schema.ts';
import { requireUser, type AuthVariables } from '../middleware/require-user.ts';

/**
 * User preferences — 1:1 on `user_id`, E2E encrypted just like
 * `modules_config`. The server only stores `{ cipher_iv, payload }`;
 * the decrypted payload (theme, language, …) lives in the browser.
 *
 * `requireUser` is the only middleware needed: there is no record id
 * to prove ownership of, the session's user IS the record.
 *
 * **Method choice — PUT, not PATCH** (audit API-04). Same rationale
 * as `/modules-config` : `{ cipher_iv, payload }` is an indivisible
 * pair (decryption requires both), so a partial update has no
 * meaning. PUT = « replace the whole encrypted blob », idempotent.
 */
export const userPreferencesRoutes = new Hono<{ Variables: AuthVariables }>();

userPreferencesRoutes.use('*', requireUser);

userPreferencesRoutes.get('/', async (c) => {
  const user = c.get('user');
  const [row] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, user.id))
    .limit(1);
  if (!row) return c.json({ cipher_iv: null, payload: null });
  return c.json({
    cipher_iv: row.cipherIv,
    payload: row.payload,
    updated_at: row.updatedAt.toISOString(),
  });
});

userPreferencesRoutes.put('/', async (c) => {
  const user = c.get('user');
  const raw = await c.req.json().catch(() => null);
  const parsed = UserPreferencesBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);

  const values = {
    userId: user.id,
    cipherIv: parsed.data.cipher_iv,
    payload: parsed.data.payload,
    updatedAt: new Date(),
  };

  await db
    .insert(userPreferences)
    .values(values)
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        cipherIv: values.cipherIv,
        payload: values.payload,
        updatedAt: values.updatedAt,
      },
    });

  return c.json({
    cipher_iv: values.cipherIv,
    payload: values.payload,
    updated_at: values.updatedAt.toISOString(),
  });
});
