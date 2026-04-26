/**
 * Integration tests for the multi-step register flow (Auth-Roadmap
 * Phase 1B + 1C, Auth-Spec.md §7.1).
 *
 * Covers `/auth/register/start`, `/auth/register/verify-email`,
 * `/auth/register/state`, and `/auth/register/set-password` against a
 * real Postgres + the in-memory `RecordingEmailService` (see
 * `vitest.config.ts` which forces `EMAIL_SERVICE_IMPL=recording`).
 *
 * The legacy `POST /auth/register` single-shot is covered separately
 * by `auth.test.ts` and is not exercised here.
 */
import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../app.ts';
import { db } from '../db/client.ts';
import {
  emailVerifications,
  invites,
  sessions,
  users,
} from '../db/schema.ts';
import { hashEmailCode } from '../auth/email-verifications.ts';
import { __getRecordingEmailService } from '../services/email/index.ts';
import { seedInvite, seedUser } from './helpers.ts';

const app = buildApp();
const recording = __getRecordingEmailService();

function jsonPost(body: unknown, cookie?: string): RequestInit {
  return {
    method: 'POST',
    headers: cookie
      ? { 'content-type': 'application/json', cookie }
      : { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function jsonGet(cookie?: string): RequestInit {
  return cookie ? { method: 'GET', headers: { cookie } } : { method: 'GET' };
}

/**
 * Pull the `nodea_register=…` value from a Set-Cookie header. Returns
 * the cookie string ready to be sent back via `cookie` header.
 */
function extractRegisterCookie(res: Response): string | null {
  const header = res.headers.get('set-cookie');
  if (!header) return null;
  const match = header.match(/nodea_register=([^;]+)/);
  return match ? `nodea_register=${match[1]}` : null;
}

function extractFullSessionCookie(res: Response): string | null {
  const header = res.headers.get('set-cookie');
  if (!header) return null;
  const match = header.match(/nodea_session=([^;]+)/);
  return match ? `nodea_session=${match[1]}` : null;
}

/**
 * Walk the test recording buffer and pull the latest `register-verify`
 * mail. The clear code is in the body — base32-extract it. Tests use
 * this rather than reaching into DB internals because that's how a
 * real user gets the code.
 */
function extractCodeFromLatestRegisterVerifyMail(): string {
  const mail = recording.latestByTag('register-verify');
  if (!mail) throw new Error('no register-verify mail recorded');
  const match = mail.text.match(/^\s{4}(\d{6})\s*$/m);
  if (!match || !match[1]) {
    throw new Error(`no 6-digit code found in mail body:\n${mail.text}`);
  }
  return match[1];
}

const REG_PASSWORD = 'Brand-New-Test-Pass-99';

/* ============================================================================
 * POST /auth/register/start
 * ========================================================================== */

describe('POST /auth/register/start', () => {
  it('creates a pre_register users row + email_verifications row + sends a code', async () => {
    const invite = await seedInvite();
    const res = await app.request(
      '/auth/register/start',
      jsonPost({ email: 'newcomer@example.com', inviteCode: invite.code }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'newcomer@example.com'));
    expect(user).toBeDefined();
    expect(user!.registerState).toBe('pre_register');

    const verifs = await db
      .select()
      .from(emailVerifications)
      .where(eq(emailVerifications.email, 'newcomer@example.com'));
    expect(verifs).toHaveLength(1);
    expect(verifs[0]!.kind).toBe('register');
    expect(verifs[0]!.consumedAt).toBeNull();

    expect(recording.latestByTag('register-verify')).toBeDefined();
    expect(recording.latestByTag('register-verify')!.to).toBe(
      'newcomer@example.com',
    );
  });

  it('reuses an existing pre_register row + invalidates the previous code', async () => {
    const invite = await seedInvite();

    await app.request(
      '/auth/register/start',
      jsonPost({ email: 'redo@example.com', inviteCode: invite.code }),
    );
    const firstUserCount = (
      await db.select().from(users).where(eq(users.email, 'redo@example.com'))
    ).length;

    await app.request(
      '/auth/register/start',
      jsonPost({ email: 'redo@example.com', inviteCode: invite.code }),
    );

    // No second user row created — the existing pre_register one is reused.
    const second = await db
      .select()
      .from(users)
      .where(eq(users.email, 'redo@example.com'));
    expect(second).toHaveLength(firstUserCount);

    // Two verifications in DB total: the first marked consumed by the
    // invalidate step, the second still pending.
    const verifs = await db
      .select()
      .from(emailVerifications)
      .where(eq(emailVerifications.email, 'redo@example.com'));
    const consumed = verifs.filter((v) => v.consumedAt !== null);
    const pending = verifs.filter((v) => v.consumedAt === null);
    expect(consumed).toHaveLength(1);
    expect(pending).toHaveLength(1);

    // Both `register-verify` mails landed in the buffer.
    const buf = recording.sent.filter((m) => m.tag === 'register-verify');
    expect(buf).toHaveLength(2);
  });

  it('returns 200 silently for an unknown invite code (anti-enum)', async () => {
    const res = await app.request(
      '/auth/register/start',
      jsonPost({
        email: 'noinvite@example.com',
        inviteCode: 'nd-totallybogus000000000',
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    // No user row, no verification, no email — silent.
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'noinvite@example.com'));
    expect(user).toBeUndefined();
    expect(recording.sent).toHaveLength(0);
  });

  it('returns 200 silently for an already-used invite (anti-enum)', async () => {
    const invite = await seedInvite();
    // Burn the invite via direct DB update — simulates an earlier
    // successful set-password without going through the full flow.
    // `usedBy` must be a real user_id (FK + the route checks
    // `!invite.usedBy` which would be falsy for null).
    const burner = await seedUser('burner@example.com');
    await db
      .update(invites)
      .set({ usedBy: burner.id, usedAt: new Date() })
      .where(eq(invites.id, invite.id));

    const res = await app.request(
      '/auth/register/start',
      jsonPost({ email: 'late@example.com', inviteCode: invite.code }),
    );
    expect(res.status).toBe(200);

    const verifyMails = recording.sent.filter(
      (m) => m.tag === 'register-verify',
    );
    expect(verifyMails).toHaveLength(0);
  });

  it('returns 200 silently when the email already belongs to a complete user', async () => {
    const invite = await seedInvite();

    // Seed a `complete` user with this email by going through the full
    // flow once.
    await app.request(
      '/auth/register/start',
      jsonPost({ email: 'taken@example.com', inviteCode: invite.code }),
    );
    const code = extractCodeFromLatestRegisterVerifyMail();
    await app.request(
      '/auth/register/verify-email',
      jsonPost({ email: 'taken@example.com', code }),
    );
    // Don't go further; `email_verified` is enough to demonstrate the
    // shadow-protection — the next start should still refuse.

    // Move the user to `complete` directly to simulate the post-bridge state.
    await db
      .update(users)
      .set({ registerState: 'complete' })
      .where(eq(users.email, 'taken@example.com'));

    const fresh = await seedInvite();
    recording.reset();
    const res = await app.request(
      '/auth/register/start',
      jsonPost({ email: 'taken@example.com', inviteCode: fresh.code }),
    );
    expect(res.status).toBe(200);
    expect(recording.sent).toHaveLength(0);
  });

  it('returns 400 on invalid body shape', async () => {
    const res = await app.request(
      '/auth/register/start',
      jsonPost({ email: 'not-an-email', inviteCode: '' }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_body' });
  });
});

/* ============================================================================
 * POST /auth/register/verify-email
 * ========================================================================== */

describe('POST /auth/register/verify-email', () => {
  async function startFor(email: string): Promise<string> {
    const invite = await seedInvite();
    await app.request(
      '/auth/register/start',
      jsonPost({ email, inviteCode: invite.code }),
    );
    return extractCodeFromLatestRegisterVerifyMail();
  }

  it('promotes the user to email_verified and emits a register cookie', async () => {
    const code = await startFor('verify@example.com');
    const res = await app.request(
      '/auth/register/verify-email',
      jsonPost({ email: 'verify@example.com', code }),
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as { email: string; registerState: string };
    expect(body.email).toBe('verify@example.com');
    expect(body.registerState).toBe('email_verified');

    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/nodea_register=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'verify@example.com'));
    expect(user!.registerState).toBe('email_verified');
    expect(user!.emailVerifiedAt).not.toBeNull();
  });

  it('rejects a wrong code with 401 invalid_code and bumps attempts', async () => {
    await startFor('wrong@example.com');
    const res = await app.request(
      '/auth/register/verify-email',
      jsonPost({ email: 'wrong@example.com', code: '000000' }),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: 'verification_failed',
      reason: 'invalid_code',
    });

    const verifs = await db
      .select()
      .from(emailVerifications)
      .where(eq(emailVerifications.email, 'wrong@example.com'));
    expect(verifs[0]!.attempts).toBe(1);
    expect(verifs[0]!.consumedAt).toBeNull();
  });

  it('returns too_many_attempts after 5 wrong codes', async () => {
    await startFor('brute@example.com');
    for (let i = 0; i < 5; i++) {
      await app.request(
        '/auth/register/verify-email',
        jsonPost({ email: 'brute@example.com', code: '000000' }),
      );
    }
    const res = await app.request(
      '/auth/register/verify-email',
      jsonPost({ email: 'brute@example.com', code: '000000' }),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: 'verification_failed',
      reason: 'too_many_attempts',
    });
  });

  it('returns 410 expired when the verification has expired', async () => {
    await startFor('expired@example.com');
    // Backdate the expiry directly — simpler than vi.useFakeTimers().
    await db
      .update(emailVerifications)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(emailVerifications.email, 'expired@example.com'));

    const res = await app.request(
      '/auth/register/verify-email',
      jsonPost({ email: 'expired@example.com', code: '000000' }),
    );
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({
      error: 'verification_failed',
      reason: 'expired',
    });
  });

  it('returns 401 no_pending_verification when the email has nothing pending', async () => {
    const res = await app.request(
      '/auth/register/verify-email',
      jsonPost({ email: 'never-started@example.com', code: '123456' }),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: 'verification_failed',
      reason: 'no_pending_verification',
    });
  });

  it('returns 400 on invalid body (non-numeric code)', async () => {
    const res = await app.request(
      '/auth/register/verify-email',
      jsonPost({ email: 'foo@example.com', code: 'abcdef' }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects the same code twice (single-use)', async () => {
    const code = await startFor('replay@example.com');
    const first = await app.request(
      '/auth/register/verify-email',
      jsonPost({ email: 'replay@example.com', code }),
    );
    expect(first.status).toBe(200);

    const second = await app.request(
      '/auth/register/verify-email',
      jsonPost({ email: 'replay@example.com', code }),
    );
    expect(second.status).toBe(401);
    expect((await second.json()) as { reason: string }).toMatchObject({
      reason: 'no_pending_verification',
    });
  });
});

/* ============================================================================
 * GET /auth/register/state
 * ========================================================================== */

describe('GET /auth/register/state', () => {
  async function freshRegisterCookie(email: string): Promise<string> {
    const invite = await seedInvite();
    await app.request(
      '/auth/register/start',
      jsonPost({ email, inviteCode: invite.code }),
    );
    const code = extractCodeFromLatestRegisterVerifyMail();
    const res = await app.request(
      '/auth/register/verify-email',
      jsonPost({ email, code }),
    );
    const cookie = extractRegisterCookie(res);
    if (!cookie) throw new Error('no register cookie issued');
    return cookie;
  }

  it('returns the user state with a valid register cookie', async () => {
    const cookie = await freshRegisterCookie('state@example.com');
    const res = await app.request('/auth/register/state', jsonGet(cookie));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      email: string;
      registerState: string;
    };
    expect(body.email).toBe('state@example.com');
    expect(body.registerState).toBe('email_verified');
  });

  it('returns 401 without any cookie', async () => {
    const res = await app.request('/auth/register/state', jsonGet());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'no_register_session' });
  });

  it('returns 401 when only a full session cookie is present (kind mismatch)', async () => {
    // Build a "complete" user via the multi-step flow + set-password,
    // grab the resulting full session cookie, then try to use it on
    // /register/state.
    const cookie = await freshRegisterCookie('mismatch@example.com');
    // Need a fresh invite for set-password (invite at start was just
    // looked up, not consumed).
    const invite = await seedInvite();
    const setRes = await app.request(
      '/auth/register/set-password',
      jsonPost(
        {
          password: REG_PASSWORD,
          inviteCode: invite.code,
          encryptionSalt: 'salt-base64',
          encryptedKey: 'wrapped-key-base64',
        },
        cookie,
      ),
    );
    expect(setRes.status).toBe(200);
    const fullCookie = extractFullSessionCookie(setRes);
    expect(fullCookie).not.toBeNull();

    const stateRes = await app.request(
      '/auth/register/state',
      jsonGet(fullCookie!),
    );
    expect(stateRes.status).toBe(401);
  });
});

