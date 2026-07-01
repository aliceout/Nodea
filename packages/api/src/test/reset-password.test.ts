import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { client, ready } from '@serenity-kit/opaque';
import { buildApp } from '../app.ts';
import { db } from '../db/client.ts';
import {
  authFactors,
  mfaBypassRequests,
  mfaTotp,
  mfaTotpRecoveryCodes,
  moodEntries,
  passwordResetTokens,
  users,
} from '../db/schema.ts';
import { TEST_PASSWORD, loginAs, seedUser } from './helpers.ts';
import { __setMailerInspector, type Mail } from '../auth/mailer.ts';

const app = buildApp();

function jsonPost(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
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
      .innerJoin(users, eq(passwordResetTokens.userId, users.id))
      .where(eq(users.email, 'reset1@example.com'));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.password_reset_tokens.usedAt).toBeNull();
  });

  it('returns 200 silently for an unknown email (no enumeration leak)', async () => {
    const { mails } = captureMail();
    const res = await app.request(
      '/auth/request-reset',
      jsonPost({ email: 'nobody@example.com' }),
    );
    expect(res.status).toBe(200);
    expect(mails).toHaveLength(0);
  });
});

/* ============================================================================
 * /auth/reset/start + /auth/reset/finish
 * ========================================================================== */

/**
 * Drive a full OPAQUE-based password reset via the 2-step routes.
 * Returns the new password's `registrationRecord` and the deterministic
 * test-only wrap blobs the test asserts against.
 */
async function performResetFlow(opts: {
  token: string;
  email: string;
  newPassword: string;
}): Promise<{ startStatus: number; finishStatus: number; finishBody?: unknown }> {
  await ready;
  const { clientRegistrationState, registrationRequest } = client.startRegistration({
    password: opts.newPassword,
  });

  const startRes = await app.request(
    '/auth/reset/start',
    jsonPost({ token: opts.token, registrationRequest }),
  );
  if (startRes.status !== 200) {
    return { startStatus: startRes.status, finishStatus: 0 };
  }
  const { registrationResponse, resetToken } = (await startRes.json()) as {
    registrationResponse: string;
    resetToken: string;
  };

  const { registrationRecord } = client.finishRegistration({
    password: opts.newPassword,
    clientRegistrationState,
    registrationResponse,
  });

  const finishRes = await app.request(
    '/auth/reset/finish',
    jsonPost({
      resetToken,
      registrationRecord,
      // Test-deterministic wrap blobs — the route stores them as
      // opaque strings, no AAD validation server-side.
      wrappedMainKey: 'fresh-wrapped-main',
      wrappedMainKeyIv: 'fresh-iv-main',
      wrappedKekPassword: 'fresh-wrapped-kek',
      wrappedKekPasswordIv: 'fresh-iv-kek',
    }),
  );

  return {
    startStatus: 200,
    finishStatus: finishRes.status,
    finishBody: finishRes.status === 200 ? await finishRes.json() : undefined,
  };
}

