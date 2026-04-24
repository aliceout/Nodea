import { Hono } from 'hono';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { CreateInviteBodySchema } from '@nodea/shared/schemas/auth';
import {
  AnnouncementCreateBodySchema,
  AnnouncementUpdateBodySchema,
} from '@nodea/shared/schemas/announcements';
import { createInvite } from '../auth/invites.ts';
import { db } from '../db/client.ts';
import { announcements, invites, users } from '../db/schema.ts';
import { requireUser, requireAdmin, type AuthVariables } from '../middleware/require-user.ts';
import { serialize as serializeAnnouncement } from './announcements-serialize.ts';

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
      username: users.username,
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
      username: r.username ?? null,
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

// --- Announcements ----------------------------------------------------

/**
 * List every announcement — including inactive and out-of-window ones.
 * The public `/announcements` endpoint in `routes/announcements.ts`
 * filters to the live ones for normal users.
 */
adminRoutes.get('/announcements', async (c) => {
  const rows = await db
    .select()
    .from(announcements)
    .orderBy(desc(announcements.createdAt));
  return c.json({ announcements: rows.map(serializeAnnouncement) });
});

adminRoutes.post('/announcements', async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = AnnouncementCreateBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const body = parsed.data;

  const admin = c.get('user');
  const [row] = await db
    .insert(announcements)
    .values({
      id: randomUUID(),
      title: body.title,
      body: body.body,
      active: body.active,
      startAt: body.startAt ? new Date(body.startAt) : null,
      endAt: body.endAt ? new Date(body.endAt) : null,
      createdBy: admin.id,
    })
    .returning();

  if (!row) return c.json({ error: 'internal_error' }, 500);
  return c.json(serializeAnnouncement(row), 201);
});

adminRoutes.patch('/announcements/:id', async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'missing_id' }, 400);

  const raw = await c.req.json().catch(() => null);
  const parsed = AnnouncementUpdateBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const body = parsed.data;

  const patch: Partial<typeof announcements.$inferInsert> = { updatedAt: new Date() };
  if (body.title !== undefined) patch.title = body.title;
  if (body.body !== undefined) patch.body = body.body;
  if (body.active !== undefined) patch.active = body.active;
  if (body.startAt !== undefined) patch.startAt = body.startAt ? new Date(body.startAt) : null;
  if (body.endAt !== undefined) patch.endAt = body.endAt ? new Date(body.endAt) : null;

  const [row] = await db
    .update(announcements)
    .set(patch)
    .where(eq(announcements.id, id))
    .returning();

  if (!row) return c.json({ error: 'not_found' }, 404);
  return c.json(serializeAnnouncement(row));
});

adminRoutes.delete('/announcements/:id', async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'missing_id' }, 400);

  const result = await db
    .delete(announcements)
    .where(eq(announcements.id, id))
    .returning({ id: announcements.id });

  if (result.length === 0) return c.json({ error: 'not_found' }, 404);
  return c.json({ ok: true });
});
