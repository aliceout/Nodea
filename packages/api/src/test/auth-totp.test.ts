/**
 * Integration tests for the TOTP management routes (Auth-Roadmap
 * Phase 5B, Auth-Spec §8).
 *
 * Routes under test:
 *   - POST /auth/totp/enroll/start              (auth, password proof)
 *   - POST /auth/totp/enroll/verify             (auth)
 *   - POST /auth/totp/disable                   (auth, password proof)
 *   - POST /auth/totp/backup-codes/regenerate   (auth, password proof)
 *   - GET  /auth/me                             (totpEnabled flips)
 *
 * The verify-step assertion uses `otplib.generateSync` against the
 * exact secret returned by /enroll/start, so the test matches a
 * real authenticator's output without time travel.
 */
import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { generate as otplibGenerate } from 'otplib';
import { buildApp } from '../app.ts';
import { db } from '../db/client.ts';
import {
  authFactors,
  mfaTotp,
  mfaTotpRecoveryCodes,
  sessions,
  users,
} from '../db/schema.ts';
import { __getRecordingEmailService } from '../services/email/index.ts';
import { loginAs, passwordProofFor, seedUser, TEST_PASSWORD } from './setup.ts';

async function enrollPasskeyDirect(userId: string): Promise<void> {
  await db.insert(authFactors).values({
    id: randomUUID(),
    userId,
    kind: 'passkey',
    credentialId: randomUUID().replace(/-/g, ''),
    publicKey: 'fake-pk-' + randomUUID(),
    signCount: 0,
    signCountStrict: true,
    transports: 'internal',
    prfSupported: false,
    wrappedKek: null,
    wrappedKekIv: null,
    label: 'Test passkey',
  });
}

const app = buildApp();

