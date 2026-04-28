/**
 * Integration tests for the recovery-code KEK routes
 * (Auth-Roadmap Phase 3, Auth-Spec §7.7).
 *
 * Routes under test:
 *   - POST /auth/security/recovery-code        (authenticated setup/regenerate)
 *   - POST /auth/recover-kek/start             (anonymous, anti-enum)
 *   - POST /auth/recover-kek/finish            (anonymous, hash-gated)
 *
 * The OPAQUE register handshake for the new password runs in-process
 * via `@serenity-kit/opaque`. We don't actually go through BIP39 —
 * the server only sees `SHA-256(entropy)` and the wrap blobs, so
 * tests can use 16 random bytes directly without round-tripping
 * through the wordlist.
 */
import { describe, it, expect } from 'vitest';
import { createHash, randomBytes, webcrypto } from 'node:crypto';
import { client, ready } from '@serenity-kit/opaque';
import { eq } from 'drizzle-orm';
import { buildApp } from '../app.ts';
import { db } from '../db/client.ts';
import { sessions, users } from '../db/schema.ts';
import {
  TEST_PASSWORD,
  loginAs,
  passwordProofFor,
  seedUser,
} from './helpers.ts';

const app = buildApp();

const NEW_PASSWORD = 'Brand-New-Recovery-Pass-99';

