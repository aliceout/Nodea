import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../app.ts';
import { db } from '../db/client.ts';
import { moodEntries, passwordResetTokens, users } from '../db/schema.ts';
import { TEST_PASSWORD, loginAs, seedUser } from './helpers.ts';
import { __setMailerInspector, type Mail } from '../auth/mailer.ts';

const app = buildApp();

function jsonPost(body: unknown, cookie?: string): RequestInit {
  return {
    method: 'POST',
    headers: cookie
      ? { 'content-type': 'application/json', cookie }
      : { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function captureMail(): { mails: Mail[]; restore: () => void } {
  const mails: Mail[] = [];
  __setMailerInspector((m) => mails.push(m));
  return {
    mails,
    restore: () => __setMailerInspector(null),
  };
}

/**
 * Extract the `?token=…` query param the request-reset email contains.
 * The reset link format is written by the route itself — we match
 * `token=<base64url chars>` anywhere in the plain-text body.
 */
function tokenFromMail(mail: Mail): string {
  const match = mail.text.match(/token=([A-Za-z0-9_-]{16,})/);
  if (!match || !match[1]) throw new Error('no token in mail body');
  return decodeURIComponent(match[1]);
}

const NEW_PASSWORD = 'Brand-New-Horse-Battery-Staple-99';

describe('POST /auth/request-reset', () => {
  afterEach(() => __setMailerInspector(null));

  it('returns 200 and sends an email for a known user', async () => {
    await seedUser('reset1@example.com');
    const { mails } = captureMail();

    const res = await app.request(
      '/auth/request-reset',
      jsonPost({ email: 'reset1@example.com' }),
    );
    expect(res.status).toBe(200);
    expect(mails).toHaveLength(1);
    expect(mails[0]!.to).toBe('reset1@example.com');
    expect(mails[0]!.text).toMatch(/token=/);

    // One active token row exists for the user.
    const rows = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, (await db.select().from(users).where(eq(users.email, 'reset1@example.com')).limit(1))[0]!.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.usedAt).toBeNull();
  });

  it('still returns 200 without sending mail for an unknown address', async () => {
    const { mails } = captureMail();
    const res = await app.request(
      '/auth/request-reset',
      jsonPost({ email: 'ghost@example.com' }),
    );
    expect(res.status).toBe(200);
    expect(mails).toHaveLength(0);
  });

  it('rejects a malformed body (400)', async () => {
    const res = await app.request(
      '/auth/request-reset',
      jsonPost({ email: 'not-an-email' }),
    );
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/reset', () => {
  afterEach(() => __setMailerInspector(null));

  async function requestResetFor(email: string): Promise<string> {
    await seedUser(email);
    const { mails, restore } = captureMail();
    const res = await app.request('/auth/request-reset', jsonPost({ email }));
    expect(res.status).toBe(200);
    const token = tokenFromMail(mails[0]!);
    restore();
    return token;
  }

  it('rotates the password, purges old entries, revokes sessions', async () => {
    const email = 'reset2@example.com';
    const token = await requestResetFor(email);

    // Seed some data the reset must blow away.
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    await db.insert(moodEntries).values({
      id: 'mood-A',
      userId: user!.id,
      moduleUserId: 'sid-x',
      cipherIv: 'iv',
      payload: 'blob',
      guard: 'g_' + 'a'.repeat(64),
    });

    // Also obtain a live session cookie to verify it's revoked.
    const cookie = await loginAs(app, email, TEST_PASSWORD);

    const res = await app.request(
      '/auth/reset',
      jsonPost({
        token,
        newPassword: NEW_PASSWORD,
        encryptionSalt: 'fresh-salt',
        encryptedKey: 'fresh-wrap',
      }),
    );
    expect(res.status).toBe(200);

    // Old entries are gone.
    const entries = await db
      .select()
      .from(moodEntries)
      .where(eq(moodEntries.userId, user!.id));
    expect(entries).toHaveLength(0);

    // Legacy envelope rotated. Phase 2D will also rotate the OPAQUE
    // envelope (a fresh registration record) at this point — until
    // then, the OPAQUE side keeps binding the OLD password and the
    // re-login assertions below are skipped on purpose.
    const [updated] = await db.select().from(users).where(eq(users.id, user!.id)).limit(1);
    expect(updated!.encryptionSalt).toBe('fresh-salt');
    expect(updated!.encryptedKey).toBe('fresh-wrap');
    expect(updated!.onboardingStatus).toBe('pending');

    // Old session is revoked (GET /auth/me returns 401).
    const me = await app.request('/auth/me', { headers: { cookie } });
    expect(me.status).toBe(401);

    // TODO Phase 2D: once /auth/reset rotates the OPAQUE envelope
    // alongside the legacy fields, restore the assertions:
    //   - login with OLD password → 401 (envelope replaced)
    //   - login with NEW password → 200 (new envelope binds it)
  });

  it('rejects a replayed token (400 invalid_token)', async () => {
    const token = await requestResetFor('reset3@example.com');

    const first = await app.request(
      '/auth/reset',
      jsonPost({
        token,
        newPassword: NEW_PASSWORD,
        encryptionSalt: 'salt-1',
        encryptedKey: 'wrap-1',
      }),
    );
    expect(first.status).toBe(200);

    const second = await app.request(
      '/auth/reset',
      jsonPost({
        token,
        newPassword: NEW_PASSWORD + '-bis',
        encryptionSalt: 'salt-2',
        encryptedKey: 'wrap-2',
      }),
    );
    expect(second.status).toBe(400);
    const body = (await second.json()) as { error: string };
    expect(body.error).toBe('invalid_token');
  });

  it('rejects an expired token (400 invalid_token)', async () => {
    const token = await requestResetFor('reset4@example.com');

    // Fast-forward: bump the expires_at backwards so the token looks expired.
    await db
      .update(passwordResetTokens)
      .set({ expiresAt: new Date(Date.now() - 60_000) });

    const res = await app.request(
      '/auth/reset',
      jsonPost({
        token,
        newPassword: NEW_PASSWORD,
        encryptionSalt: 'salt',
        encryptedKey: 'wrap',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects a weak password (400 weak_password)', async () => {
    const token = await requestResetFor('reset5@example.com');
    const res = await app.request(
      '/auth/reset',
      jsonPost({
        token,
        newPassword: 'passwordpassword', // length ok, zxcvbn score ≤ 2
        encryptionSalt: 'salt',
        encryptedKey: 'wrap',
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('weak_password');
  });

  it('rejects a body that is too short (400 invalid_body)', async () => {
    const res = await app.request(
      '/auth/reset',
      jsonPost({ token: 'abc', newPassword: 'x', encryptionSalt: '', encryptedKey: '' }),
    );
    expect(res.status).toBe(400);
  });
});