function jsonPost(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

async function totpFromSecret(secret: string): Promise<string> {
  return otplibGenerate({
    strategy: 'totp',
    secret,
    digits: 6,
    period: 30,
    algorithm: 'sha1',
  });
}

/* ============================================================================
 * POST /auth/totp/enroll/start
 * ========================================================================== */

describe('POST /auth/totp/enroll/start', () => {
  it('401 unauthenticated', async () => {
    const res = await app.request(
      '/auth/totp/enroll/start',
      jsonPost({}),
    );
    expect(res.status).toBe(401);
  });

  it('401 reauth_required when the session is stale (Phase 7B)', async () => {
    await seedUser('totp-stale@example.com');
    const cookie = await loginAs(app, 'totp-stale@example.com', TEST_PASSWORD);
    const sessionId = cookie.replace(/^nodea_session=/, '').split('.')[0]!;
    await db
      .update(sessions)
      .set({ reauthPasswordAt: new Date(Date.now() - 6 * 60_000) })
      .where(eq(sessions.id, sessionId));

    const res = await app.request('/auth/totp/enroll/start', {
      ...jsonPost({}),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({
      error: 'reauth_required',
      reauth_required: 'password',
    });
  });

  it('persists a pending mfa_totp row + 10 backup codes, returns secret + URI + codes', async () => {
    const u = await seedUser('totp-start@example.com');
    const cookie = await loginAs(app, 'totp-start@example.com', TEST_PASSWORD);
    const proof = await passwordProofFor(app, 'totp-start@example.com', TEST_PASSWORD);

    const res = await app.request('/auth/totp/enroll/start', {
      ...jsonPost(proof),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      secretBase32: string;
      otpauthUri: string;
      backupCodes: string[];
    };
    expect(body.secretBase32).toMatch(/^[A-Z2-7]{32}$/);
    expect(body.otpauthUri.startsWith('otpauth://totp/')).toBe(true);
    expect(body.backupCodes).toHaveLength(10);
    expect(new Set(body.backupCodes).size).toBe(10);

    const [row] = await db
      .select()
      .from(mfaTotp)
      .where(eq(mfaTotp.userId, u.id));
    expect(row?.enabledAt).toBeNull();
    expect(row?.secret).toBe(body.secretBase32);

    const codes = await db
      .select()
      .from(mfaTotpRecoveryCodes)
      .where(eq(mfaTotpRecoveryCodes.userId, u.id));
    expect(codes).toHaveLength(10);
    for (const c of codes) {
      expect(c.usedAt).toBeNull();
      expect(c.codeHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('UPSERTs a fresh secret on a second start (replaces abandoned enrollment)', async () => {
    const u = await seedUser('totp-restart@example.com');
    const cookie = await loginAs(app, 'totp-restart@example.com', TEST_PASSWORD);

    const proof1 = await passwordProofFor(app, 'totp-restart@example.com', TEST_PASSWORD);
    const r1 = await app.request('/auth/totp/enroll/start', {
      ...jsonPost(proof1),
      headers: { 'content-type': 'application/json', cookie },
    });
    const b1 = (await r1.json()) as { secretBase32: string };

    const proof2 = await passwordProofFor(app, 'totp-restart@example.com', TEST_PASSWORD);
    const r2 = await app.request('/auth/totp/enroll/start', {
      ...jsonPost(proof2),
      headers: { 'content-type': 'application/json', cookie },
    });
    const b2 = (await r2.json()) as { secretBase32: string };

    expect(b1.secretBase32).not.toBe(b2.secretBase32);
    const [row] = await db
      .select({ secret: mfaTotp.secret })
      .from(mfaTotp)
      .where(eq(mfaTotp.userId, u.id));
    expect(row?.secret).toBe(b2.secretBase32);

    const codes = await db
      .select()
      .from(mfaTotpRecoveryCodes)
      .where(eq(mfaTotpRecoveryCodes.userId, u.id));
    expect(codes).toHaveLength(10); // Old batch was wiped, new batch present.
  });
});

/* ============================================================================
 * POST /auth/totp/enroll/verify
 * ========================================================================== */

describe('POST /auth/totp/enroll/verify', () => {
  it('400 when no enrollment is pending', async () => {
    await seedUser('totp-verify-empty@example.com');
    const cookie = await loginAs(app, 'totp-verify-empty@example.com', TEST_PASSWORD);
    const res = await app.request('/auth/totp/enroll/verify', {
      ...jsonPost({ code: '123456', backupCodesAcknowledged: true }),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status).toBe(400);
  });

  it('401 with a code that doesn\'t match the pending secret', async () => {
    await seedUser('totp-verify-bad@example.com');
    const cookie = await loginAs(app, 'totp-verify-bad@example.com', TEST_PASSWORD);
    const proof = await passwordProofFor(
      app,
      'totp-verify-bad@example.com',
      TEST_PASSWORD,
    );
    await app.request('/auth/totp/enroll/start', {
      ...jsonPost(proof),
      headers: { 'content-type': 'application/json', cookie },
    });

    const res = await app.request('/auth/totp/enroll/verify', {
      ...jsonPost({ code: '000000', backupCodesAcknowledged: true }),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status).toBe(401);
  });

  it('flips enabled_at when the code matches and ack is true', async () => {
    const u = await seedUser('totp-verify-ok@example.com');
    const cookie = await loginAs(app, 'totp-verify-ok@example.com', TEST_PASSWORD);
    const proof = await passwordProofFor(
      app,
      'totp-verify-ok@example.com',
      TEST_PASSWORD,
    );
    const startRes = await app.request('/auth/totp/enroll/start', {
      ...jsonPost(proof),
      headers: { 'content-type': 'application/json', cookie },
    });
    const { secretBase32 } = (await startRes.json()) as { secretBase32: string };
    const code = await totpFromSecret(secretBase32);

    const verifyRes = await app.request('/auth/totp/enroll/verify', {
      ...jsonPost({ code, backupCodesAcknowledged: true }),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(verifyRes.status).toBe(200);

    const [row] = await db
      .select()
      .from(mfaTotp)
      .where(eq(mfaTotp.userId, u.id));
    expect(row?.enabledAt).not.toBeNull();
    expect(row?.lastWindow).not.toBeNull();
  });

  it('auto-promotes security_mode to always_2fa when verifying from password_or_passkey (Phase 5D)', async () => {
    const u = await seedUser('totp-auto-promote@example.com');
    const cookie = await loginAs(app, 'totp-auto-promote@example.com', TEST_PASSWORD);
    const proof = await passwordProofFor(
      app,
      'totp-auto-promote@example.com',
      TEST_PASSWORD,
    );
    const startRes = await app.request('/auth/totp/enroll/start', {
      ...jsonPost(proof),
      headers: { 'content-type': 'application/json', cookie },
    });
    const { secretBase32 } = (await startRes.json()) as { secretBase32: string };
    const code = await totpFromSecret(secretBase32);

    const verifyRes = await app.request('/auth/totp/enroll/verify', {
      ...jsonPost({ code, backupCodesAcknowledged: true }),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(verifyRes.status).toBe(200);

    const [row] = await db
      .select({ mode: users.securityMode })
      .from(users)
      .where(eq(users.id, u.id));
    expect(row?.mode).toBe('always_2fa');
  });

  it('does NOT downgrade an already-strict mode (maximum stays maximum)', async () => {
    const u = await seedUser('totp-no-clobber@example.com');
    // Force mode to maximum BEFORE enrolling (would normally need
    // TOTP + passkey, but we're forcing for the test).
    await db
      .update(users)
      .set({ securityMode: 'maximum' })
      .where(eq(users.id, u.id));

    const cookie = await loginAs(app, 'totp-no-clobber@example.com', TEST_PASSWORD);
    const proof = await passwordProofFor(
      app,
      'totp-no-clobber@example.com',
      TEST_PASSWORD,
    );
    const startRes = await app.request('/auth/totp/enroll/start', {
      ...jsonPost(proof),
      headers: { 'content-type': 'application/json', cookie },
    });
    const { secretBase32 } = (await startRes.json()) as { secretBase32: string };
    const code = await totpFromSecret(secretBase32);

    await app.request('/auth/totp/enroll/verify', {
      ...jsonPost({ code, backupCodesAcknowledged: true }),
      headers: { 'content-type': 'application/json', cookie },
    });

    const [row] = await db
      .select({ mode: users.securityMode })
      .from(users)
      .where(eq(users.id, u.id));
    expect(row?.mode).toBe('maximum');
  });

  it('409 when TOTP is already enabled (no double-flip)', async () => {
    const u = await seedUser('totp-already-enabled@example.com');
    const cookie = await loginAs(
      app,
      'totp-already-enabled@example.com',
      TEST_PASSWORD,
    );
    const proof = await passwordProofFor(
      app,
      'totp-already-enabled@example.com',
      TEST_PASSWORD,
    );
    const startRes = await app.request('/auth/totp/enroll/start', {
      ...jsonPost(proof),
      headers: { 'content-type': 'application/json', cookie },
    });
    const { secretBase32 } = (await startRes.json()) as { secretBase32: string };
    const code = await totpFromSecret(secretBase32);
    await app.request('/auth/totp/enroll/verify', {
      ...jsonPost({ code, backupCodesAcknowledged: true }),
      headers: { 'content-type': 'application/json', cookie },
    });

    const code2 = await totpFromSecret(secretBase32);
    const res = await app.request('/auth/totp/enroll/verify', {
      ...jsonPost({ code: code2, backupCodesAcknowledged: true }),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status).toBe(409);

    void u;
  });
});

/* ============================================================================
 * GET /auth/me — totpEnabled flag flips
 * ========================================================================== */

describe('GET /auth/me — TOTP state', () => {
  it('reports totpEnabled=false + 0 backup codes for a fresh user', async () => {
    await seedUser('me-totp-fresh@example.com');
    const cookie = await loginAs(app, 'me-totp-fresh@example.com', TEST_PASSWORD);
    const res = await app.request('/auth/me', { headers: { cookie } });
    const body = (await res.json()) as {
      totpEnabled: boolean;
      totpBackupCodesRemaining: number;
      securityMode: string;
    };
    expect(body.totpEnabled).toBe(false);
    expect(body.totpBackupCodesRemaining).toBe(0);
    expect(body.securityMode).toBe('password_or_passkey');
  });

  it('reports totpEnabled=true + 10 backup codes after verify', async () => {
    await seedUser('me-totp-enabled@example.com');
    const cookie = await loginAs(app, 'me-totp-enabled@example.com', TEST_PASSWORD);
    const proof = await passwordProofFor(
      app,
      'me-totp-enabled@example.com',
      TEST_PASSWORD,
    );
    const startRes = await app.request('/auth/totp/enroll/start', {
      ...jsonPost(proof),
      headers: { 'content-type': 'application/json', cookie },
    });
    const { secretBase32 } = (await startRes.json()) as { secretBase32: string };
    const code = await totpFromSecret(secretBase32);
    await app.request('/auth/totp/enroll/verify', {
      ...jsonPost({ code, backupCodesAcknowledged: true }),
      headers: { 'content-type': 'application/json', cookie },
    });

    const meRes = await app.request('/auth/me', { headers: { cookie } });
    const body = (await meRes.json()) as {
      totpEnabled: boolean;
      totpBackupCodesRemaining: number;
    };
    expect(body.totpEnabled).toBe(true);
    expect(body.totpBackupCodesRemaining).toBe(10);
  });
});

/* ============================================================================
 * POST /auth/totp/disable + §6.1 downgrade auto
 * ========================================================================== */

describe('POST /auth/totp/disable', () => {
  it('wipes mfa_totp + backup codes, returns 200', async () => {
    const u = await seedUser('totp-disable@example.com');
    const cookie = await loginAs(app, 'totp-disable@example.com', TEST_PASSWORD);
    // Enroll first.
    const proof1 = await passwordProofFor(
      app,
      'totp-disable@example.com',
      TEST_PASSWORD,
    );
    const startRes = await app.request('/auth/totp/enroll/start', {
      ...jsonPost(proof1),
      headers: { 'content-type': 'application/json', cookie },
    });
    const { secretBase32 } = (await startRes.json()) as { secretBase32: string };
    const code = await totpFromSecret(secretBase32);
    await app.request('/auth/totp/enroll/verify', {
      ...jsonPost({ code, backupCodesAcknowledged: true }),
      headers: { 'content-type': 'application/json', cookie },
    });

    const proof2 = await passwordProofFor(
      app,
      'totp-disable@example.com',
      TEST_PASSWORD,
    );
    const res = await app.request('/auth/totp/disable', {
      ...jsonPost(proof2),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status).toBe(200);

    const totpRows = await db
      .select()
      .from(mfaTotp)
      .where(eq(mfaTotp.userId, u.id));
    expect(totpRows).toHaveLength(0);
    const codeRows = await db
      .select()
      .from(mfaTotpRecoveryCodes)
      .where(eq(mfaTotpRecoveryCodes.userId, u.id));
    expect(codeRows).toHaveLength(0);
  });

  it('§6.1 downgrade auto: disabling TOTP under always_2fa drops to password_or_passkey', async () => {
    const u = await seedUser('totp-downgrade@example.com');
    const cookie = await loginAs(app, 'totp-downgrade@example.com', TEST_PASSWORD);

    // Enroll TOTP.
    const proof1 = await passwordProofFor(
      app,
      'totp-downgrade@example.com',
      TEST_PASSWORD,
    );
    const startRes = await app.request('/auth/totp/enroll/start', {
      ...jsonPost(proof1),
      headers: { 'content-type': 'application/json', cookie },
    });
    const { secretBase32 } = (await startRes.json()) as { secretBase32: string };
    const code = await totpFromSecret(secretBase32);
    await app.request('/auth/totp/enroll/verify', {
      ...jsonPost({ code, backupCodesAcknowledged: true }),
      headers: { 'content-type': 'application/json', cookie },
    });

    // Force the user to mode `always_2fa`.
    await db
      .update(users)
      .set({ securityMode: 'always_2fa' })
      .where(eq(users.id, u.id));

    // Disable TOTP — should downgrade.
    const proof2 = await passwordProofFor(
      app,
      'totp-downgrade@example.com',
      TEST_PASSWORD,
    );
    const res = await app.request('/auth/totp/disable', {
      ...jsonPost(proof2),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status).toBe(200);

    const [row] = await db
      .select({ mode: users.securityMode })
      .from(users)
      .where(eq(users.id, u.id));
    expect(row?.mode).toBe('password_or_passkey');

    // Best-effort downgrade notification fired (recording transport).
    const sent = __getRecordingEmailService().sent;
    const notif = sent.find(
      (m) =>
        m.tag === 'security-mode-downgraded' &&
        m.to === 'totp-downgrade@example.com',
    );
    expect(notif).toBeDefined();
    expect(notif!.subject).toMatch(/Standard/i);
  });

  it('§6.1 issue #72: disabling TOTP under always_2fa keeps the mode when a passkey remains as 2nd factor', async () => {
    const u = await seedUser('totp-keep-2fa@example.com');
    const cookie = await loginAs(app, 'totp-keep-2fa@example.com', TEST_PASSWORD);

    // Enroll TOTP + a passkey (any kind — passkey alone is enough
    // as 2nd factor since #72).
    const proof1 = await passwordProofFor(
      app,
      'totp-keep-2fa@example.com',
      TEST_PASSWORD,
    );
    const startRes = await app.request('/auth/totp/enroll/start', {
      ...jsonPost(proof1),
      headers: { 'content-type': 'application/json', cookie },
    });
    const { secretBase32 } = (await startRes.json()) as { secretBase32: string };
    const code = await totpFromSecret(secretBase32);
    await app.request('/auth/totp/enroll/verify', {
      ...jsonPost({ code, backupCodesAcknowledged: true }),
      headers: { 'content-type': 'application/json', cookie },
    });
    await enrollPasskeyDirect(u.id);
    await db
      .update(users)
      .set({ securityMode: 'always_2fa' })
      .where(eq(users.id, u.id));

    const sentBefore = __getRecordingEmailService().sent.length;

    // Disable TOTP — should keep `always_2fa` (passkey covers it).
    const proof2 = await passwordProofFor(
      app,
      'totp-keep-2fa@example.com',
      TEST_PASSWORD,
    );
    const res = await app.request('/auth/totp/disable', {
      ...jsonPost(proof2),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status).toBe(200);

    const [row] = await db
      .select({ mode: users.securityMode })
      .from(users)
      .where(eq(users.id, u.id));
    expect(row?.mode).toBe('always_2fa');

    // No downgrade notification fired for this user.
    const sentAfter = __getRecordingEmailService().sent;
    const notif = sentAfter
      .slice(sentBefore)
      .find(
        (m) =>
          m.tag === 'security-mode-downgraded' &&
          m.to === 'totp-keep-2fa@example.com',
      );
    expect(notif).toBeUndefined();
  });

  it('§6.1 downgrade auto: no notification when user was already on password_or_passkey', async () => {
    const u = await seedUser('totp-no-downgrade@example.com');
    const cookie = await loginAs(
      app,
      'totp-no-downgrade@example.com',
      TEST_PASSWORD,
    );

    // Enroll TOTP — auto-promotes mode to always_2fa.
    const proof1 = await passwordProofFor(
      app,
      'totp-no-downgrade@example.com',
      TEST_PASSWORD,
    );
    const startRes = await app.request('/auth/totp/enroll/start', {
      ...jsonPost(proof1),
      headers: { 'content-type': 'application/json', cookie },
    });
    const { secretBase32 } = (await startRes.json()) as { secretBase32: string };
    const code = await totpFromSecret(secretBase32);
    await app.request('/auth/totp/enroll/verify', {
      ...jsonPost({ code, backupCodesAcknowledged: true }),
      headers: { 'content-type': 'application/json', cookie },
    });

    // Walk the user back down to password_or_passkey before disabling
    // — that's the path where no downgrade should fire.
    await db
      .update(users)
      .set({ securityMode: 'password_or_passkey' })
      .where(eq(users.id, u.id));

    __getRecordingEmailService().reset();
    const proof2 = await passwordProofFor(
      app,
      'totp-no-downgrade@example.com',
      TEST_PASSWORD,
    );
    const res = await app.request('/auth/totp/disable', {
      ...jsonPost(proof2),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status).toBe(200);

    const sent = __getRecordingEmailService().sent;
    const notif = sent.find(
      (m) => m.tag === 'security-mode-downgraded',
    );
    expect(notif).toBeUndefined();
  });
});

/* ============================================================================
 * POST /auth/totp/backup-codes/regenerate
 * ========================================================================== */

describe('POST /auth/totp/backup-codes/regenerate', () => {
  it('400 when TOTP is not enabled', async () => {
    await seedUser('totp-regen-disabled@example.com');
    const cookie = await loginAs(
      app,
      'totp-regen-disabled@example.com',
      TEST_PASSWORD,
    );
    const proof = await passwordProofFor(
      app,
      'totp-regen-disabled@example.com',
      TEST_PASSWORD,
    );
    const res = await app.request('/auth/totp/backup-codes/regenerate', {
      ...jsonPost(proof),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status).toBe(400);
  });

  it('replaces all old codes with 10 fresh ones', async () => {
    const u = await seedUser('totp-regen-ok@example.com');
    const cookie = await loginAs(app, 'totp-regen-ok@example.com', TEST_PASSWORD);
    // Enroll first.
    const proof1 = await passwordProofFor(
      app,
      'totp-regen-ok@example.com',
      TEST_PASSWORD,
    );
    const startRes = await app.request('/auth/totp/enroll/start', {
      ...jsonPost(proof1),
      headers: { 'content-type': 'application/json', cookie },
    });
    const { secretBase32 } = (await startRes.json()) as { secretBase32: string };
    const code = await totpFromSecret(secretBase32);
    await app.request('/auth/totp/enroll/verify', {
      ...jsonPost({ code, backupCodesAcknowledged: true }),
      headers: { 'content-type': 'application/json', cookie },
    });

    const oldCodes = await db
      .select({ id: mfaTotpRecoveryCodes.id })
      .from(mfaTotpRecoveryCodes)
      .where(eq(mfaTotpRecoveryCodes.userId, u.id));

    const proof2 = await passwordProofFor(
      app,
      'totp-regen-ok@example.com',
      TEST_PASSWORD,
    );
    const regenRes = await app.request('/auth/totp/backup-codes/regenerate', {
      ...jsonPost(proof2),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(regenRes.status).toBe(200);
    const body = (await regenRes.json()) as { backupCodes: string[] };
    expect(body.backupCodes).toHaveLength(10);

    const newCodes = await db
      .select({ id: mfaTotpRecoveryCodes.id })
      .from(mfaTotpRecoveryCodes)
      .where(eq(mfaTotpRecoveryCodes.userId, u.id));
    expect(newCodes).toHaveLength(10);
    // None of the new ids should appear in the old set.
    const oldIds = new Set(oldCodes.map((r) => r.id));
    for (const r of newCodes) {
      expect(oldIds.has(r.id)).toBe(false);
    }
  });
});
