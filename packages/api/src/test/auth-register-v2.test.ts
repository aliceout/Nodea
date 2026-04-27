/**
 * Integration tests for the email-bound invite + open-registration
 * model (Auth-Roadmap Phase 1, post-rework v2).
 *
 * Routes under test:
 *   - GET  /auth/register/mode
 *   - GET  /auth/register/invite-info?token=…
 *   - POST /auth/register                 (invited + open + closed)
 *   - POST /auth/register/activate        (open path activation)
 *   - POST /auth/login                    (activation gate)
 *
 * Real Postgres + the in-memory `RecordingEmailService` (forced via
 * `vitest.config.ts`).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../app.ts';
import { db } from '../db/client.ts';
import { emailVerifications, invites, users } from '../db/schema.ts';
import { __getRecordingEmailService } from '../services/email/index.ts';
import { setOpenRegistration } from '../services/settings.ts';
import { hashToken } from '../auth/email-verifications.ts';
import { seedAdmin, seedInvite, seedUser } from './helpers.ts';

const app = buildApp();
const recording = __getRecordingEmailService();

const REG_PASSWORD = 'Brand-New-Test-Pass-99';

function jsonPost(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function submitBody(opts: {
  email: string;
  password?: string;
  inviteToken?: string;
}) {
  return {
    email: opts.email,
    password: opts.password ?? REG_PASSWORD,
    encryptionSalt: 'salt-base64',
    encryptedKey: 'wrapped-key-base64',
    ...(opts.inviteToken ? { inviteToken: opts.inviteToken } : {}),
  };
}

function extractTokenFromLatestActivationMail(): string {
  const mail = recording.latestByTag('register-activate');
  if (!mail) throw new Error('no register-activate mail recorded');
  const match = mail.text.match(/token=([A-Za-z0-9_-]{16,})/);
  if (!match || !match[1]) {
    throw new Error(`no activation token in mail body:\n${mail.text}`);
  }
  return decodeURIComponent(match[1]);
}

beforeEach(async () => {
  // Default for every test: open_registration OFF. Tests that need
  // it on call setOpenRegistration(true) explicitly.
  // (The settings table is wiped by the global TRUNCATE in setup.ts,
  // so the default-off behavior is what reads return.)
});

/* ============================================================================
 * GET /auth/register/mode
 * ========================================================================== */

describe('GET /auth/register/mode', () => {
  it('reports open_registration false by default', async () => {
    const res = await app.request('/auth/register/mode');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ openRegistration: false });
  });

  it('reflects the admin toggle', async () => {
    const admin = await seedAdmin('mode-admin@example.com');
    await setOpenRegistration(true, admin.id);
    const res = await app.request('/auth/register/mode');
    expect(await res.json()).toEqual({ openRegistration: true });
  });
});

/* ============================================================================
 * GET /auth/register/invite-info
 * ========================================================================== */

describe('GET /auth/register/invite-info', () => {
  it('returns the email a valid token was issued for', async () => {
    const invite = await seedInvite('target@example.com');
    const res = await app.request(
      `/auth/register/invite-info?token=${encodeURIComponent(invite.token)}`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { email: string; expiresAt: string | null };
    expect(body.email).toBe('target@example.com');
    expect(body.expiresAt).toBeTruthy();
  });

  it('404s on an unknown token', async () => {
    const res = await app.request(
      '/auth/register/invite-info?token=totally-bogus-token-xxxxxxxxxxxxxxxxxx',
    );
    expect(res.status).toBe(404);
  });

  it('404s when the token query is missing', async () => {
    const res = await app.request('/auth/register/invite-info');
    expect(res.status).toBe(404);
  });

  it('404s on an already-used token', async () => {
    const invite = await seedInvite('used@example.com');
    const burner = await seedUser('burner-info@example.com');
    await db
      .update(invites)
      .set({ usedBy: burner.id, usedAt: new Date() })
      .where(eq(invites.id, invite.id));

    const res = await app.request(
      `/auth/register/invite-info?token=${encodeURIComponent(invite.token)}`,
    );
    expect(res.status).toBe(404);
  });

  it('404s on an expired token', async () => {
    const invite = await seedInvite('expired-info@example.com');
    await db
      .update(invites)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(invites.id, invite.id));

    const res = await app.request(
      `/auth/register/invite-info?token=${encodeURIComponent(invite.token)}`,
    );
    expect(res.status).toBe(404);
  });
});

