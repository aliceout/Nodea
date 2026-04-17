import { Hono } from 'hono';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { CreateInviteBodySchema } from '@nodea/shared/schemas/auth';
import { createInvite } from '../auth/invites.ts';
import { db } from '../db/client.ts';
import { invites, users } from '../db/schema.ts';
import { requireUser, requireAdmin, type AuthVariables } from '../middleware/require-user.ts';

export const adminRoutes = new Hono<{ Variables: AuthVariables }>();

adminRoutes.use('*', requireUser, requireAdmin);

// --- Invites ----------------------------------------------------------

/** Mint a new invite code. Returns the clear code once, never again. */
adminRoutes.post('/invites', async (c) => {
  const raw = await c.req.json().catch(() => ({}));
  const parsed = CreateInviteBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);

  const admin = c.get('user');
  const opts: Parameters<typeof createInvite>[0] = { createdBy: admin.id };
  if (parsed.data.expiresAt) opts.expiresAt = new Date(parsed.data.expiresAt);

  const invite = await createInvite(opts);
  return c.json({ id: invite.id, code: invite.code }, 201);
});

/**
 * List currently-redeemable invites (never consumed). We intentionally
 * return only the id + metadata — the clear code is unknown server-side
 * (only the hash is stored) and cannot be surfaced here.
 */
adminRoutes.get('/invites', async (c) => {
  const rows = await db
    .select({
      id: invites.id,
      createdBy: invites.createdBy,
      expiresAt: invites.expiresAt,
      createdAt: invites.createdAt,
    })
    .from(invites)
    .where(isNull(invites.usedBy))
    .orderBy(desc(invites.createdAt));

  return c.json({
    invites: rows.map((r) => ({
      id: r.id,
      createdBy: r.createdBy,
      expiresAt: r.expiresAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

/** Delete an unused invite. Used ones are immutable audit history. */
adminRoutes.delete('/invites/:id', async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'missing_id' }, 400);

  const result = await db
    .delete(invites)
    .where(and(eq(invites.id, id), isNull(invites.usedBy)))
    .returning({ id: invites.id });

  if (result.length === 0) return c.json({ error: 'not_found_or_used' }, 404);
  return c.json({ ok: true });
});

// --- Users ------------------------------------------------------------

/** List every user. Payload never includes password_hash. */
adminRoutes.get('/users', async (c) => {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      onboardingStatus: users.onboardingStatus,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .orderBy(asc(users.email));
  return c.json({
    users: rows.map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role,
      onboardingStatus: r.onboardingStatus,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
});

/**
 * Delete a user and all their data via FK CASCADE (sessions, every
 * *_entries, modules_config). Invites the user created are preserved
 * with `created_by` set to NULL (ON DELETE SET NULL).
 *
 * An admin cannot delete themselves through this endpoint — would be
 * easy to lock yourself out and there's no recovery path.
 */
adminRoutes.delete('/users/:id', async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'missing_id' }, 400);

  const self = c.get('user');
  if (self.id === id) return c.json({ error: 'cannot_delete_self' }, 400);

  const result = await db
    .delete(users)
    .where(eq(users.id, id))
    .returning({ id: users.id });

  if (result.length === 0) return c.json({ error: 'not_found' }, 404);
  return c.json({ ok: true });
});
