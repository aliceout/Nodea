import { Hono } from 'hono';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
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
import { probeLibraryProviders } from '../lookup/dispatcher.ts';
import {
  isOpenRegistration,
  setOpenRegistration,
} from '../services/settings.ts';
import { getConfig } from '../config.ts';
import { getEmailService } from '../services/email/index.ts';
import { renderInviteEmail } from '../services/email/templates/invite.ts';
import { extractEmailLanguage, type SupportedEmailLanguage } from '../services/email/i18n.ts';
import type { AdminSourcesResponse } from '@nodea/shared';

export const adminRoutes = new Hono<{ Variables: AuthVariables }>();

adminRoutes.use('*', requireUser, requireAdmin);

// --- Invites (email-bound, Bitwarden-style) ---------------------------

/**
 * Build the absolute URL the invite link should point at. Reads
 * `WEB_BASE_URL` from config and falls back to a relative URL when
 * unset — the email will still work in dev where the recipient
 * already has the right origin in their browser, just less polished.
 */
function buildInviteLink(token: string): string {
  const base = (getConfig().WEB_BASE_URL ?? '').replace(/\/$/, '');
  const encoded = encodeURIComponent(token);
  return base ? `${base}/register?invite=${encoded}` : `/register?invite=${encoded}`;
}

async function sendInviteMail(
  email: string,
  token: string,
  language: SupportedEmailLanguage,
): Promise<void> {
  const link = buildInviteLink(token);
  const rendered = renderInviteEmail({ link, language });
  await getEmailService().send({
    to: email,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    tag: 'admin-invite',
  });
}

/**
 * Send a fresh invite to an email address. Generates a 32-byte token,
 * stores its hash + the email, emails the link to the recipient. The
 * clear token is NEVER surfaced in the response — it lives only in
 * the email's link.
 */
adminRoutes.post('/invites', async (c) => {
  const raw = await c.req.json().catch(() => ({}));
  const parsed = CreateInviteBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);

  const admin = c.get('user');
  const email = parsed.data.email.toLowerCase();

  // Prevent inviting an already-existing user. The check is fail-loud
  // for admins — anti-enumeration doesn't apply (the admin already
  // sees the user list anyway).
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) {
    return c.json({ error: 'user_already_exists' }, 409);
  }

  const opts: Parameters<typeof createInvite>[0] = {
    email,
    createdBy: admin.id,
  };
  if (parsed.data.expiresAt) opts.expiresAt = new Date(parsed.data.expiresAt);

  const invite = await createInvite(opts);

  try {
    await sendInviteMail(invite.email, invite.token, extractEmailLanguage(c));
  } catch (err) {

    console.error('[admin/invites] email send failed', err);
    // Surface to admin since they need to know the email didn't fly.
    return c.json({ error: 'email_send_failed' }, 502);
  }

  return c.json(
    {
      id: invite.id,
      email: invite.email,
      expiresAt: invite.expiresAt.toISOString(),
    },
    201,
  );
});

/**
 * Re-issue an invite: generate a fresh token (the old one becomes
 * unusable since `code_hash` is overwritten), reset `expires_at`,
 * and send a new email. Used when the recipient says "I never got
 * the link" or the link expired.
 */
adminRoutes.post('/invites/:id/resend', async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'missing_id' }, 400);

  const admin = c.get('user');

  const [existing] = await db
    .select()
    .from(invites)
    .where(and(eq(invites.id, id), isNull(invites.usedBy)))
    .limit(1);
  if (!existing) return c.json({ error: 'not_found_or_used' }, 404);

  // Re-mint via createInvite, then DELETE the old row inside a tx so
  // the (email) gets exactly one pending invite at a time.
  const refreshed = await db.transaction(async (tx) => {
    await tx.delete(invites).where(eq(invites.id, existing.id));
    // Fall back to the global default TTL. Admin can revoke + recreate
    // with a custom expiry if needed.
    return createInvite({ email: existing.email, createdBy: admin.id });
  });

  try {
    await sendInviteMail(refreshed.email, refreshed.token, extractEmailLanguage(c));
  } catch (err) {

    console.error('[admin/invites] resend email failed', err);
    return c.json({ error: 'email_send_failed' }, 502);
  }

  return c.json({
    id: refreshed.id,
    email: refreshed.email,
    expiresAt: refreshed.expiresAt.toISOString(),
  });
});

/**
 * List currently-redeemable invites (never consumed). The clear
 * token is not stored server-side — only the hash — so the response
 * never carries it. UI offers a "Resend" action when the admin needs
 * to surface a fresh link.
 */
adminRoutes.get('/invites', async (c) => {
  const rows = await db
    .select({
      id: invites.id,
      email: invites.email,
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
      email: r.email,
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

// --- App settings -----------------------------------------------------

const SettingsPatchBodySchema = z.object({
  open_registration: z.boolean().optional(),
});

/** Read every setting the UI exposes. Currently just open_registration. */
adminRoutes.get('/settings', async (c) => {
  return c.json({
    open_registration: await isOpenRegistration(),
  });
});

/**
 * Patch one or more settings. Only fields present in the body are
 * touched; absent fields stay as-is. Each setting tracks its
 * `updatedBy` for audit.
 */
adminRoutes.patch('/settings', async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = SettingsPatchBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const admin = c.get('user');

  if (parsed.data.open_registration !== undefined) {
    await setOpenRegistration(parsed.data.open_registration, admin.id);
  }

  return c.json({
    open_registration: await isOpenRegistration(),
  });
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

// --- Sources health (admin "Sources" tab) ----------------------------
//
// Probes every external metadata provider used by the modules and
// reports per-source status: configured (env var present), online
// (endpoint responded ok), responseMs, testFoundResults (the probe
// query returned at least one record), error (when relevant).
//
// `requireAdmin` is enforced at the parent route so non-admins
// never reach here. Each call hits up to 5 providers in parallel,
// bounded by their per-fetch timeout (~6–8 s) so the overall
// response is also bounded.
//
// Phase 2 covers Library only; future modules with their own
// providers (audio-visual when it lands) get an extra entry in the
// response `modules` map without touching the route.
adminRoutes.get('/sources', async (c) => {
  const library = await probeLibraryProviders();
  const response: AdminSourcesResponse = {
    generatedAt: new Date().toISOString(),
    modules: { library },
  };
  return c.json(response);
});