/* ============================================================================
 * POST /auth/register — invited path
 * ========================================================================== */

describe('POST /auth/register — invited path', () => {
  it('creates an activated user and consumes the invite atomically', async () => {
    const invite = await seedInvite('newcomer@example.com');
    const res = await app.request(
      '/auth/register',
      jsonPost(
        submitBody({
          email: 'newcomer@example.com',
          inviteToken: invite.token,
        }),
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { activated: boolean; email: string };
    expect(body.activated).toBe(true);
    expect(body.email).toBe('newcomer@example.com');

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'newcomer@example.com'));
    expect(user).toBeDefined();
    expect(user!.emailVerifiedAt).not.toBeNull();
    expect(user!.encryptionSalt).toBe('salt-base64');

    const [usedInvite] = await db
      .select()
      .from(invites)
      .where(eq(invites.id, invite.id));
    expect(usedInvite!.usedBy).toBe(user!.id);
    expect(usedInvite!.usedAt).not.toBeNull();

    // No activation email sent on the invited path — the invite
    // email already proved control.
    const activationMails = recording.sent.filter(
      (m) => m.tag === 'register-activate',
    );
    expect(activationMails).toHaveLength(0);
  });

  it('rejects email mismatch with 400 email_mismatch', async () => {
    const invite = await seedInvite('intended@example.com');
    const res = await app.request(
      '/auth/register',
      jsonPost(
        submitBody({
          email: 'someone-else@example.com',
          inviteToken: invite.token,
        }),
      ),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'register_failed',
      reason: 'email_mismatch',
    });

    // Invite stays unused.
    const [stillUnused] = await db
      .select()
      .from(invites)
      .where(eq(invites.id, invite.id));
    expect(stillUnused!.usedBy).toBeNull();
  });

  it('rejects an unknown token with 401 invalid_token', async () => {
    const res = await app.request(
      '/auth/register',
      jsonPost(
        submitBody({
          email: 'someone@example.com',
          inviteToken: 'totally-bogus-token-xxxxxxxxxxxxxxxxxxx',
        }),
      ),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: 'register_failed',
      reason: 'invalid_token',
    });
  });

  it('rejects a re-used token (single-use)', async () => {
    const invite = await seedInvite('once@example.com');

    const first = await app.request(
      '/auth/register',
      jsonPost(
        submitBody({ email: 'once@example.com', inviteToken: invite.token }),
      ),
    );
    expect(first.status).toBe(200);

    const second = await app.request(
      '/auth/register',
      jsonPost(
        submitBody({ email: 'once@example.com', inviteToken: invite.token }),
      ),
    );
    expect(second.status).toBe(401);
    expect(await second.json()).toMatchObject({ reason: 'invalid_token' });
  });

  it('rejects a weak password with 400 weak_password', async () => {
    const invite = await seedInvite('weak@example.com');
    const res = await app.request(
      '/auth/register',
      jsonPost(
        submitBody({
          email: 'weak@example.com',
          password: 'password1234',
          inviteToken: invite.token,
        }),
      ),
    );
    expect(res.status).toBe(400);
    expect((await res.json()) as { error: string }).toMatchObject({
      error: 'weak_password',
    });
  });
});

/* ============================================================================
 * POST /auth/register — open path
 * ========================================================================== */