describe('POST /auth/reset (OPAQUE 2-step)', () => {
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

  it('rotates the password, leaves old entries orphaned, revokes sessions', async () => {
    const email = 'reset2@example.com';
    const token = await requestResetFor(email);

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    await db.insert(moodEntries).values({
      id: 'mood-A',
      moduleUserId: 'sid-x',
      cipherIv: 'iv',
      payload: 'blob',
      guard: 'g_' + 'a'.repeat(64),
    });

    const cookie = await loginAs(app, email, TEST_PASSWORD);

    const result = await performResetFlow({
      token,
      email,
      newPassword: NEW_PASSWORD,
    });
    expect(result.startStatus).toBe(200);
    expect(result.finishStatus).toBe(200);

    // Old entries are NOT purged anymore — entry tables carry no
    // user_id, the server cannot link the row to the user being
    // reset. The row stays orphaned in DB, encrypted with the
    // (now-lost) main key, unreadable by anyone. This is the
    // accepted trade-off documented in the entry-table schema.
    const entries = await db
      .select()
      .from(moodEntries)
      .where(eq(moodEntries.moduleUserId, 'sid-x'));
    expect(entries).toHaveLength(1);

    // Wrap blobs rotated to the new ones.
    const [updated] = await db.select().from(users).where(eq(users.id, user!.id)).limit(1);
    expect(updated!.wrappedMainKey).toBe('fresh-wrapped-main');
    expect(updated!.wrappedKekPassword).toBe('fresh-wrapped-kek');
    expect(updated!.onboardingStatus).toBe('pending');

    // Old session revoked.
    const me = await app.request('/auth/me', { headers: { cookie } });
    expect(me.status).toBe(401);

    // OLD password no longer works (the OPAQUE envelope binds NEW
    // now). `loginAs` throws when `client.finishLogin` returns null.
    await expect(loginAs(app, email, TEST_PASSWORD)).rejects.toThrow();

    // NEW password works.
    const newCookie = await loginAs(app, email, NEW_PASSWORD);
    expect(newCookie).toBeTruthy();
  });

  it('purges MFA factors, drops security_mode to baseline, NULLs recovery blobs (§4.3)', async () => {
    const email = 'reset-purge@example.com';
    const token = await requestResetFor(email);
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const uid = user!.id;

    // Arrange a maximum-mode account carrying every factor + recovery blob the
    // destructive reset must purge (all bound to the about-to-be-discarded key).
    await db
      .update(users)
      .set({
        securityMode: 'maximum',
        wrappedKekRecovery: 'old-recovery-wrap',
        wrappedKekRecoveryIv: 'old-recovery-iv',
        recoveryCodeHash: 'b'.repeat(64),
        recoveryAcknowledgedAt: new Date(),
        recoveryVerifiedAt: new Date(),
        recoveryVerifyStreak: 3,
      })
      .where(eq(users.id, uid));
    await db
      .insert(mfaTotp)
      .values({ userId: uid, secret: 'JBSWY3DPEHPK3PXP', enabledAt: new Date() });
    await db
      .insert(mfaTotpRecoveryCodes)
      .values({ id: 'rc-purge', userId: uid, codeHash: 'c'.repeat(64) });
    await db.insert(authFactors).values({
      id: 'pk-purge',
      userId: uid,
      kind: 'passkey',
      credentialId: 'cred-reset-purge',
      publicKey: 'pk',
      prfSupported: true,
    });
    await db.insert(mfaBypassRequests).values({
      id: 'bp-purge',
      userId: uid,
      factor: 'totp',
      confirmTokenHash: 'x'.repeat(64),
      cancelTokenHash: 'y'.repeat(64),
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
    });

    const result = await performResetFlow({ token, email, newPassword: NEW_PASSWORD });
    expect(result.finishStatus).toBe(200);

    // Every MFA factor bound to the discarded key is gone.
    expect(await db.select().from(mfaTotp).where(eq(mfaTotp.userId, uid))).toHaveLength(0);
    expect(
      await db.select().from(mfaTotpRecoveryCodes).where(eq(mfaTotpRecoveryCodes.userId, uid)),
    ).toHaveLength(0);
    expect(await db.select().from(authFactors).where(eq(authFactors.userId, uid))).toHaveLength(0);
    expect(
      await db.select().from(mfaBypassRequests).where(eq(mfaBypassRequests.userId, uid)),
    ).toHaveLength(0);

    // Mode dropped to baseline so login never demands a purged factor; recovery
    // blobs nulled so the stale code can't false-positive /recover.
    const [after] = await db.select().from(users).where(eq(users.id, uid)).limit(1);
    expect(after!.securityMode).toBe('password_or_passkey');
    expect(after!.wrappedKekRecovery).toBeNull();
    expect(after!.wrappedKekRecoveryIv).toBeNull();
    expect(after!.recoveryCodeHash).toBeNull();
    expect(after!.recoveryAcknowledgedAt).toBeNull();
    expect(after!.recoveryVerifiedAt).toBeNull();
    expect(after!.recoveryVerifyStreak).toBe(0);
  });

  it('rejects a replayed token (400 invalid_token)', async () => {
    const token = await requestResetFor('reset3@example.com');

    const first = await performResetFlow({
      token,
      email: 'reset3@example.com',
      newPassword: NEW_PASSWORD,
    });
    expect(first.finishStatus).toBe(200);

    const second = await performResetFlow({
      token,
      email: 'reset3@example.com',
      newPassword: NEW_PASSWORD + '-bis',
    });
    expect(second.startStatus).toBe(400);
  });

  it('rejects an expired token (400 invalid_token) at /start', async () => {
    const token = await requestResetFor('reset4@example.com');
    await db
      .update(passwordResetTokens)
      .set({ expiresAt: new Date(Date.now() - 60_000) });

    const result = await performResetFlow({
      token,
      email: 'reset4@example.com',
      newPassword: NEW_PASSWORD,
    });
    expect(result.startStatus).toBe(400);
  });

  it('rejects a malformed /start body (400 invalid_body)', async () => {
    const res = await app.request(
      '/auth/reset/start',
      jsonPost({ token: 'abc', registrationRequest: '' }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects a malformed /finish body (400 invalid_body)', async () => {
    const res = await app.request(
      '/auth/reset/finish',
      jsonPost({ resetToken: 'whatever', registrationRecord: '' }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects a /finish call with an unknown resetToken (400 invalid_token)', async () => {
    const res = await app.request(
      '/auth/reset/finish',
      jsonPost({
        resetToken: 'never-issued-token-aaaaaaaaaaaaaaaa',
        registrationRecord: 'bogus',
        wrappedMainKey: 'x',
        wrappedMainKeyIv: 'x',
        wrappedKekPassword: 'x',
        wrappedKekPasswordIv: 'x',
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('invalid_token');
  });
});