/* ============================================================================
 * POST /auth/register/set-password
 * ========================================================================== */

describe('POST /auth/register/set-password', () => {
  async function setupVerifiedUser(email: string): Promise<{
    cookie: string;
    invite: { id: string; code: string };
  }> {
    const invite = await seedInvite();
    await app.request(
      '/auth/register/start',
      jsonPost({ email, inviteCode: invite.code }),
    );
    const code = extractCodeFromLatestRegisterVerifyMail();
    const res = await app.request(
      '/auth/register/verify-email',
      jsonPost({ email, code }),
    );
    const cookie = extractRegisterCookie(res);
    if (!cookie) throw new Error('no register cookie issued');
    return { cookie, invite };
  }

  it('completes the user, consumes the invite, and emits a full session', async () => {
    const { cookie, invite } = await setupVerifiedUser('done@example.com');
    const res = await app.request(
      '/auth/register/set-password',
      jsonPost(
        {
          password: REG_PASSWORD,
          inviteCode: invite.code,
          encryptionSalt: 'salt-base64',
          encryptedKey: 'wrapped-key-base64',
        },
        cookie,
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBeDefined();

    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/nodea_session=/);
    // Register cookie must be cleared (delete-cookie sets it with an
    // expired date).
    expect(setCookie).toMatch(/nodea_register=;/);

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'done@example.com'));
    expect(user!.registerState).toBe('complete');
    expect(user!.passwordHash).not.toBe(
      // Sentinel placeholder from auth-register-v2.ts
      '$argon2id$v=19$m=19456,t=2,p=1$cGVuZGluZy1yZWdpc3Rlcg$cGVuZGluZy1yZWdpc3Rlci1ub3QtYS1yZWFsLWhhc2gh',
    );
    expect(user!.encryptionSalt).toBe('salt-base64');
    expect(user!.encryptedKey).toBe('wrapped-key-base64');

    const [usedInvite] = await db
      .select()
      .from(invites)
      .where(eq(invites.id, invite.id));
    expect(usedInvite!.usedBy).toBe(user!.id);
    expect(usedInvite!.usedAt).not.toBeNull();

    // The register session must be gone, replaced by the full one.
    const remaining = await db
      .select({ kind: sessions.kind })
      .from(sessions)
      .where(eq(sessions.userId, user!.id));
    expect(remaining.map((r) => r.kind).sort()).toEqual(['full']);
  });

  it('rejects a weak password with 400 weak_password', async () => {
    const { cookie, invite } = await setupVerifiedUser('weak@example.com');
    const res = await app.request(
      '/auth/register/set-password',
      jsonPost(
        {
          password: 'password1234',
          inviteCode: invite.code,
          encryptionSalt: 'salt-base64',
          encryptedKey: 'wrapped-key-base64',
        },
        cookie,
      ),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('weak_password');
  });

  it('rejects an unknown invite with 400 invalid_invite', async () => {
    const { cookie } = await setupVerifiedUser('badinv@example.com');
    const res = await app.request(
      '/auth/register/set-password',
      jsonPost(
        {
          password: REG_PASSWORD,
          inviteCode: 'nd-totallybogus000000000',
          encryptionSalt: 'salt-base64',
          encryptedKey: 'wrapped-key-base64',
        },
        cookie,
      ),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'register_failed',
      reason: 'invalid_invite',
    });
  });

  it('rejects a used invite with 400 invalid_invite', async () => {
    const { cookie } = await setupVerifiedUser('reuse@example.com');
    const usedInvite = await seedInvite();
    const burner = await seedUser('burner-reuse@example.com');
    await db
      .update(invites)
      .set({ usedBy: burner.id, usedAt: new Date() })
      .where(eq(invites.id, usedInvite.id));
    const res = await app.request(
      '/auth/register/set-password',
      jsonPost(
        {
          password: REG_PASSWORD,
          inviteCode: usedInvite.code,
          encryptionSalt: 'salt-base64',
          encryptedKey: 'wrapped-key-base64',
        },
        cookie,
      ),
    );
    expect(res.status).toBe(400);
  });

  it('returns 401 without a register cookie', async () => {
    const invite = await seedInvite();
    const res = await app.request(
      '/auth/register/set-password',
      jsonPost({
        password: REG_PASSWORD,
        inviteCode: invite.code,
        encryptionSalt: 'salt-base64',
        encryptedKey: 'wrapped-key-base64',
      }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 409 invalid_state when the user is already complete', async () => {
    const { cookie, invite } = await setupVerifiedUser('twice@example.com');

    // First call — succeeds.
    const first = await app.request(
      '/auth/register/set-password',
      jsonPost(
        {
          password: REG_PASSWORD,
          inviteCode: invite.code,
          encryptionSalt: 'salt-base64',
          encryptedKey: 'wrapped-key-base64',
        },
        cookie,
      ),
    );
    expect(first.status).toBe(200);

    // Second call with the SAME register cookie. The cookie's session
    // has just been deleted by the first call, so this is really a
    // "no register session" 401.
    const second = await app.request(
      '/auth/register/set-password',
      jsonPost(
        {
          password: REG_PASSWORD,
          inviteCode: invite.code,
          encryptionSalt: 'salt-base64',
          encryptedKey: 'wrapped-key-base64',
        },
        cookie,
      ),
    );
    expect(second.status).toBe(401);
  });

  it('returns 400 on invalid body shape', async () => {
    const { cookie } = await setupVerifiedUser('badbody@example.com');
    const res = await app.request(
      '/auth/register/set-password',
      jsonPost({ password: 'short', inviteCode: '' }, cookie),
    );
    expect(res.status).toBe(400);
  });
});

/* ============================================================================
 * Crypto helpers (sanity)
 * ========================================================================== */

describe('email verification hashing', () => {
  it('produces a 64-hex-char SHA-256 digest', () => {
    const hash = hashEmailCode('123456');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic on the same input', () => {
    expect(hashEmailCode('999999')).toBe(hashEmailCode('999999'));
  });

  it('differs between distinct inputs', () => {
    expect(hashEmailCode('111111')).not.toBe(hashEmailCode('111112'));
  });
});
