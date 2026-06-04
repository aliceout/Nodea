/**
 * Integration tests for security-mode/change (Auth-Roadmap Phase 5D,
 * Auth-Spec §6.1).
 *
 * Routes under test:
 *   - POST /auth/security-mode/change   (auth, password proof,
 *                                         §6.1 activation gates)
 *
 * Scenarios:
 *   - 401 without auth.
 *   - 401 with a forged password proof.
 *   - 400 totp_required when activating always_2fa / maximum
 *     without TOTP enrolled.
 *   - 400 passkey_required when activating maximum without a
 *     PRF-capable passkey enrolled.
 *   - 200 + DB update on each mode when prerequisites are met.
 *   - Downgrade flow (back to password_or_passkey is always allowed).
 */
import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../app.ts';
import { db } from '../db/client.ts';
import { authFactors, mfaTotp, sessions, users } from '../db/schema.ts';
import {
  TEST_PASSWORD,
  extractCookie,
  loginAs,
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
 * Bootstrap helper: enroll TOTP for a user (using direct DB writes
 * for speed since the test isn't exercising the enrollment route
 * itself). Returns nothing — the row is just there so the mode
 * gate is satisfied.
 */
async function enableTotpDirect(userId: string): Promise<void> {
  await db.insert(mfaTotp).values({
    userId,
    secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
    algo: 'SHA1',
    digits: 6,
    period: 30,
    enabledAt: new Date(),
    lastWindow: null,
  });
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

/* ============================================================================
 * Auth + proof gating
 * ========================================================================== */

describe('POST /auth/security-mode/change — auth + proof', () => {
  it('401 unauthenticated', async () => {
    const res = await app.request(
      '/auth/security-mode/change',
      jsonPost({
        mode: 'always_2fa',
        proofLoginToken: 'x',
        proofFinishLoginRequest: 'y',
      }),
    );
    expect(res.status).toBe(401);
  });

  it('401 reauth_required when the session is stale (Phase 7B)', async () => {
    const u = await seedUser('mode-stale@example.com');
    await enableTotpDirect(u.id);
    const cookie = await loginAs(app, 'mode-stale@example.com', TEST_PASSWORD);
    const sessionId = cookie.replace(/^nodea_session=/, '').split('.')[0]!;
    await db
      .update(sessions)
      .set({ reauthPasswordAt: new Date(Date.now() - 6 * 60_000) })
      .where(eq(sessions.id, sessionId));

    const res = await app.request('/auth/security-mode/change', {
      ...jsonPost({ mode: 'always_2fa' }),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({
      error: 'reauth_required',
      reauth_required: 'password',
    });
  });

  it('400 invalid_body for an unknown mode value', async () => {
    await seedUser('mode-bad-body@example.com');
    const cookie = await loginAs(app, 'mode-bad-body@example.com', TEST_PASSWORD);
    const proof = await passwordProofFor(
      app,
      'mode-bad-body@example.com',
      TEST_PASSWORD,
    );

    const res = await app.request('/auth/security-mode/change', {
      ...jsonPost({ mode: 'paranoid', ...proof }),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status).toBe(400);
  });
});

/* ============================================================================
 * Activation gates
 * ========================================================================== */

describe('POST /auth/security-mode/change — activation gates §6.1', () => {
  it('400 second_factor_required for always_2fa with neither TOTP nor passkey (issue #72)', async () => {
    await seedUser('mode-totp-missing@example.com');
    const cookie = await loginAs(
      app,
      'mode-totp-missing@example.com',
      TEST_PASSWORD,
    );
    const proof = await passwordProofFor(
      app,
      'mode-totp-missing@example.com',
      TEST_PASSWORD,
    );

    const res = await app.request('/auth/security-mode/change', {
      ...jsonPost({ mode: 'always_2fa', ...proof }),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('second_factor_required');
  });

  it('always_2fa accepts activation with a passkey alone (no TOTP) — issue #72', async () => {
    const u = await seedUser('mode-passkey-only@example.com');
    await enrollPrfPasskeyDirect(u.id);
    const cookie = await loginAs(
      app,
      'mode-passkey-only@example.com',
      TEST_PASSWORD,
    );
    const proof = await passwordProofFor(
      app,
      'mode-passkey-only@example.com',
      TEST_PASSWORD,
    );

    const res = await app.request('/auth/security-mode/change', {
      ...jsonPost({ mode: 'always_2fa', ...proof }),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status).toBe(200);
  });

  it('400 totp_required for maximum without TOTP enrolled', async () => {
    const u = await seedUser('mode-max-totp-missing@example.com');
    await enrollPrfPasskeyDirect(u.id); // Has a passkey but no TOTP.
    const cookie = await loginAs(
      app,
      'mode-max-totp-missing@example.com',
      TEST_PASSWORD,
    );
    const proof = await passwordProofFor(
      app,
      'mode-max-totp-missing@example.com',
      TEST_PASSWORD,
    );

    const res = await app.request('/auth/security-mode/change', {
      ...jsonPost({ mode: 'maximum', ...proof }),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('totp_required');
  });

  it('400 passkey_required for maximum without a PRF passkey', async () => {
    const u = await seedUser('mode-max-passkey-missing@example.com');
    await enableTotpDirect(u.id); // Has TOTP but no passkey.
    const cookie = await loginAs(
      app,
      'mode-max-passkey-missing@example.com',
      TEST_PASSWORD,
    );
    const proof = await passwordProofFor(
      app,
      'mode-max-passkey-missing@example.com',
      TEST_PASSWORD,
    );

    const res = await app.request('/auth/security-mode/change', {
      ...jsonPost({ mode: 'maximum', ...proof }),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('passkey_required');
  });
});

/* ============================================================================
 * Happy paths
 * ========================================================================== */

describe('POST /auth/security-mode/change — happy paths', () => {
  it('moves password_or_passkey → always_2fa when TOTP is enrolled', async () => {
    const u = await seedUser('mode-up-always-totp@example.com');
    await enableTotpDirect(u.id);
    const cookie = await loginAs(
      app,
      'mode-up-always-totp@example.com',
      TEST_PASSWORD,
    );
    const proof = await passwordProofFor(
      app,
      'mode-up-always-totp@example.com',
      TEST_PASSWORD,
    );

    const res = await app.request('/auth/security-mode/change', {
      ...jsonPost({ mode: 'always_2fa', ...proof }),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status).toBe(200);

    const [row] = await db
      .select({ mode: users.securityMode })
      .from(users)
      .where(eq(users.id, u.id));
    expect(row?.mode).toBe('always_2fa');
  });

  it('moves any mode → maximum when both TOTP + PRF passkey are enrolled', async () => {
    const u = await seedUser('mode-up-maximum@example.com');
    await enableTotpDirect(u.id);
    await enrollPrfPasskeyDirect(u.id);
    const cookie = await loginAs(
      app,
      'mode-up-maximum@example.com',
      TEST_PASSWORD,
    );
    const proof = await passwordProofFor(
      app,
      'mode-up-maximum@example.com',
      TEST_PASSWORD,
    );

    const res = await app.request('/auth/security-mode/change', {
      ...jsonPost({ mode: 'maximum', ...proof }),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status).toBe(200);

    const [row] = await db
      .select({ mode: users.securityMode })
      .from(users)
      .where(eq(users.id, u.id));
    expect(row?.mode).toBe('maximum');
  });

  it('rotates sessions on mode change (Auth-Spec §5.4)', async () => {
    const u = await seedUser('mode-rotate-sessions@example.com');
    await enableTotpDirect(u.id);

    // Two parallel sessions for the same user: cookieA does the
    // mutation, cookieB simulates a second tab / device that should
    // be forced back through login after the privilege change.
    const cookieA = await loginAs(
      app,
      'mode-rotate-sessions@example.com',
      TEST_PASSWORD,
    );
    const cookieB = await loginAs(
      app,
      'mode-rotate-sessions@example.com',
      TEST_PASSWORD,
    );
    expect(cookieA).not.toBe(cookieB);

    const proof = await passwordProofFor(
      app,
      'mode-rotate-sessions@example.com',
      TEST_PASSWORD,
    );

    const res = await app.request('/auth/security-mode/change', {
      ...jsonPost({ mode: 'always_2fa', ...proof }),
      headers: { 'content-type': 'application/json', cookie: cookieA },
    });
    expect(res.status).toBe(200);

    // The response must mint a fresh session cookie — the caller is
    // expected to keep the new one, not the pre-rotation cookieA.
    const rotatedCookie = extractCookie(res);
    expect(rotatedCookie).toBeTruthy();
    expect(rotatedCookie).not.toBe(cookieA);

    // cookieB (the parallel tab) must now be invalid.
    const meB = await app.request('/auth/me', { headers: { cookie: cookieB } });
    expect(meB.status).toBe(401);

    // The pre-rotation cookieA itself must also be revoked.
    const meA = await app.request('/auth/me', { headers: { cookie: cookieA } });
    expect(meA.status).toBe(401);

    // The freshly-minted cookie carries the user through.
    const meRotated = await app.request('/auth/me', {
      headers: { cookie: rotatedCookie! },
    });
    expect(meRotated.status).toBe(200);

    // DB sanity: the only live session left is the rotated one.
    const live = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.userId, u.id));
    const rotatedId = rotatedCookie!.replace(/^nodea_session=/, '').split('.')[0]!;
    expect(live.map((r) => r.id)).toEqual([rotatedId]);
  });

  it('downgrade to password_or_passkey is always allowed (no prerequisite)', async () => {
    const u = await seedUser('mode-down@example.com');
    // Force the user into max ahead of time without enrolling any
    // factors — should still be downgradable.
    await db
      .update(users)
      .set({ securityMode: 'maximum' })
      .where(eq(users.id, u.id));

    const cookie = await loginAs(app, 'mode-down@example.com', TEST_PASSWORD);
    const proof = await passwordProofFor(
      app,
      'mode-down@example.com',
      TEST_PASSWORD,
    );

    const res = await app.request('/auth/security-mode/change', {
      ...jsonPost({ mode: 'password_or_passkey', ...proof }),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status).toBe(200);

    const [row] = await db
      .select({ mode: users.securityMode })
      .from(users)
      .where(eq(users.id, u.id));
    expect(row?.mode).toBe('password_or_passkey');
  });
});
