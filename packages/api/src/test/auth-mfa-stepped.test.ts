/**
 * Integration tests for stepped MFA at login (Auth-Roadmap Phase 5C,
 * Auth-Spec §7.4).
 *
 * Routes under test:
 *   - POST /auth/login/finish        (now branches on security_mode)
 *   - POST /auth/mfa/totp/verify     (mfa_pending → full promotion)
 *
 * Scenarios:
 *   - mode `password_or_passkey` → no MFA, /finish emits full session.
 *   - mode `always_totp`         → /finish emits mfa_pending,
 *                                   `verifyMfaTotp(code)` finalizes.
 *   - Wrong TOTP code            → 401, session stays pending.
 *   - Backup code path           → finalizes + flips `usedAt`.
 *   - Backup code replay         → 401 on the second attempt.
 *   - mfa_pending replay         → second `/auth/mfa/totp/verify`
 *                                   call with the SAME cookie after
 *                                   finalize is rejected (cookie
 *                                   was rotated; the old session id
 *                                   no longer exists).
 *
 * The OPAQUE handshake runs in-process via the test app + shared
 * helpers. TOTP codes are generated with `otplib.generate` against
 * the secret returned by `/auth/totp/enroll/start`.
 */
import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { client, ready } from '@serenity-kit/opaque';
import { generate as otplibGenerate } from 'otplib';
import { buildApp } from '../app.ts';
import { db } from '../db/client.ts';
import { mfaTotp, sessions, users } from '../db/schema.ts';
import {
  TEST_PASSWORD,
  extractCookie,
  passwordProofFor,
  seedUser,
} from './helpers.ts';

const app = buildApp();

function jsonPost(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

/**
 * Drive `/auth/login/start` + `/auth/login/finish` and return the
 * raw response payload + cookie so tests can branch on `needsMfa`.
 * Differs from `loginAs` (which expects a full session and throws
 * otherwise) — this helper handles both the full and pending paths.
 */
async function rawLogin(
  email: string,
  password: string,
): Promise<{
  status: number;
  body: Record<string, unknown>;
  cookie: string | null;
}> {
  await ready;
  const { clientLoginState, startLoginRequest } = client.startLogin({ password });
  const startRes = await app.request(
    '/auth/login/start',
    jsonPost({ email, startLoginRequest }),
  );
  if (startRes.status !== 200) {
    return { status: startRes.status, body: {}, cookie: null };
  }
  const { loginResponse, loginToken } = (await startRes.json()) as {
    loginResponse: string;
    loginToken: string;
  };
  const finished = client.finishLogin({
    password,
    clientLoginState,
    loginResponse,
  });
  if (!finished) {
    throw new Error('rawLogin: client.finishLogin returned undefined');
  }
  const finishRes = await app.request(
    '/auth/login/finish',
    jsonPost({ loginToken, finishLoginRequest: finished.finishLoginRequest }),
  );
  return {
    status: finishRes.status,
    body: (await finishRes.json()) as Record<string, unknown>,
    cookie: extractCookie(finishRes),
  };
}

/**
 * Enroll TOTP for an already-seeded user + flip `enabled_at`.
 * Returns the base32 secret so tests can mint live codes.
 *
 * Note on anti-replay: enrolling consumes the current window's
 * code, so a follow-up verify within the same 30s would be rejected
 * by `last_window`. Real users wait between enroll and login;
 * tests don't, so we reset `last_window` to null right after the
 * verify-step. This is fine because the anti-replay logic is
 * separately exercised by the TOTP unit tests; here we just need
 * the row to be enabled.
 */
async function enrollTotpFor(
  email: string,
  password: string,
  cookie: string,
): Promise<{ secret: string }> {
  const proof = await passwordProofFor(app, email, password);
  const startRes = await app.request('/auth/totp/enroll/start', {
    ...jsonPost(proof),
    headers: { 'content-type': 'application/json', cookie },
  });
  const { secretBase32 } = (await startRes.json()) as { secretBase32: string };
  const code = await otplibGenerate({
    strategy: 'totp',
    secret: secretBase32,
    digits: 6,
    period: 30,
    algorithm: 'sha1',
  });
  await app.request('/auth/totp/enroll/verify', {
    ...jsonPost({ code, backupCodesAcknowledged: true }),
    headers: { 'content-type': 'application/json', cookie },
  });
  // Reset anti-replay window so the test's next code in the same
  // 30s isn't refused as a replay.
  const [u] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (u) {
    await db
      .update(mfaTotp)
      .set({ lastWindow: null })
      .where(eq(mfaTotp.userId, u.id));
  }
  return { secret: secretBase32 };
}

/* ============================================================================
 * Mode `password_or_passkey` — no stepped MFA
 * ========================================================================== */

describe('POST /auth/login/finish — mode password_or_passkey', () => {
  it('emits a full session + needsMfa=false', async () => {
    await seedUser('mfa-mode-default@example.com');
    const { status, body, cookie } = await rawLogin(
      'mfa-mode-default@example.com',
      TEST_PASSWORD,
    );
    expect(status).toBe(200);
    expect(body.needsMfa).toBe(false);
    expect(typeof body.id).toBe('string');
    expect(cookie).not.toBeNull();
  });
});

/* ============================================================================
 * Mode `always_totp` — stepped MFA via TOTP
 * ========================================================================== */

describe('POST /auth/login/finish — mode always_totp', () => {
  it('emits mfa_pending + wraps when TOTP is enrolled', async () => {
    const u = await seedUser('mfa-mode-totp-ok@example.com');

    // Bootstrap: log in with full session, enroll TOTP, switch mode,
    // log in again to observe the pending behaviour.
    const fullCookie = (
      await rawLogin('mfa-mode-totp-ok@example.com', TEST_PASSWORD)
    ).cookie!;
    await enrollTotpFor('mfa-mode-totp-ok@example.com', TEST_PASSWORD, fullCookie);
    await db
      .update(users)
      .set({ securityMode: 'always_totp' })
      .where(eq(users.id, u.id));

    const { status, body, cookie } = await rawLogin(
      'mfa-mode-totp-ok@example.com',
      TEST_PASSWORD,
    );
    expect(status).toBe(200);
    expect(body.needsMfa).toBe(true);
    expect(body.factorsNeeded).toEqual(['totp']);
    expect(typeof body.wrappedMainKey).toBe('string');
    expect(typeof body.wrappedKekPassword).toBe('string');
    expect(cookie).not.toBeNull();

    // Pending session row matches expected shape. The user has
    // multiple sessions at this point (full from bootstrap +
    // pending from this login) so we filter by kind explicitly.
    const pendingRows = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, u.id));
    const pendingRow = pendingRows.find((r) => r.kind === 'mfa_pending');
    expect(pendingRow).toBeDefined();
    expect(pendingRow?.mfaPasswordVerified).toBe(true);
    expect(pendingRow?.mfaTotpVerified).toBe(false);
  });

  it('falls through to a full session when mode demands TOTP but it is not enrolled (safety net)', async () => {
    const u = await seedUser('mfa-mode-totp-missing@example.com');
    // Force the mode without enrolling TOTP — mismatched state,
    // should NOT lock the user out.
    await db
      .update(users)
      .set({ securityMode: 'always_totp' })
      .where(eq(users.id, u.id));

    const { status, body, cookie } = await rawLogin(
      'mfa-mode-totp-missing@example.com',
      TEST_PASSWORD,
    );
    expect(status).toBe(200);
    expect(body.needsMfa).toBe(false);
    expect(cookie).not.toBeNull();
  });
});

