/**
 * Integration tests for the simplified single-step register flow
 * (Auth-Roadmap Phase 1 reworked).
 *
 * Two routes:
 *   - POST /auth/register         submit + email magic link
 *   - POST /auth/register/activate  consume magic link
 *
 * Plus the activation gate on POST /auth/login (refuses unactivated
 * users with 403 account_not_activated).
 *
 * Real Postgres + the in-memory `RecordingEmailService` (forced via
 * `vitest.config.ts`).
 */
import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../app.ts';
import { db } from '../db/client.ts';
import { emailVerifications, invites, users } from '../db/schema.ts';
import { hashToken } from '../auth/email-verifications.ts';
import { __getRecordingEmailService } from '../services/email/index.ts';
import {
  TEST_PASSWORD,
  seedAdmin,
  seedInvite,
  seedUser,
} from './helpers.ts';

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

function submitBody(invite: string, email: string, password = REG_PASSWORD) {
  return {
    email,
    password,
    inviteCode: invite,
    encryptionSalt: 'salt-base64',
    encryptedKey: 'wrapped-key-base64',
  };
}

/**
 * The activation email contains a link of the form
 * `{WEB_BASE_URL}/activate?token=…`. Tests don't rely on
 * WEB_BASE_URL being set; they parse the `token=` query param out
 * of the body text.
 */
function extractTokenFromLatestActivationMail(): string {
  const mail = recording.latestByTag('register-activate');
  if (!mail) throw new Error('no register-activate mail recorded');
  const match = mail.text.match(/token=([A-Za-z0-9_-]{16,})/);
  if (!match || !match[1]) {
    throw new Error(`no activation token in mail body:\n${mail.text}`);
  }
  return decodeURIComponent(match[1]);
}

/* ============================================================================
 * POST /auth/register
 * ========================================================================== */

describe('POST /auth/register (submit)', () => {
  it('creates an inactive user + emails an activation link', async () => {
    const invite = await seedInvite();
    const res = await app.request(
      '/auth/register',
      jsonPost(submitBody(invite.code, 'newcomer@example.com')),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'newcomer@example.com'));
    expect(user).toBeDefined();
    expect(user!.emailVerifiedAt).toBeNull();
    expect(user!.passwordHash).not.toBe('');
    expect(user!.encryptionSalt).toBe('salt-base64');

    const verifs = await db
      .select()
      .from(emailVerifications)
      .where(eq(emailVerifications.email, 'newcomer@example.com'));
    expect(verifs).toHaveLength(1);
    expect(verifs[0]!.kind).toBe('register');
    expect(verifs[0]!.consumedAt).toBeNull();

    const mail = recording.latestByTag('register-activate');
    expect(mail).toBeDefined();
    expect(mail!.to).toBe('newcomer@example.com');
    expect(mail!.text).toMatch(/token=/);
  });

  it('reuses an existing inactive user row + invalidates the previous link', async () => {
    const invite = await seedInvite();

    await app.request(
      '/auth/register',
      jsonPost(submitBody(invite.code, 'redo@example.com')),
    );
    const firstCount = (
      await db.select().from(users).where(eq(users.email, 'redo@example.com'))
    ).length;

    await app.request(
      '/auth/register',
      jsonPost(submitBody(invite.code, 'redo@example.com', 'Other-Pass-Now-77')),
    );

    const after = await db
      .select()
      .from(users)
      .where(eq(users.email, 'redo@example.com'));
    expect(after).toHaveLength(firstCount);

    // Two verifications total: first marked consumed, second still pending.
    const verifs = await db
      .select()
      .from(emailVerifications)
      .where(eq(emailVerifications.email, 'redo@example.com'));
    const consumed = verifs.filter((v) => v.consumedAt !== null);
    const pending = verifs.filter((v) => v.consumedAt === null);
    expect(consumed).toHaveLength(1);
    expect(pending).toHaveLength(1);

    const mails = recording.sent.filter((m) => m.tag === 'register-activate');
    expect(mails).toHaveLength(2);
  });

  it('returns 200 silently for an unknown invite (anti-enum)', async () => {
    const res = await app.request(
      '/auth/register',
      jsonPost(submitBody('nd-totallybogus000000000', 'noinvite@example.com')),
    );
    expect(res.status).toBe(200);

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'noinvite@example.com'));
    expect(user).toBeUndefined();
    expect(recording.sent).toHaveLength(0);
  });

  it('returns 200 silently for an already-active user', async () => {
    const invite = await seedInvite();
    // Pre-seed a complete + activated user.
    const existing = await seedUser('taken@example.com');
    await db
      .update(users)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(users.id, existing.id));

    const res = await app.request(
      '/auth/register',
      jsonPost(submitBody(invite.code, 'taken@example.com')),
    );
    expect(res.status).toBe(200);
    expect(recording.sent).toHaveLength(0);
  });

  it('rejects a weak password with 400', async () => {
    const invite = await seedInvite();
    const res = await app.request(
      '/auth/register',
      jsonPost(submitBody(invite.code, 'weak@example.com', 'password1234')),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('weak_password');
  });

  it('returns 400 on invalid body shape', async () => {
    const res = await app.request(
      '/auth/register',
      jsonPost({ email: 'not-an-email', password: '', inviteCode: '' }),
    );
    expect(res.status).toBe(400);
  });
});

