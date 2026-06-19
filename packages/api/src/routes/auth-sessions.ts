import { and, desc, eq, gt } from 'drizzle-orm';
import { z } from 'zod';
import {
  ListActiveSessionsResponseSchema,
  PatchCurrentSessionDeviceLabelBodySchema,
  type ListActiveSessionsResponse,
} from '@nodea/shared';

import { revokeAllUserSessions, revokeSession } from '../auth/session.ts';
import { clearSessionCookie } from '../auth/cookies.ts';
import { db } from '../db/client.ts';
import { sessions } from '../db/schema.ts';
import { getConfig } from '../config.ts';
import { requireFreshPassword } from '../middleware/require-fresh-reauth.ts';
import { requireUser } from '../middleware/require-user.ts';
import {
  createRoute,
  errorContent,
  jsonContent,
  makeAuthedRouter,
  okContent,
} from '../openapi/index.ts';

/**
 * Active sessions API (issue #47).
 *
 * The « Sessions actives » block in Account → Sécurité reads from
 * `GET /auth/sessions`, revokes via `DELETE /auth/sessions/:id`,
 * and bulk-logs-out via `POST /auth/logout-all`. The dedicated
 * device label is written by the client right after login via
 * `PATCH /auth/sessions/current/device-label` (encrypted ; the
 * server never sees the cleartext UA).
 *
 * Privacy invariants (cf. issue thread):
 * - The server never captures `User-Agent` server-side. The
 *   metadata for the UI comes exclusively from the encrypted blob
 *   the client uploads.
 * - No IP is exposed to the UI. The legacy `ip_hash` /
 *   `user_agent` columns are nullable and unused — kept only for
 *   migration back-compat until the next destructive cleanup.
 */
export const authSessionsRoutes = makeAuthedRouter();

const listSessionsRoute = createRoute({
  method: 'get',
  path: '/sessions',
  tags: ['auth-sessions'],
  summary: 'List the caller\'s active full sessions',
  middleware: [requireUser] as const,
  responses: {
    200: jsonContent(
      ListActiveSessionsResponseSchema,
      'Array of active full sessions',
    ),
    401: errorContent('Unauthenticated'),
  },
});

const RevokeSessionParamsSchema = z.object({
  id: z.string().min(1),
});

const revokeSessionRoute = createRoute({
  method: 'delete',
  path: '/sessions/:id',
  tags: ['auth-sessions'],
  summary: 'Revoke one of the caller\'s sessions (not the current one)',
  middleware: [requireUser, requireFreshPassword] as const,
  request: { params: RevokeSessionParamsSchema },
  responses: {
    200: okContent('Session revoked'),
    400: errorContent('Cannot revoke the current session via this route'),
    401: errorContent('Unauthenticated or stale re-auth'),
    404: errorContent('Session not found or not owned by the caller'),
  },
});

const logoutAllRoute = createRoute({
  method: 'post',
  path: '/logout-all',
  tags: ['auth-sessions'],
  summary: 'Revoke every session of the caller, including current',
  middleware: [requireUser, requireFreshPassword] as const,
  responses: {
    200: okContent('All sessions revoked'),
    401: errorContent('Unauthenticated or stale re-auth'),
  },
});

const patchDeviceLabelRoute = createRoute({
  method: 'patch',
  path: '/sessions/current/device-label',
  tags: ['auth-sessions'],
  summary: 'Write the encrypted device label of the current session',
  middleware: [requireUser] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: PatchCurrentSessionDeviceLabelBodySchema,
        },
      },
    },
  },
  responses: {
    200: okContent('Label stored'),
    400: errorContent('Invalid body'),
    401: errorContent('Unauthenticated'),
  },
});

/* ============================================================================
 * Handlers
 * ========================================================================== */

authSessionsRoutes.openapi(listSessionsRoute, async (c) => {
  const user = c.get('user');
  const currentSessionId = c.get('sessionId');
  // Only surface live sessions : not past `expires_at`, and within the
  // fixed TTL window (Auth-Spec §5.1 "no slide"). Mirrors the cutoff
  // `resolveSession` applies on read, so the list never shows a row the
  // user couldn't actually be authenticated on — including legacy rows
  // minted under the old 30-day TTL, before the daily cron prunes them.
  const now = new Date();
  const ttlCutoff = new Date(now.getTime() - getConfig().SESSION_TTL_SECONDS * 1000);
  const rows = await db
    .select({
      id: sessions.id,
      createdAt: sessions.createdAt,
      lastSeenAt: sessions.lastSeenAt,
      deviceLabelCipher: sessions.deviceLabelCipher,
      deviceLabelIv: sessions.deviceLabelIv,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, user.id),
        eq(sessions.kind, 'full'),
        gt(sessions.expiresAt, now),
        gt(sessions.createdAt, ttlCutoff),
      ),
    )
    .orderBy(desc(sessions.createdAt));
  const response: ListActiveSessionsResponse = {
    sessions: rows.map((r) => ({
      id: r.id,
      isCurrent: r.id === currentSessionId,
      createdAt: r.createdAt.toISOString(),
      lastSeenAt: r.lastSeenAt ? r.lastSeenAt.toISOString() : null,
      deviceLabelCipher: r.deviceLabelCipher,
      deviceLabelIv: r.deviceLabelIv,
    })),
  };
  return c.json(response, 200);
});

authSessionsRoutes.openapi(revokeSessionRoute, async (c) => {
  const user = c.get('user');
  const currentSessionId = c.get('sessionId');
  const { id } = c.req.valid('param');

  // Forbid revoking the current session through this route — the
  // user should call `/auth/logout` for that, which also clears
  // the cookie. Treating « delete current » as a 400 keeps the
  // contract crisp (the UI greys out the « Révoquer » button on
  // the current row anyway).
  if (id === currentSessionId) {
    return c.json({ error: 'cannot_revoke_current' as const }, 400);
  }

  // Constant-time on existence : we only delete WHERE id matches
  // AND the user owns the session. A 404 with no per-row info
  // means we don't leak whether the id refers to another user's
  // session (in which case the delete simply matches 0 rows).
  const result = await db
    .delete(sessions)
    .where(and(eq(sessions.id, id), eq(sessions.userId, user.id)))
    .returning({ id: sessions.id });
  if (result.length === 0) {
    return c.json({ error: 'not_found' as const }, 404);
  }
  return c.json({ ok: true as const }, 200);
});

authSessionsRoutes.openapi(logoutAllRoute, async (c) => {
  const user = c.get('user');
  await revokeAllUserSessions(user.id);
  // Clear the cookie too — the current session was revoked along
  // with the others. The client should redirect to /login.
  clearSessionCookie(c);
  return c.json({ ok: true as const }, 200);
});

authSessionsRoutes.openapi(patchDeviceLabelRoute, async (c) => {
  const sessionId = c.get('sessionId');
  const raw = await c.req.json().catch(() => null);
  const parsed = PatchCurrentSessionDeviceLabelBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' as const }, 400);
  await db
    .update(sessions)
    .set({
      deviceLabelCipher: parsed.data.cipher,
      deviceLabelIv: parsed.data.iv,
    })
    .where(eq(sessions.id, sessionId));
  // The user owns the row by construction (sessionId is whatever
  // their cookie carried, validated by `requireUser`). No need
  // for an extra ownership check.
  // Silent revoke against another user's session is impossible —
  // session ids are 256 bits of unguessable entropy.
  return c.json({ ok: true as const }, 200);
});

// Re-export for the use-case where some other route handler needs
// to revoke on behalf of the user (currently only used by
// integration tests).
export { revokeSession };