describe('POST /auth/register — open path', () => {
  it('returns 403 registration_closed when open_registration is off', async () => {
    const res = await app.request(
      '/auth/register',
      jsonPost(submitBody({ email: 'closed@example.com' })),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'registration_closed' });
  });

  it('creates an inactive user and emails an activation link when open', async () => {
    const admin = await seedAdmin('open-admin@example.com');
    await setOpenRegistration(true, admin.id);

    const res = await app.request(
      '/auth/register',
      jsonPost(submitBody({ email: 'open@example.com' })),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, activated: false });

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'open@example.com'));
    expect(user).toBeDefined();
    expect(user!.emailVerifiedAt).toBeNull();

    const verifs = await db
      .select()
      .from(emailVerifications)
      .where(eq(emailVerifications.email, 'open@example.com'));
    expect(verifs).toHaveLength(1);
    expect(verifs[0]!.consumedAt).toBeNull();

    expect(recording.latestByTag('register-activate')).toBeDefined();
  });

  it('reuses an inactive user row + invalidates the previous activation link', async () => {
    const admin = await seedAdmin('reuse-admin@example.com');
    await setOpenRegistration(true, admin.id);

    await app.request(
      '/auth/register',
      jsonPost(submitBody({ email: 'redo@example.com' })),
    );
    await app.request(
      '/auth/register',
      jsonPost(
        submitBody({ email: 'redo@example.com', password: 'Other-Pass-Now-77!' }),
      ),
    );

    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.email, 'redo@example.com'));
    expect(userRows).toHaveLength(1);

    const verifs = await db
      .select()
      .from(emailVerifications)
      .where(eq(emailVerifications.email, 'redo@example.com'));
    const consumed = verifs.filter((v) => v.consumedAt !== null);
    const pending = verifs.filter((v) => v.consumedAt === null);
    expect(consumed).toHaveLength(1);
    expect(pending).toHaveLength(1);
  });

  it('returns 200 silently when the email already belongs to an active user', async () => {
    const admin = await seedAdmin('dup-admin@example.com');
    await setOpenRegistration(true, admin.id);
    const existing = await seedUser('taken@example.com');
    await db
      .update(users)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(users.id, existing.id));

    const res = await app.request(
      '/auth/register',
      jsonPost(submitBody({ email: 'taken@example.com' })),
    );
    expect(res.status).toBe(200);

    const activationMails = recording.sent.filter(
      (m) => m.tag === 'register-activate',
    );
    expect(activationMails).toHaveLength(0);
  });
});

/* ============================================================================
 * POST /auth/register/activate
 * ========================================================================== */

describe('POST /auth/register/activate', () => {
  async function openSubmit(email: string): Promise<string> {
    const admin = await seedAdmin(`act-admin-${Date.now()}@example.com`);
    await setOpenRegistration(true, admin.id);
    await app.request(
      '/auth/register',
      jsonPost(submitBody({ email })),
    );
    return extractTokenFromLatestActivationMail();
  }

  it('flips the user to active and returns its email', async () => {
    const token = await openSubmit('activate@example.com');
    const res = await app.request(
      '/auth/register/activate',
      jsonPost({ token }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      email: 'activate@example.com',
    });

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'activate@example.com'));
    expect(user!.emailVerifiedAt).not.toBeNull();
  });

  it('rejects an invalid token with 401', async () => {
    const res = await app.request(
      '/auth/register/activate',
      jsonPost({ token: 'totally-bogus-token-xxxxxxxxxxxxxxxxxx' }),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ reason: 'invalid_token' });
  });

  it('rejects an already-consumed token with 401', async () => {
    const token = await openSubmit('twice@example.com');
    await app.request('/auth/register/activate', jsonPost({ token }));

    const second = await app.request(
      '/auth/register/activate',
      jsonPost({ token }),
    );
    expect(second.status).toBe(401);
    expect(await second.json()).toMatchObject({ reason: 'already_consumed' });
  });

  it('rejects an expired token with 410', async () => {
    const token = await openSubmit('expired@example.com');
    const tokenHash = hashToken(token);
    await db
      .update(emailVerifications)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(emailVerifications.codeHash, tokenHash));

    const res = await app.request(
      '/auth/register/activate',
      jsonPost({ token }),
    );
    expect(res.status).toBe(410);
    expect(await res.json()).toMatchObject({ reason: 'expired' });
  });
});

/* ============================================================================
 * POST /auth/login activation gate
 * ========================================================================== */

describe('POST /auth/login activation gate', () => {
  it('refuses an unactivated open-path user with 403', async () => {
    const admin = await seedAdmin('gate-admin@example.com');
    await setOpenRegistration(true, admin.id);
    await app.request(
      '/auth/register',
      jsonPost(submitBody({ email: 'unactivated@example.com' })),
    );

    const res = await app.request(
      '/auth/login',
      jsonPost({
        email: 'unactivated@example.com',
        password: REG_PASSWORD,
      }),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'account_not_activated' });
  });

  it('lets an invited (auto-activated) user log in directly', async () => {
    const invite = await seedInvite('happy-invite@example.com');
    await app.request(
      '/auth/register',
      jsonPost(
        submitBody({
          email: 'happy-invite@example.com',
          inviteToken: invite.token,
        }),
      ),
    );

    const res = await app.request(
      '/auth/login',
      jsonPost({ email: 'happy-invite@example.com', password: REG_PASSWORD }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie') ?? '').toMatch(/nodea_session=/);
  });
});
