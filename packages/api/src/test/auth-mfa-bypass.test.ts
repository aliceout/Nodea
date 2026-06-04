/**
 * Integration tests for the MFA bypass routes (Auth-Roadmap Phase 6,
 * Auth-Spec §7.8 + §6.2).
 *
 * Routes under test:
 *   - POST /auth/mfa/bypass/request    (mfa_pending)
 *   - GET  /auth/mfa/bypass/confirm    (anon, token)
 *   - Lazy application at login (/auth/login/finish)
 *   - Auto-cancel of pending bypasses on full-session promotion
 *
 * The "perdu 2 trucs = niqué" rule (§6.2) is exercised by mode
 * `maximum` scenarios. Email side-effects are observed via the
 * `recording` email service.
 */
import "./setup.ts";
import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { client, ready } from '@serenity-kit/opaque';
import { generate as otplibGenerate } from 'otplib';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../app.ts';
import { db } from '../db/client.ts';
import {
  authFactors,
  mfaBypassRequests,
  mfaTotp,
  mfaTotpRecoveryCodes,
  users,
} from '../db/schema.ts';
import {
  TEST_PASSWORD,
  extractCookie,
  seedUser,
} from './helpers.ts';
import {
  __getRecordingEmailService,
  __resetEmailServiceCache,
} from '../services/email/index.ts';
import { hashBypassToken } from '../auth/mfa-bypass.ts';

const app = buildApp();