/* ============================================================================
 * POST /auth/mfa/totp/verify — pending → full
 * ========================================================================== */

describe('POST /auth/mfa/totp/verify', () => {
  async function setupPending(email: string): Promise<{
    pendingCookie: string;
    secret: string;
  }> {
    const u = await seedUser(email);
    const fullCookie = (await rawLogin(email, TEST_PASSWORD)).cookie!;
    const { secret } = await enrollTotpFor(email, TEST_PASSWORD, fullCookie);
    await db
      .update(users)
      .set({ securityMode: 'always_totp' })
      .where(eq(users.id, u.id));
    const pending = await rawLogin(email, TEST_PASSWORD);
    expect(pending.body.needsMfa).toBe(true);
    return { pendingCookie: pending.cookie!, secret };
  }

  it('401 unauthenticated when no mfa_pending cookie', async () => {
    const res = await app.request(
      '/auth/mfa/totp/verify',
      jsonPost({ code: '123456' }),
    );
    expect(res.status).toBe(401);
  });

  it('401 with a wrong TOTP code', async () => {
    const { pendingCookie } = await setupPending('mfa-verify-bad@example.com');
    const res = await app.request('/auth/mfa/totp/verify', {
      ...jsonPost({ code: '000000' }),
      headers: { 'content-type': 'application/json', cookie: pendingCookie },
    });
    expect(res.status).toBe(401);
  });

  it('finalizes + swaps cookie when the TOTP code is correct', async () => {
    const { pendingCookie, secret } = await setupPending(
      'mfa-verify-ok@example.com',
    );
    const code = await otplibGenerate({
      strategy: 'totp',
      secret,
      digits: 6,
      period: 30,
      algorithm: 'sha1',
    });
    const res = await app.request('/auth/mfa/totp/verify', {
      ...jsonPost({ code }),
      headers: { 'content-type': 'application/json', cookie: pendingCookie },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { finalized: boolean };
    expect(body.finalized).toBe(true);

    // New cookie issued.
    const newCookie = extractCookie(res);
    expect(newCookie).not.toBeNull();
    expect(newCookie).not.toBe(pendingCookie);

    // The old pending session is gone (DELETE pending + INSERT full
    // ran in a transaction).
    const oldId = pendingCookie.split('=')[1]!.split('.')[0]!;
    const oldRows = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, oldId));
    expect(oldRows).toHaveLength(0);
  });

  it('accepts a backup code in the same field', async () => {
    const u = await seedUser('mfa-verify-backup@example.com');
    const fullCookie = (
      await rawLogin('mfa-verify-backup@example.com', TEST_PASSWORD)
    ).cookie!;
    // We need the raw backup codes — re-enroll and capture them.
    const proof = await passwordProofFor(
      app,
      'mfa-verify-backup@example.com',
      TEST_PASSWORD,
    );
    const startRes = await app.request('/auth/totp/enroll/start', {
      ...jsonPost(proof),
      headers: { 'content-type': 'application/json', cookie: fullCookie },
    });
    const { secretBase32, backupCodes } = (await startRes.json()) as {
      secretBase32: string;
      backupCodes: string[];
    };
    const totpCode = await otplibGenerate({
      strategy: 'totp',
      secret: secretBase32,
      digits: 6,
      period: 30,
      algorithm: 'sha1',
    });
    await app.request('/auth/totp/enroll/verify', {
      ...jsonPost({ code: totpCode, backupCodesAcknowledged: true }),
      headers: { 'content-type': 'application/json', cookie: fullCookie },
    });
    await db
      .update(users)
      .set({ securityMode: 'always_totp' })
      .where(eq(users.id, u.id));

    const pending = await rawLogin(
      'mfa-verify-backup@example.com',
      TEST_PASSWORD,
    );
    expect(pending.body.needsMfa).toBe(true);

    const oneBackup = backupCodes[0]!;
    const res = await app.request('/auth/mfa/totp/verify', {
      ...jsonPost({ code: oneBackup }),
      headers: { 'content-type': 'application/json', cookie: pending.cookie! },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { finalized: boolean };
    expect(body.finalized).toBe(true);

    // Same backup code can't be reused — second attempt must fail.
    // Need another pending session for the replay check.
    const pending2 = await rawLogin(
      'mfa-verify-backup@example.com',
      TEST_PASSWORD,
    );
    const replayRes = await app.request('/auth/mfa/totp/verify', {
      ...jsonPost({ code: oneBackup }),
      headers: { 'content-type': 'application/json', cookie: pending2.cookie! },
    });
    expect(replayRes.status).toBe(401);
  });

  it('refuses an already-finalized cookie on subsequent calls', async () => {
    const { pendingCookie, secret } = await setupPending(
      'mfa-verify-replay@example.com',
    );
    const code1 = await otplibGenerate({
      strategy: 'totp',
      secret,
      digits: 6,
      period: 30,
      algorithm: 'sha1',
    });
    const finalize = await app.request('/auth/mfa/totp/verify', {
      ...jsonPost({ code: code1 }),
      headers: { 'content-type': 'application/json', cookie: pendingCookie },
    });
    expect(finalize.status).toBe(200);

    // Replay with the OLD pending cookie — server deleted that
    // pending row; verify must 401.
    const code2 = await otplibGenerate({
      strategy: 'totp',
      secret,
      digits: 6,
      period: 30,
      algorithm: 'sha1',
    });
    const replay = await app.request('/auth/mfa/totp/verify', {
      ...jsonPost({ code: code2 }),
      headers: { 'content-type': 'application/json', cookie: pendingCookie },
    });
    expect(replay.status).toBe(401);
  });
});

/* ============================================================================
 * /auth/me sanity check — refuses mfa_pending cookies
 * ========================================================================== */

describe('GET /auth/me — refuses mfa_pending cookie', () => {
  it('returns 401 with an mfa_pending cookie (only `full` accepted)', async () => {
    const u = await seedUser('me-pending@example.com');
    const fullCookie = (
      await rawLogin('me-pending@example.com', TEST_PASSWORD)
    ).cookie!;
    await enrollTotpFor('me-pending@example.com', TEST_PASSWORD, fullCookie);
    await db
      .update(users)
      .set({ securityMode: 'always_totp' })
      .where(eq(users.id, u.id));
    const pending = await rawLogin('me-pending@example.com', TEST_PASSWORD);
    expect(pending.body.needsMfa).toBe(true);

    const meRes = await app.request('/auth/me', {
      headers: { cookie: pending.cookie! },
    });
    expect(meRes.status).toBe(401);
  });
});

