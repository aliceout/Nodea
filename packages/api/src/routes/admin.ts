import { Hono } from 'hono';
import { CreateInviteBodySchema } from '@nodea/shared/schemas/auth';
import { createInvite } from '../auth/invites.ts';
import { requireUser, requireAdmin, type AuthVariables } from '../middleware/require-user.ts';

export const adminRoutes = new Hono<{ Variables: AuthVariables }>();

adminRoutes.use('*', requireUser, requireAdmin);

adminRoutes.post('/invites', async (c) => {
  const raw = await c.req.json().catch(() => ({}));
  const parsed = CreateInviteBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);

  const admin = c.get('user');
  const opts: Parameters<typeof createInvite>[0] = { createdBy: admin.id };
  if (parsed.data.expiresAt) opts.expiresAt = new Date(parsed.data.expiresAt);

  const invite = await createInvite(opts);
  // Return the clear code exactly once — the server never keeps a copy.
  return c.json({ id: invite.id, code: invite.code }, 201);
});