function jsonPost(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

async function rawLogin(email: string, password: string): Promise<{
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
  if (startRes.status !== 200) return { status: startRes.status, body: {}, cookie: null };
  const { loginResponse, loginToken } = (await startRes.json()) as {
    loginResponse: string;
    loginToken: string;
  };
  const finished = client.finishLogin({ password, clientLoginState, loginResponse });
  if (!finished) throw new Error('rawLogin: bad password');
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

async function enrollTotpDirect(userId: string): Promise<void> {
  await db.insert(mfaTotp).values({
    userId,
    secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
    algo: 'SHA1',
    digits: 6,
    period: 30,
    enabledAt: new Date(),
    lastWindow: null,
  });
  // Add 10 backup codes so the bypass DELETE has something to wipe.
  for (let i = 0; i < 10; i++) {
    await db.insert(mfaTotpRecoveryCodes).values({
      id: randomUUID(),
      userId,
      codeHash: 'a'.repeat(64),
      usedAt: null,
    });
  }
}

async function enrollPrfPasskeyDirect(userId: string): Promise<void> {
  await db.insert(authFactors).values({
    id: randomUUID(),
    userId,
    kind: 'passkey',
    credentialId: randomUUID().replace(/-/g, ''),
    publicKey: 'fake-pk-' + randomUUID(),
    signCount: 0,
    signCountStrict: true,
    transports: 'internal',
    prfSupported: true,
    wrappedKek: 'fake-wrap',
    wrappedKekIv: 'fake-iv',
    label: 'Test PRF',
  });
}

async function getPendingCookie(
  email: string,
  mode: 'always_2fa' | 'maximum',
  withPrfPasskey = false,
): Promise<{ userId: string; cookie: string }> {
  const u = await seedUser(email);
  await enrollTotpDirect(u.id);
  if (withPrfPasskey) await enrollPrfPasskeyDirect(u.id);
  await db
    .update(users)
    .set({ securityMode: mode })
    .where(eq(users.id, u.id));
  const r = await rawLogin(email, TEST_PASSWORD);
  if (!r.cookie) throw new Error('getPendingCookie: no cookie');
  return { userId: u.id, cookie: r.cookie };
}

beforeEach(() => {
  // Force the recording email service for this suite + reset both
  // the per-test outbox AND the singleton cache so the env-var flip
  // takes effect.
  process.env.EMAIL_SERVICE_IMPL = 'recording';
  __resetEmailServiceCache();
  __getRecordingEmailService().reset();
});

/* ============================================================================
 * POST /auth/mfa/bypass/request
 * ========================================================================== */

describe('POST /auth/mfa/bypass/request', () => {
  it('401 unauthenticated', async () => {
    const res = await app.request(
      '/auth/mfa/bypass/request',
      jsonPost({ factor: 'totp' }),
    );
    expect(res.status).toBe(401);
  });

  it('200 + creates a request + sends email (factor=totp, mode=always_2fa)', async () => {
    const { userId, cookie } = await getPendingCookie(
      'bypass-totp-ok@example.com',
      'always_2fa',
    );

    const res = await app.request('/auth/mfa/bypass/request', {
      ...jsonPost({ factor: 'totp' }),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { earliestApplyAt: string };
    expect(typeof body.earliestApplyAt).toBe('string');

    const rows = await db
      .select()
      .from(mfaBypassRequests)
      .where(eq(mfaBypassRequests.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.factor).toBe('totp');
    expect(rows[0]?.confirmedAt).toBeNull();

    const sent = __getRecordingEmailService().sent;
    expect(sent.length).toBeGreaterThanOrEqual(1);
    const last = sent[sent.length - 1];
    expect(last?.tag).toBe('mfa-bypass-request');
    expect(last?.to).toBe('bypass-totp-ok@example.com');
  });

  it('409 multi_factor_loss: mode=maximum with totp bypass when passkey not verified', async () => {
    // mode=max + only password verified at mfa_pending → totp bypass
    // requires both password AND passkey verified, so it's blocked.
    const { cookie } = await getPendingCookie(
      'bypass-totp-multi@example.com',
      'maximum',
      true, // has a PRF passkey enrolled but NOT verified in this session
    );

    const res = await app.request('/auth/mfa/bypass/request', {
      ...jsonPost({ factor: 'totp' }),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('multi_factor_loss');
  });

  it('409 bypass_already_active: a second request while one is pending', async () => {
    const { cookie } = await getPendingCookie(
      'bypass-double@example.com',
      'always_2fa',
    );

    const r1 = await app.request('/auth/mfa/bypass/request', {
      ...jsonPost({ factor: 'totp' }),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(r1.status).toBe(200);

    const r2 = await app.request('/auth/mfa/bypass/request', {
      ...jsonPost({ factor: 'totp' }),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(r2.status).toBe(409);
    const body = (await r2.json()) as { error: string };
    expect(body.error).toBe('bypass_already_active');
  });

  it('400 factor_not_required: mode=password_or_passkey can\'t request bypass', async () => {
    // Tricky to set up since mode=p_o_p doesn't emit mfa_pending in
    // the first place. We force the row to mfa_pending then change
    // the mode after, simulating a degenerate state.
    const u = await seedUser('bypass-not-required@example.com');
    await enrollTotpDirect(u.id);
    await db
      .update(users)
      .set({ securityMode: 'always_2fa' })
      .where(eq(users.id, u.id));
    const r = await rawLogin('bypass-not-required@example.com', TEST_PASSWORD);
    expect(r.body.needsMfa).toBe(true);
    // Now downgrade the mode behind the pending session's back.
    await db
      .update(users)
      .set({ securityMode: 'password_or_passkey' })
      .where(eq(users.id, u.id));

    const res = await app.request('/auth/mfa/bypass/request', {
      ...jsonPost({ factor: 'totp' }),
      headers: { 'content-type': 'application/json', cookie: r.cookie! },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('factor_not_required');
  });
});

/* ============================================================================
 * GET /auth/mfa/bypass/confirm
 * ========================================================================== */

describe('GET /auth/mfa/bypass/confirm', () => {
  async function createPendingRequest(
    email: string,
  ): Promise<{ userId: string; confirmToken: string }> {
    const { userId, cookie } = await getPendingCookie(email, 'always_2fa');
    await app.request('/auth/mfa/bypass/request', {
      ...jsonPost({ factor: 'totp' }),
      headers: { 'content-type': 'application/json', cookie },
    });
    // Pull the token from the recorded email body — it's the only
    // place the plaintext token is reachable from a test (DB only
    // has the hash).
    const sent = __getRecordingEmailService().sent;
    const last = sent[sent.length - 1];
    expect(last).toBeDefined();
    const text = last!.text;
    const confirmMatch = text.match(/confirm\?t=([A-Za-z0-9_-]+)/);
    expect(confirmMatch).not.toBeNull();
    return {
      userId,
      confirmToken: confirmMatch![1]!,
    };
  }

  it('confirm flips confirmed_at + returns 200 JSON with status=ok', async () => {
    const { userId, confirmToken } = await createPendingRequest(
      'bypass-confirm@example.com',
    );

    const res = await app.request(
      `/auth/mfa/bypass/confirm?t=${confirmToken}`,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = (await res.json()) as {
      status: string;
      factor?: string;
      earliestApplyAt?: string;
    };
    expect(body.status).toBe('ok');
    expect(body.factor).toBe('totp');
    expect(typeof body.earliestApplyAt).toBe('string');

    const [row] = await db
      .select()
      .from(mfaBypassRequests)
      .where(eq(mfaBypassRequests.userId, userId));
    expect(row?.confirmedAt).not.toBeNull();
  });

  it('confirm with an unknown token → 404 + status=unknown', async () => {
    const res = await app.request(
      '/auth/mfa/bypass/confirm?t=not-a-real-token-just-padding-chars-here',
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('unknown');
  });

  it('confirm a second time → 200 with status=already_confirmed', async () => {
    const { confirmToken } = await createPendingRequest(
      'bypass-double-confirm@example.com',
    );
    const r1 = await app.request(`/auth/mfa/bypass/confirm?t=${confirmToken}`);
    expect(r1.status).toBe(200);
    const r2 = await app.request(`/auth/mfa/bypass/confirm?t=${confirmToken}`);
    expect(r2.status).toBe(200);
    const body = (await r2.json()) as { status: string };
    expect(body.status).toBe('already_confirmed');
  });

  it('confirm AFTER auto-cancel-on-login → 410 with status=cancelled', async () => {
    // Insert a confirmed bypass directly for a user, then trigger an
    // auto-cancel by logging the user in (a successful full-session
    // promotion flips `cancelled_at`). Re-using the confirm token
    // afterwards must surface `cancelled`.
    const { userId, confirmToken } = await createPendingRequest(
      'bypass-cancel-then-confirm@example.com',
    );
    // Login to trigger the auto-cancel (mode is `always_2fa`, so
    // we need to enter MFA — but rawLogin only does password. We
    // skip the MFA step and flip `cancelled_at` manually to mirror
    // what `cancelPendingBypassesForUser` would do.)
    await db
      .update(mfaBypassRequests)
      .set({ cancelledAt: new Date() })
      .where(eq(mfaBypassRequests.userId, userId));
    const res = await app.request(
      `/auth/mfa/bypass/confirm?t=${confirmToken}`,
    );
    expect(res.status).toBe(410);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('cancelled');
  });
});

/* ============================================================================
 * Lazy application at login
 * ========================================================================== */

describe('lazy bypass application at login', () => {
  it('a confirmed-past-delay totp bypass disables TOTP + downgrades mode + lets login finish full', async () => {
    const u = await seedUser('bypass-apply-totp@example.com');
    await enrollTotpDirect(u.id);
    await db
      .update(users)
      .set({ securityMode: 'always_2fa' })
      .where(eq(users.id, u.id));
    // Insert a confirmed-past-delay bypass directly (skip the email
    // round-trip; we exercise that elsewhere). 8 days = comfortably
    // past the 7-day apply delay.
    const past = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await db.insert(mfaBypassRequests).values({
      id: randomUUID(),
      userId: u.id,
      factor: 'totp',
      confirmTokenHash: hashBypassToken('confirm-' + randomUUID()),
      cancelTokenHash: hashBypassToken('cancel-' + randomUUID()),
      confirmedAt: past,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      cancelledAt: null,
      consumedAt: null,
    });

    const r = await rawLogin('bypass-apply-totp@example.com', TEST_PASSWORD);
    expect(r.status).toBe(200);
    expect(r.body.needsMfa).toBe(false);

    // Side effects landed.
    const [totp] = await db
      .select()
      .from(mfaTotp)
      .where(eq(mfaTotp.userId, u.id));
    expect(totp?.enabledAt).toBeNull();

    const codes = await db
      .select()
      .from(mfaTotpRecoveryCodes)
      .where(eq(mfaTotpRecoveryCodes.userId, u.id));
    expect(codes).toHaveLength(0);

    const [user] = await db
      .select({ mode: users.securityMode })
      .from(users)
      .where(eq(users.id, u.id));
    expect(user?.mode).toBe('password_or_passkey');

    // The bypass row is consumed.
    const [bypass] = await db
      .select()
      .from(mfaBypassRequests)
      .where(eq(mfaBypassRequests.userId, u.id));
    expect(bypass?.consumedAt).not.toBeNull();
  });

  it('issue #72: totp bypass in always_2fa with a passkey enrolled keeps the mode', async () => {
    // Same shape as the previous test, but the user also has a
    // passkey. After the bypass consumes TOTP, the passkey carries
    // 2FA so `always_2fa` must stay in place (no downgrade).
    const u = await seedUser('bypass-keep-2fa-totp@example.com');
    await enrollTotpDirect(u.id);
    await enrollPrfPasskeyDirect(u.id);
    await db
      .update(users)
      .set({ securityMode: 'always_2fa' })
      .where(eq(users.id, u.id));
    const past = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await db.insert(mfaBypassRequests).values({
      id: randomUUID(),
      userId: u.id,
      factor: 'totp',
      confirmTokenHash: hashBypassToken('confirm-' + randomUUID()),
      cancelTokenHash: hashBypassToken('cancel-' + randomUUID()),
      confirmedAt: past,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      cancelledAt: null,
      consumedAt: null,
    });

    const r = await rawLogin('bypass-keep-2fa-totp@example.com', TEST_PASSWORD);
    expect(r.status).toBe(200);

    const [user] = await db
      .select({ mode: users.securityMode })
      .from(users)
      .where(eq(users.id, u.id));
    expect(user?.mode).toBe('always_2fa');
  });

  it('issue #72: passkey bypass in always_2fa (passkey-only) downgrades to standard', async () => {
    // User keeps a passkey as the sole 2nd factor in always_2fa
    // (since #72). Consuming a passkey bypass deletes all passkeys ;
    // with no TOTP enrolled, mode must downgrade.
    const u = await seedUser('bypass-downgrade-passkey@example.com');
    await enrollPrfPasskeyDirect(u.id);
    await db
      .update(users)
      .set({ securityMode: 'always_2fa' })
      .where(eq(users.id, u.id));
    const past = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await db.insert(mfaBypassRequests).values({
      id: randomUUID(),
      userId: u.id,
      factor: 'passkey',
      confirmTokenHash: hashBypassToken('confirm-' + randomUUID()),
      cancelTokenHash: hashBypassToken('cancel-' + randomUUID()),
      confirmedAt: past,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      cancelledAt: null,
      consumedAt: null,
    });

    const r = await rawLogin(
      'bypass-downgrade-passkey@example.com',
      TEST_PASSWORD,
    );
    expect(r.status).toBe(200);

    const [user] = await db
      .select({ mode: users.securityMode })
      .from(users)
      .where(eq(users.id, u.id));
    expect(user?.mode).toBe('password_or_passkey');
  });

  it('issue #72: passkey bypass in always_2fa with TOTP enabled keeps the mode', async () => {
    // User has both factors. Consuming a passkey bypass deletes
    // every passkey row, but TOTP still covers 2FA — mode stays.
    const u = await seedUser('bypass-keep-2fa-passkey@example.com');
    await enrollTotpDirect(u.id);
    await enrollPrfPasskeyDirect(u.id);
    await db
      .update(users)
      .set({ securityMode: 'always_2fa' })
      .where(eq(users.id, u.id));
    const past = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await db.insert(mfaBypassRequests).values({
      id: randomUUID(),
      userId: u.id,
      factor: 'passkey',
      confirmTokenHash: hashBypassToken('confirm-' + randomUUID()),
      cancelTokenHash: hashBypassToken('cancel-' + randomUUID()),
      confirmedAt: past,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      cancelledAt: null,
      consumedAt: null,
    });

    const r = await rawLogin(
      'bypass-keep-2fa-passkey@example.com',
      TEST_PASSWORD,
    );
    expect(r.status).toBe(200);

    const [user] = await db
      .select({ mode: users.securityMode })
      .from(users)
      .where(eq(users.id, u.id));
    expect(user?.mode).toBe('always_2fa');
  });

  it('a not-yet-confirmed bypass is NOT consumed at login (still gates MFA)', async () => {
    const u = await seedUser('bypass-pending@example.com');
    await enrollTotpDirect(u.id);
    await db
      .update(users)
      .set({ securityMode: 'always_2fa' })
      .where(eq(users.id, u.id));
    await db.insert(mfaBypassRequests).values({
      id: randomUUID(),
      userId: u.id,
      factor: 'totp',
      confirmTokenHash: hashBypassToken('confirm-' + randomUUID()),
      cancelTokenHash: hashBypassToken('cancel-' + randomUUID()),
      confirmedAt: null, // never confirmed
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      cancelledAt: null,
      consumedAt: null,
    });

    const r = await rawLogin('bypass-pending@example.com', TEST_PASSWORD);
    expect(r.body.needsMfa).toBe(true);

    // Bypass row still pending.
    const [bypass] = await db
      .select()
      .from(mfaBypassRequests)
      .where(eq(mfaBypassRequests.userId, u.id));
    expect(bypass?.consumedAt).toBeNull();
    expect(bypass?.confirmedAt).toBeNull();
  });

  it('a confirmed-but-too-recent bypass (< apply delay) is NOT consumed yet', async () => {
    const u = await seedUser('bypass-too-recent@example.com');
    await enrollTotpDirect(u.id);
    await db
      .update(users)
      .set({ securityMode: 'always_2fa' })
      .where(eq(users.id, u.id));
    const recent = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago
    await db.insert(mfaBypassRequests).values({
      id: randomUUID(),
      userId: u.id,
      factor: 'totp',
      confirmTokenHash: hashBypassToken('confirm-' + randomUUID()),
      cancelTokenHash: hashBypassToken('cancel-' + randomUUID()),
      confirmedAt: recent,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      cancelledAt: null,
      consumedAt: null,
    });

    const r = await rawLogin('bypass-too-recent@example.com', TEST_PASSWORD);
    expect(r.body.needsMfa).toBe(true);

    const [bypass] = await db
      .select()
      .from(mfaBypassRequests)
      .where(eq(mfaBypassRequests.userId, u.id));
    expect(bypass?.consumedAt).toBeNull();
  });
});

/* ============================================================================
 * Auto-cancel on successful login
 * ========================================================================== */

describe('auto-cancel on full-session promotion', () => {
  it('a successful full-session login auto-cancels any pending bypass', async () => {
    // The legit user re-gained access to the factor they claimed to
    // have lost — completing a full login proves it, so the bypass
    // request is invalidated automatically. Also defangs an attacker
    // who triggered a bypass against the user.
    const u = await seedUser('bypass-auto-cancel@example.com');
    await db.insert(mfaBypassRequests).values({
      id: randomUUID(),
      userId: u.id,
      factor: 'totp',
      confirmTokenHash: hashBypassToken('confirm-' + randomUUID()),
      cancelTokenHash: hashBypassToken('cancel-' + randomUUID()),
      confirmedAt: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      cancelledAt: null,
      consumedAt: null,
    });

    const r = await rawLogin('bypass-auto-cancel@example.com', TEST_PASSWORD);
    expect(r.status).toBe(200);
    expect(r.body.needsMfa).toBe(false);

    const [row] = await db
      .select()
      .from(mfaBypassRequests)
      .where(eq(mfaBypassRequests.userId, u.id));
    expect(row?.cancelledAt).not.toBeNull();
    expect(row?.consumedAt).toBeNull();
  });
});

// `otplibGenerate` would be used if we tested the auto-promote
// interaction; here we use direct DB inserts for setup speed.
void otplibGenerate;