function jsonPost(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Synthetic recovery setup payload — generates fresh entropy, fakes
 * a wrap blob (just random base64 strings of the right size; the
 * server stores opaque text and never decrypts here). Returns the
 * entropy + the body the route expects.
 */
function fakeRecoverySetupPayload(
  proof: { proofLoginToken: string; proofFinishLoginRequest: string },
): {
  entropy: Uint8Array;
  body: Record<string, string>;
} {
  const entropy = new Uint8Array(16);
  webcrypto.getRandomValues(entropy);
  return {
    entropy,
    body: {
      wrappedKekRecovery: bytesToBase64(new Uint8Array(randomBytes(48))),
      wrappedKekRecoveryIv: bytesToBase64(new Uint8Array(randomBytes(12))),
      recoveryCodeHash: sha256Hex(entropy),
      proofLoginToken: proof.proofLoginToken,
      proofFinishLoginRequest: proof.proofFinishLoginRequest,
    },
  };
}

/* ============================================================================
 * POST /auth/security/recovery-code
 * ========================================================================== */

describe('POST /auth/security/recovery-code', () => {
  it('first-time setup persists hash + wrap blobs and bumps recoveryAcknowledgedAt', async () => {
    const u = await seedUser('rec-setup@example.com');
    const cookie = await loginAs(app, 'rec-setup@example.com', TEST_PASSWORD);
    const proof = await passwordProofFor(app, 'rec-setup@example.com', TEST_PASSWORD);
    const { entropy, body } = fakeRecoverySetupPayload(proof);

    const res = await app.request('/auth/security/recovery-code', {
      ...jsonPost(body),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, regenerated: false });

    const [row] = await db.select().from(users).where(eq(users.id, u.id));
    expect(row!.recoveryCodeHash).toBe(sha256Hex(entropy));
    expect(row!.wrappedKekRecovery).toBe(body.wrappedKekRecovery);
    expect(row!.wrappedKekRecoveryIv).toBe(body.wrappedKekRecoveryIv);
    expect(row!.recoveryAcknowledgedAt).not.toBeNull();
  });

  it('regenerate replaces the previous wrap + reports regenerated:true', async () => {
    const u = await seedUser('rec-regen@example.com');
    const cookie = await loginAs(app, 'rec-regen@example.com', TEST_PASSWORD);

    // First setup.
    const proof1 = await passwordProofFor(app, 'rec-regen@example.com', TEST_PASSWORD);
    const first = fakeRecoverySetupPayload(proof1);
    await app.request('/auth/security/recovery-code', {
      ...jsonPost(first.body),
      headers: { 'content-type': 'application/json', cookie },
    });

    // Regenerate (fresh proof needed — proof tokens are single-use).
    const proof2 = await passwordProofFor(app, 'rec-regen@example.com', TEST_PASSWORD);
    const second = fakeRecoverySetupPayload(proof2);
    const res = await app.request('/auth/security/recovery-code', {
      ...jsonPost(second.body),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, regenerated: true });

    const [row] = await db.select().from(users).where(eq(users.id, u.id));
    expect(row!.recoveryCodeHash).toBe(sha256Hex(second.entropy));
    expect(row!.recoveryCodeHash).not.toBe(sha256Hex(first.entropy));
    expect(row!.wrappedKekRecovery).toBe(second.body.wrappedKekRecovery);
  });

  it('rejects 401 reauth_required when the session is stale (Phase 7B)', async () => {
    await seedUser('rec-stale@example.com');
    const cookie = await loginAs(app, 'rec-stale@example.com', TEST_PASSWORD);
    const sessionId = cookie.replace(/^nodea_session=/, '').split('.')[0]!;
    await db
      .update(sessions)
      .set({ reauthPasswordAt: new Date(Date.now() - 6 * 60_000) })
      .where(eq(sessions.id, sessionId));

    const entropy = new Uint8Array(16);
    webcrypto.getRandomValues(entropy);
    const res = await app.request('/auth/security/recovery-code', {
      ...jsonPost({
        wrappedKekRecovery: bytesToBase64(new Uint8Array(randomBytes(48))),
        wrappedKekRecoveryIv: bytesToBase64(new Uint8Array(randomBytes(12))),
        recoveryCodeHash: sha256Hex(entropy),
      }),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({
      error: 'reauth_required',
      reauth_required: 'password',
    });
  });

  it('rejects 401 without a session cookie', async () => {
    const entropy = new Uint8Array(16);
    webcrypto.getRandomValues(entropy);
    const res = await app.request(
      '/auth/security/recovery-code',
      jsonPost({
        wrappedKekRecovery: bytesToBase64(new Uint8Array(randomBytes(48))),
        wrappedKekRecoveryIv: bytesToBase64(new Uint8Array(randomBytes(12))),
        recoveryCodeHash: sha256Hex(entropy),
        proofLoginToken: 'whatever',
        proofFinishLoginRequest: 'whatever',
      }),
    );
    expect(res.status).toBe(401);
  });

  it('rejects 400 invalid_body on a malformed hash', async () => {
    await seedUser('rec-malformed@example.com');
    const cookie = await loginAs(app, 'rec-malformed@example.com', TEST_PASSWORD);
    const proof = await passwordProofFor(app, 'rec-malformed@example.com', TEST_PASSWORD);

    const res = await app.request('/auth/security/recovery-code', {
      ...jsonPost({
        wrappedKekRecovery: 'x',
        wrappedKekRecoveryIv: 'x',
        recoveryCodeHash: 'not-hex',
        proofLoginToken: proof.proofLoginToken,
        proofFinishLoginRequest: proof.proofFinishLoginRequest,
      }),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_body' });
  });
});

/* ============================================================================
 * POST /auth/recover-kek/start  +  /finish
 * ========================================================================== */

interface RecoverStartResult {
  status: number;
  recoverSessionId?: string;
  wrappedKekRecovery?: string;
  wrappedKekRecoveryIv?: string;
  userId?: string;
  registrationResponse?: string;
  clientRegistrationState?: string;
}

async function callRecoverStart(
  email: string,
  newPassword: string,
): Promise<RecoverStartResult> {
  await ready;
  const { clientRegistrationState, registrationRequest } = client.startRegistration({
    password: newPassword,
  });
  const res = await app.request(
    '/auth/recover-kek/start',
    jsonPost({ email, registrationRequest }),
  );
  if (res.status !== 200) return { status: res.status };
  const body = (await res.json()) as {
    recoverSessionId: string;
    wrappedKekRecovery: string;
    wrappedKekRecoveryIv: string;
    userId: string;
    registrationResponse: string;
  };
  return {
    status: 200,
    ...body,
    clientRegistrationState,
  };
}

describe('POST /auth/recover-kek/start (anti-enum)', () => {
  it('returns wrap blobs + a registrationResponse for a known user with a recovery code', async () => {
    const u = await seedUser('rec-known@example.com');
    const cookie = await loginAs(app, 'rec-known@example.com', TEST_PASSWORD);
    const proof = await passwordProofFor(app, 'rec-known@example.com', TEST_PASSWORD);
    const { body } = fakeRecoverySetupPayload(proof);
    await app.request('/auth/security/recovery-code', {
      ...jsonPost(body),
      headers: { 'content-type': 'application/json', cookie },
    });

    const start = await callRecoverStart('rec-known@example.com', NEW_PASSWORD);
    expect(start.status).toBe(200);
    expect(start.wrappedKekRecovery).toBe(body.wrappedKekRecovery);
    expect(start.wrappedKekRecoveryIv).toBe(body.wrappedKekRecoveryIv);
    expect(start.userId).toBe(u.id);
    expect(start.registrationResponse).toBeTypeOf('string');
    expect(start.recoverSessionId).toBeTypeOf('string');
  });

  it('returns syntactically valid blobs for an unknown email (anti-enum)', async () => {
    // No seedUser → email is unknown. Server must still respond
    // with the same shape so an attacker can't enumerate.
    const start = await callRecoverStart('ghost@example.com', NEW_PASSWORD);
    expect(start.status).toBe(200);
    expect(start.wrappedKekRecovery).toBeTypeOf('string');
    expect(start.wrappedKekRecoveryIv).toBeTypeOf('string');
    expect(start.userId).toMatch(/^[0-9a-f-]{36}$/);
    expect(start.registrationResponse).toBeTypeOf('string');
    expect(start.recoverSessionId).toBeTypeOf('string');
  });

  it('returns the same shape for a known user without a recovery code (anti-enum)', async () => {
    // Seeded user but no recovery code set up — should be
    // indistinguishable from the unknown-email branch.
    await seedUser('rec-no-code@example.com');
    const start = await callRecoverStart('rec-no-code@example.com', NEW_PASSWORD);
    expect(start.status).toBe(200);
    expect(start.wrappedKekRecovery).toBeTypeOf('string');
    expect(start.recoverSessionId).toBeTypeOf('string');
  });
});

describe('POST /auth/recover-kek/finish', () => {
  it('rejects 401 when the recoverSessionId came from the anti-enum branch (unknown email)', async () => {
    const start = await callRecoverStart('ghost@example.com', NEW_PASSWORD);
    expect(start.status).toBe(200);

    // The session is bound to userId=null (anti-enum). /finish
    // must refuse with a generic 401 before validating the hash.
    const entropy = new Uint8Array(16);
    webcrypto.getRandomValues(entropy);

    const finished = client.finishRegistration({
      password: NEW_PASSWORD,
      clientRegistrationState: start.clientRegistrationState!,
      registrationResponse: start.registrationResponse!,
    });

    const res = await app.request(
      '/auth/recover-kek/finish',
      jsonPost({
        recoverSessionId: start.recoverSessionId,
        recoveryCodeHash: sha256Hex(entropy),
        registrationRecord: finished.registrationRecord,
        wrappedKekPassword: 'x',
        wrappedKekPasswordIv: 'x',
        wrappedKekRecoveryNew: 'x',
        wrappedKekRecoveryNewIv: 'x',
        recoveryCodeHashNew: sha256Hex(entropy),
      }),
    );
    expect(res.status).toBe(401);
  });

  it('rejects 401 when the recoveryCodeHash mismatches (constant-time)', async () => {
    await seedUser('rec-mismatch@example.com');
    const cookie = await loginAs(app, 'rec-mismatch@example.com', TEST_PASSWORD);
    const proof = await passwordProofFor(app, 'rec-mismatch@example.com', TEST_PASSWORD);
    const setup = fakeRecoverySetupPayload(proof);
    await app.request('/auth/security/recovery-code', {
      ...jsonPost(setup.body),
      headers: { 'content-type': 'application/json', cookie },
    });

    const start = await callRecoverStart('rec-mismatch@example.com', NEW_PASSWORD);
    expect(start.status).toBe(200);
    const finished = client.finishRegistration({
      password: NEW_PASSWORD,
      clientRegistrationState: start.clientRegistrationState!,
      registrationResponse: start.registrationResponse!,
    });

    const wrongEntropy = new Uint8Array(16);
    webcrypto.getRandomValues(wrongEntropy);
    const res = await app.request(
      '/auth/recover-kek/finish',
      jsonPost({
        recoverSessionId: start.recoverSessionId,
        recoveryCodeHash: sha256Hex(wrongEntropy),
        registrationRecord: finished.registrationRecord,
        wrappedKekPassword: 'wp',
        wrappedKekPasswordIv: 'wpiv',
        wrappedKekRecoveryNew: 'wkrn',
        wrappedKekRecoveryNewIv: 'wkrniv',
        recoveryCodeHashNew: sha256Hex(wrongEntropy),
      }),
    );
    expect(res.status).toBe(401);
  });

  it('happy path: replaces the envelope + wrap blobs + recovery hash + emits a session cookie', async () => {
    const u = await seedUser('rec-happy@example.com');
    const cookie = await loginAs(app, 'rec-happy@example.com', TEST_PASSWORD);
    const proof = await passwordProofFor(app, 'rec-happy@example.com', TEST_PASSWORD);
    const setup = fakeRecoverySetupPayload(proof);
    await app.request('/auth/security/recovery-code', {
      ...jsonPost(setup.body),
      headers: { 'content-type': 'application/json', cookie },
    });

    const start = await callRecoverStart('rec-happy@example.com', NEW_PASSWORD);
    expect(start.status).toBe(200);
    const finished = client.finishRegistration({
      password: NEW_PASSWORD,
      clientRegistrationState: start.clientRegistrationState!,
      registrationResponse: start.registrationResponse!,
    });

    const newEntropy = new Uint8Array(16);
    webcrypto.getRandomValues(newEntropy);
    const res = await app.request(
      '/auth/recover-kek/finish',
      jsonPost({
        recoverSessionId: start.recoverSessionId,
        recoveryCodeHash: sha256Hex(setup.entropy),
        registrationRecord: finished.registrationRecord,
        wrappedKekPassword: 'rotated-wp',
        wrappedKekPasswordIv: 'rotated-wpiv',
        wrappedKekRecoveryNew: 'rotated-wkr',
        wrappedKekRecoveryNewIv: 'rotated-wkriv',
        recoveryCodeHashNew: sha256Hex(newEntropy),
      }),
    );
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('nodea_session=');

    // DB rotated.
    const [row] = await db.select().from(users).where(eq(users.id, u.id));
    expect(row!.wrappedKekPassword).toBe('rotated-wp');
    expect(row!.wrappedKekRecovery).toBe('rotated-wkr');
    expect(row!.recoveryCodeHash).toBe(sha256Hex(newEntropy));

    // OLD password no longer works.
    await expect(
      loginAs(app, 'rec-happy@example.com', TEST_PASSWORD),
    ).rejects.toThrow();

    // NEW password binds.
    const newCookie = await loginAs(app, 'rec-happy@example.com', NEW_PASSWORD);
    expect(newCookie).toBeTruthy();
  });

  it('rejects 401 on a re-used recoverSessionId', async () => {
    await seedUser('rec-replay@example.com');
    const cookie = await loginAs(app, 'rec-replay@example.com', TEST_PASSWORD);
    const proof = await passwordProofFor(app, 'rec-replay@example.com', TEST_PASSWORD);
    const setup = fakeRecoverySetupPayload(proof);
    await app.request('/auth/security/recovery-code', {
      ...jsonPost(setup.body),
      headers: { 'content-type': 'application/json', cookie },
    });

    const start = await callRecoverStart('rec-replay@example.com', NEW_PASSWORD);
    expect(start.status).toBe(200);
    const finished = client.finishRegistration({
      password: NEW_PASSWORD,
      clientRegistrationState: start.clientRegistrationState!,
      registrationResponse: start.registrationResponse!,
    });

    const newEntropy = new Uint8Array(16);
    webcrypto.getRandomValues(newEntropy);
    const finishBody = {
      recoverSessionId: start.recoverSessionId,
      recoveryCodeHash: sha256Hex(setup.entropy),
      registrationRecord: finished.registrationRecord,
      wrappedKekPassword: 'wp',
      wrappedKekPasswordIv: 'wpiv',
      wrappedKekRecoveryNew: 'wkrn',
      wrappedKekRecoveryNewIv: 'wkrniv',
      recoveryCodeHashNew: sha256Hex(newEntropy),
    };

    // First call consumes the session.
    const first = await app.request('/auth/recover-kek/finish', jsonPost(finishBody));
    expect(first.status).toBe(200);

    // Replay → 401, single-use.
    const second = await app.request('/auth/recover-kek/finish', jsonPost(finishBody));
    expect(second.status).toBe(401);
  });
});