/* ============================================================================
 * POST /auth/register/activate
 * ========================================================================== */

describe('POST /auth/register/activate', () => {
  async function submitFor(email: string): Promise<string> {
    const invite = await seedInvite();
    await app.request(
      '/auth/register',
      jsonPost(submitBody(invite.code, email)),
    );
    return extractTokenFromLatestActivationMail();
  }

  it('flips the user to active and returns its email', async () => {
    const token = await submitFor('activate@example.com');
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
    expect(await res.json()).toEqual({
      error: 'activation_failed',
      reason: 'invalid_token',
    });
  });

  it('rejects an already-consumed token with 401 already_consumed', async () => {
    const token = await submitFor('twice@example.com');
    const first = await app.request(
      '/auth/register/activate',
      jsonPost({ token }),
    );
    expect(first.status).toBe(200);

    const second = await app.request(
      '/auth/register/activate',
      jsonPost({ token }),
    );
    expect(second.status).toBe(401);
    expect(await second.json()).toEqual({
      error: 'activation_failed',
      reason: 'already_consumed',
    });
  });

  it('rejects an expired token with 410 expired', async () => {
    const token = await submitFor('expired@example.com');
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
    expect(await res.json()).toEqual({
      error: 'activation_failed',
      reason: 'expired',
    });
  });

  it('returns 400 on invalid body', async () => {
    const res = await app.request(
      '/auth/register/activate',
      jsonPost({ token: '' }),
    );
    expect(res.status).toBe(400);
  });
});

/* ============================================================================
 * POST /auth/login — activation gate
 * ========================================================================== */

describe('POST /auth/login activation gate', () => {
  it('refuses an unactivated user with 403 account_not_activated', async () => {
    const invite = await seedInvite();
    await app.request(
      '/auth/register',
      jsonPost(submitBody(invite.code, 'unactivated@example.com')),
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

  it('lets a fully-activated user log in', async () => {
    const invite = await seedInvite();
    await app.request(
      '/auth/register',
      jsonPost(submitBody(invite.code, 'happy@example.com')),
    );
    const token = extractTokenFromLatestActivationMail();
    await app.request(
      '/auth/register/activate',
      jsonPost({ token }),
    );

    const res = await app.request(
      '/auth/login',
      jsonPost({ email: 'happy@example.com', password: REG_PASSWORD }),
    );
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/nodea_session=/);
  });

  it('lets pre-existing legacy users (with email_verified_at set) log in unchanged', async () => {
    // Admin seeds set email_verified_at directly; legacy users from
    // before the activation gate should not be locked out.
    const admin = await seedAdmin('legacy-admin@example.com');
    await db
      .update(users)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(users.id, admin.id));

    const res = await app.request(
      '/auth/login',
      jsonPost({
        email: 'legacy-admin@example.com',
        password: ADMIN_FOR_TEST_HELPERS,
      }),
    );
    expect(res.status).toBe(200);
  });
});

/**
 * Test helpers re-export: the seedAdmin helper uses ADMIN_PASSWORD
 * from helpers.ts. Re-importing as a named const here would be
 * cleaner; for now the test references it by literal so the
 * relationship is visible.
 */
const ADMIN_FOR_TEST_HELPERS = 'Admin-Horse-Battery-Staple-42';

/* ============================================================================
 * Crypto helpers (sanity)
 * ========================================================================== */

describe('email verification token hashing', () => {
  it('produces a 64-hex-char SHA-256 digest', () => {
    const hash = hashToken('some-base64url-token-xyz');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic on the same input', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
  });

  it('differs between distinct inputs', () => {
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
  });
});

/**
 * Make TEST_PASSWORD reachable to the typechecker even though we
 * don't use it directly here — keeps the import linter happy.
 */
void TEST_PASSWORD;
void invites;
