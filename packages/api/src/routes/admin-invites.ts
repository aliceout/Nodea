import { and, desc, eq, isNull } from 'drizzle-orm';
import { CreateInviteBodySchema } from '@nodea/shared';
import { createInvite } from '../auth/invites.ts';
import { db } from '../db/client.ts';
import { invites, users } from '../db/schema.ts';
import { requireUser, requireAdmin } from '../middleware/require-user.ts';
import { getConfig } from '../config.ts';
import { getEmailService } from '../services/email/index.ts';
import { renderInviteEmail } from '../services/email/templates/invite.ts';
import { extractEmailLanguage, type SupportedEmailLanguage } from '../services/email/i18n.ts';
import {
  createRoute,
  errorContent,
  jsonContent,
  makeAuthedRouter,
  okContent,
  z,
} from '../openapi/index.ts';

/**
 * Admin / invites sub-router. Owns the email-bound, Bitwarden-style
 * invite lifecycle (create → resend → list → delete). Lives next to
 * the other `admin-*.ts` files and is mounted by `admin.ts`
 * (the barrel) under the global `/admin` prefix from `app.ts`.
 *
 * The clear invite token is NEVER persisted server-side — only its
 * hash. The token only lives in the email link sent to the recipient.
 */
export const adminInvitesRoutes = makeAuthedRouter();

const InviteRowSchema = z.object({
  id: z.string(),
  email: z.string(),
  expiresAt: z.iso.datetime().nullable(),
});
const InviteListItemSchema = InviteRowSchema.extend({
  createdBy: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
const InviteListResponseSchema = z.object({
  data: z.array(InviteListItemSchema),
  meta: z.looseObject({}),
});

const adminMiddlewares = [requireUser, requireAdmin];

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

const createInviteRoute = createRoute({
  method: 'post',
  path: '/invites',
  tags: ['admin-invites'],
  summary: 'Create + email a fresh invite',
  middleware: adminMiddlewares,
  request: { body: { content: { 'application/json': { schema: CreateInviteBodySchema } } } },
  responses: {
    201: jsonContent(InviteRowSchema, 'Invite created'),
    400: errorContent('Invalid body'),
    401: errorContent('Unauthenticated'),
    403: errorContent('Forbidden'),
    409: errorContent('User already exists'),
    502: errorContent('Email send failed'),
  },
});

const resendInviteRoute = createRoute({
  method: 'post',
  path: '/invites/{id}/resend',
  tags: ['admin-invites'],
  summary: 'Re-issue an invite (rotate token + resend email)',
  middleware: adminMiddlewares,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: jsonContent(InviteRowSchema, 'Invite re-issued'),
    400: errorContent('Missing id'),
    401: errorContent('Unauthenticated'),
    403: errorContent('Forbidden'),
    404: errorContent('Invite not found or already used'),
    502: errorContent('Email send failed'),
  },
});

const listInvitesRoute = createRoute({
  method: 'get',
  path: '/invites',
  tags: ['admin-invites'],
  summary: 'List redeemable invites',
  middleware: adminMiddlewares,
  responses: {
    200: jsonContent(InviteListResponseSchema, 'Pending invites'),
    401: errorContent('Unauthenticated'),
    403: errorContent('Forbidden'),
  },
});

const deleteInviteRoute = createRoute({
  method: 'delete',
  path: '/invites/{id}',
  tags: ['admin-invites'],
  summary: 'Delete an unused invite',
  middleware: adminMiddlewares,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: okContent('Invite deleted'),
    400: errorContent('Missing id'),
    401: errorContent('Unauthenticated'),
    403: errorContent('Forbidden'),
    404: errorContent('Invite not found or already used'),
  },
});

/**
 * Send a fresh invite to an email address. Generates a 32-byte token,
 * stores its hash + the email, emails the link to the recipient. The
 * clear token is NEVER surfaced in the response — it lives only in
 * the email's link.
 */
adminInvitesRoutes.openapi(createInviteRoute, async (c) => {
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

  c.header('location', `/admin/invites/${invite.id}`);
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
adminInvitesRoutes.openapi(resendInviteRoute, async (c) => {
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

  return c.json(
    {
      id: refreshed.id,
      email: refreshed.email,
      expiresAt: refreshed.expiresAt.toISOString(),
    },
    200,
  );
});

/**
 * List currently-redeemable invites (never consumed). The clear
 * token is not stored server-side — only the hash — so the response
 * never carries it. UI offers a "Resend" action when the admin needs
 * to surface a fresh link.
 */
adminInvitesRoutes.openapi(listInvitesRoute, async (c) => {
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

  // Uniform `{ data, meta }` envelope (audit API-06).
  return c.json(
    {
      data: rows.map((r) => ({
        id: r.id,
        email: r.email,
        createdBy: r.createdBy,
        expiresAt: r.expiresAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      meta: {},
    },
    200,
  );
});

/** Delete an unused invite. Used ones are immutable audit history. */
adminInvitesRoutes.openapi(deleteInviteRoute, async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'missing_id' }, 400);

  const result = await db
    .delete(invites)
    .where(and(eq(invites.id, id), isNull(invites.usedBy)))
    .returning({ id: invites.id });

  if (result.length === 0) return c.json({ error: 'not_found_or_used' }, 404);
  return c.json({ ok: true as const }, 200);
});
