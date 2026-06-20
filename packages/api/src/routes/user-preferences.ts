/**
 * `/user-preferences` — read/write the per-user encrypted preferences
 * blob (theme, language, cross-device personalisation).
 *
 * Where: api route layer, mounted at `/user-preferences`.
 *
 * GUARD-EXEMPT, same rationale as modules-config: PK on `user_id` (1:1),
 * the user IS the row, so `requireUser` + scoping suffices — no
 * `requireGuard`. Kept a separate table/route from modules-config so an
 * auditing admin can't read one while touching the other. Writes
 * rate-limited (`user-preferences-put`, 60/min).
 */
import { eq } from 'drizzle-orm';
import { UserPreferencesBodySchema } from '@nodea/shared/schemas/preferences';
import { db } from '../db/client.ts';
import { userPreferences } from '../db/schema.ts';
import { rateLimit } from '../middleware/rate-limit.ts';
import { requireUser } from '../middleware/require-user.ts';
import {
  createRoute,
  errorContent,
  jsonContent,
  makeAuthedRouter,
  z,
} from '../openapi/index.ts';

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
export const userPreferencesRoutes = makeAuthedRouter();

// User preferences are written when the user toggles a setting. The
// limiter is generous (60/min) so debounced theme / language toggles
// don't trip the bucket on fast-clickers, but tight enough that a
// runaway client can't pin the row at thousands of writes / second.
const userPreferencesWriteLimiter = rateLimit({
  max: 60,
  windowMs: 60_000,
  keyPrefix: 'user-preferences-put',
});

const UserPreferencesResponseSchema = z.object({
  cipherIv: z.string().nullable(),
  payload: z.string().nullable(),
  updatedAt: z.iso.datetime().optional(),
});

const getUserPreferencesRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['user-preferences'],
  summary: 'Read current user preferences (encrypted)',
  middleware: [requireUser] as const,
  responses: {
    200: jsonContent(UserPreferencesResponseSchema, 'Current preferences blob'),
    401: errorContent('Unauthenticated'),
  },
});

const putUserPreferencesRoute = createRoute({
  method: 'put',
  path: '/',
  tags: ['user-preferences'],
  summary: 'Replace user preferences (atomic, encrypted blob)',
  middleware: [userPreferencesWriteLimiter, requireUser] as const,
  request: {
    body: {
      content: {
        'application/json': { schema: UserPreferencesBodySchema },
      },
    },
  },
  responses: {
    200: jsonContent(UserPreferencesResponseSchema, 'Updated preferences blob'),
    400: errorContent('Invalid body'),
    401: errorContent('Unauthenticated'),
  },
});

userPreferencesRoutes.openapi(getUserPreferencesRoute, async (c) => {
  const user = c.get('user');
  const [row] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, user.id))
    .limit(1);
  if (!row) return c.json({ cipherIv: null, payload: null }, 200);
  return c.json(
    {
      cipherIv: row.cipherIv,
      payload: row.payload,
      updatedAt: row.updatedAt.toISOString(),
    },
    200,
  );
});

userPreferencesRoutes.openapi(putUserPreferencesRoute, async (c) => {
  const user = c.get('user');
  const raw = await c.req.json().catch(() => null);
  const parsed = UserPreferencesBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);

  const values = {
    userId: user.id,
    cipherIv: parsed.data.cipherIv,
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

  return c.json(
    {
      cipherIv: values.cipherIv,
      payload: values.payload,
      updatedAt: values.updatedAt.toISOString(),
    },
    200,
  );
});
