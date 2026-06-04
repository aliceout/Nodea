/**
 * Integration tests for the passkey routes (Auth-Roadmap Phase 4,
 * Auth-Spec §7.3 + §9).
 *
 * Routes under test:
 *   - GET    /auth/me                          (passkey counts)
 *   - POST   /auth/passkeys/enroll/start        (auth, password proof)
 *   - GET    /auth/passkeys/list                (auth)
 *   - PATCH  /auth/passkeys/:id/label           (auth, password proof)
 *   - POST   /auth/passkeys/:id/remove          (auth, password proof,
 *                                               §6.1 downgrade auto)
 *   - POST   /auth/passkeys/login/start         (anon, anti-enum)
 *
 * What we DON'T cover here:
 *   - `enroll/finish` and `login/finish` exercise full WebAuthn
 *     signature verification, which needs a virtual authenticator
 *     fixture. That belongs in a follow-up `auth-passkey-webauthn.test.ts`
 *     once we wire `@simplewebauthn/server` test helpers — see
 *     Phase 4 follow-up issue (none yet). The routes are still
 *     covered by their negative paths (proof gating, malformed body)
 *     here.
 */
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { buildApp } from '../app.ts';
import { db } from '../db/client.ts';
import { authFactors, mfaTotp, sessions, users } from '../db/schema.ts';
import { __getRecordingEmailService } from '../services/email/index.ts';
import { loginAs, seedUser, TEST_PASSWORD } from './setup.ts';

const app = buildApp();

function jsonPost(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function jsonPatch(body: unknown): RequestInit {
  return {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

/**
 * Insert a fake passkey row directly. Bypasses the WebAuthn
 * verification path — useful for testing list/rename/remove without
 * a virtual authenticator. The `credentialId` is unique per call so
 * multiple seeds in the same test don't collide.
 */
async function seedPasskey(
  userId: string,
  opts: { prfSupported?: boolean; label?: string } = {},
): Promise<{ id: string; credentialId: string }> {
  const id = randomUUID();
  const credentialId = randomUUID().replace(/-/g, '');
  await db.insert(authFactors).values({
    id,
    userId,
    kind: 'passkey',
    credentialId,
    publicKey: 'fake-pk-' + credentialId,
    signCount: 0,
    signCountStrict: true,
    transports: 'internal',
    prfSupported: opts.prfSupported ?? true,
    wrappedKek: opts.prfSupported === false ? null : 'fake-wrap',
    wrappedKekIv: opts.prfSupported === false ? null : 'fake-iv',
    label: opts.label ?? null,
  });
  return { id, credentialId };
}

/* ============================================================================
 * GET /auth/me — passkey counts
 * ========================================================================== */

describe('GET /auth/me — passkey counts', () => {
  it('returns 0 / 0 when the user has no passkeys', async () => {
    await seedUser('me-no-passkey@example.com');
    const cookie = await loginAs(app, 'me-no-passkey@example.com', TEST_PASSWORD);
    const res = await app.request('/auth/me', { headers: { cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { passkeysCount: number; passkeysPrfCount: number };
    expect(body.passkeysCount).toBe(0);
    expect(body.passkeysPrfCount).toBe(0);
  });

  it('reflects total + PRF-capable counts when passkeys exist', async () => {
    const u = await seedUser('me-passkeys@example.com');
    await seedPasskey(u.id, { prfSupported: true });
    await seedPasskey(u.id, { prfSupported: true });
    await seedPasskey(u.id, { prfSupported: false });
    const cookie = await loginAs(app, 'me-passkeys@example.com', TEST_PASSWORD);

    const res = await app.request('/auth/me', { headers: { cookie } });
    const body = (await res.json()) as { passkeysCount: number; passkeysPrfCount: number };
    expect(body.passkeysCount).toBe(3);
    expect(body.passkeysPrfCount).toBe(2);
  });
});

/* ============================================================================
 * POST /auth/passkeys/enroll/start
 * ========================================================================== */

describe('POST /auth/passkeys/enroll/start', () => {
  it('401 unauthenticated without a cookie', async () => {
    const res = await app.request('/auth/passkeys/enroll/start', jsonPost({}));
    expect(res.status).toBe(401);
  });

  it('401 reauth_required when reauth_password_at is stale (>5 min)', async () => {
    await seedUser('enroll-stale@example.com');
    const cookie = await loginAs(
      app,
      'enroll-stale@example.com',
      TEST_PASSWORD,
    );
    // Backdate the freshness stamp so the middleware refuses.
    const sessionId = cookie.replace(/^nodea_session=/, '').split('.')[0]!;
    await db
      .update(sessions)
      .set({ reauthPasswordAt: new Date(Date.now() - 6 * 60_000) })
      .where(eq(sessions.id, sessionId));
    const res = await app.request('/auth/passkeys/enroll/start', {
      ...jsonPost({}),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string; reauth_required?: string };
    expect(body.error).toBe('reauth_required');
    expect(body.reauth_required).toBe('password');
  });

  it('200 with creationOptions + persists challenge on session', async () => {
    await seedUser('enroll-ok@example.com');
    const cookie = await loginAs(app, 'enroll-ok@example.com', TEST_PASSWORD);
    // Login already stamped reauth_password_at, so the
    // requireFreshPassword middleware passes naturally.

    const res = await app.request('/auth/passkeys/enroll/start', {
      ...jsonPost({}),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { creationOptions: Record<string, unknown> };
    expect(typeof body.creationOptions.challenge).toBe('string');
    expect(body.creationOptions.rp).toBeDefined();
    // userVerification: 'required' is enforced (Auth-Spec §9.3).
    const sel = body.creationOptions.authenticatorSelection as Record<string, string>;
    expect(sel.userVerification).toBe('required');
  });
});

/* ============================================================================
 * GET /auth/passkeys/list
 * ========================================================================== */

describe('GET /auth/passkeys/list', () => {
  it('401 unauthenticated', async () => {
    const res = await app.request('/auth/passkeys/list');
    expect(res.status).toBe(401);
  });

  it('returns the caller\'s passkeys with prfCount', async () => {
    const u = await seedUser('list-passkeys@example.com');
    await seedPasskey(u.id, { prfSupported: true, label: 'iPhone' });
    await seedPasskey(u.id, { prfSupported: false, label: 'Yubikey' });
    const cookie = await loginAs(app, 'list-passkeys@example.com', TEST_PASSWORD);

    const res = await app.request('/auth/passkeys/list', {
      headers: { cookie },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { label: string | null; prfSupported: boolean }[];
      meta: { prfCount: number };
    };
    expect(body.data).toHaveLength(2);
    expect(body.meta.prfCount).toBe(1);
    expect(body.data.map((p) => p.label).sort()).toEqual([
      'Yubikey',
      'iPhone',
    ]);
  });

  it('does not leak another user\'s passkeys', async () => {
    const a = await seedUser('list-a@example.com');
    const b = await seedUser('list-b@example.com');
    await seedPasskey(a.id, { label: 'A1' });
    await seedPasskey(b.id, { label: 'B1' });
    const cookieA = await loginAs(app, 'list-a@example.com', TEST_PASSWORD);

    const res = await app.request('/auth/passkeys/list', {
      headers: { cookie: cookieA },
    });
    const body = (await res.json()) as {
      data: { label: string | null }[];
      meta: { prfCount: number };
    };
    expect(body.data.map((p) => p.label)).toEqual(['A1']);
  });
});

/* ============================================================================
 * PATCH /auth/passkeys/:id/label
 * ========================================================================== */

describe('PATCH /auth/passkeys/:id/label', () => {
  it('renames the passkey on a fresh-password session', async () => {
    const u = await seedUser('rename-ok@example.com');
    const pk = await seedPasskey(u.id, { label: 'old' });
    const cookie = await loginAs(app, 'rename-ok@example.com', TEST_PASSWORD);

    const res = await app.request(`/auth/passkeys/${pk.id}/label`, {
      ...jsonPatch({ label: 'new' }),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status).toBe(200);

    const [row] = await db
      .select({ label: authFactors.label })
      .from(authFactors)
      .where(eq(authFactors.id, pk.id));
    expect(row?.label).toBe('new');
  });

  it('404s for another user\'s passkey', async () => {
    await seedUser('rename-a@example.com');
    const b = await seedUser('rename-b@example.com');
    const pkB = await seedPasskey(b.id);
    const cookieA = await loginAs(app, 'rename-a@example.com', TEST_PASSWORD);

    const res = await app.request(`/auth/passkeys/${pkB.id}/label`, {
      ...jsonPatch({ label: 'hijack' }),
      headers: { 'content-type': 'application/json', cookie: cookieA },
    });
    expect(res.status).toBe(404);
  });
});

/* ============================================================================
 * POST /auth/passkeys/:id/remove + §6.1 downgrade auto
 * ========================================================================== */

describe('POST /auth/passkeys/:id/remove', () => {
  it('removes the passkey on a fresh-password session', async () => {
    const u = await seedUser('remove-ok@example.com');
    const pk = await seedPasskey(u.id);
    const cookie = await loginAs(app, 'remove-ok@example.com', TEST_PASSWORD);

    const res = await app.request(`/auth/passkeys/${pk.id}/remove`, {
      ...jsonPost({}),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status).toBe(200);

    const rows = await db
      .select()
      .from(authFactors)
      .where(eq(authFactors.id, pk.id));
    expect(rows).toHaveLength(0);
  });

  it('§6.1 downgrade auto: removing the last PRF passkey under maximum drops mode to password_or_passkey', async () => {
    const u = await seedUser('downgrade@example.com');
    // Set up a user in mode max with a single PRF passkey.
    const pk = await seedPasskey(u.id, { prfSupported: true });
    await db
      .update(users)
      .set({ securityMode: 'maximum' })
      .where(eq(users.id, u.id));

    const cookie = await loginAs(app, 'downgrade@example.com', TEST_PASSWORD);

    const res = await app.request(`/auth/passkeys/${pk.id}/remove`, {
      ...jsonPost({}),
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
        m.to === 'downgrade@example.com',
    );
    expect(notif).toBeDefined();
    expect(notif!.subject).toMatch(/Standard/i);
  });

  it('§6.1 issue #72: removing the last passkey under always_2fa drops mode when no TOTP is enrolled', async () => {
    // Login first under the default `password_or_passkey` mode so we
    // get a full session, then promote setup to `always_2fa` with
    // passkey-only (mimicking the existing TOTP downgrade test).
    const u = await seedUser('passkey-only-2fa@example.com');
    const cookie = await loginAs(
      app,
      'passkey-only-2fa@example.com',
      TEST_PASSWORD,
    );
    const pk = await seedPasskey(u.id, { prfSupported: false });
    await db
      .update(users)
      .set({ securityMode: 'always_2fa' })
      .where(eq(users.id, u.id));

    const sentBefore = __getRecordingEmailService().sent.length;
    const res = await app.request(`/auth/passkeys/${pk.id}/remove`, {
      ...jsonPost({}),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status).toBe(200);

    const [row] = await db
      .select({ mode: users.securityMode })
      .from(users)
      .where(eq(users.id, u.id));
    expect(row?.mode).toBe('password_or_passkey');

    // Best-effort downgrade notification fired with the new
    // `last_passkey_removed` trigger.
    const notif = __getRecordingEmailService()
      .sent.slice(sentBefore)
      .find(
        (m) =>
          m.tag === 'security-mode-downgraded' &&
          m.to === 'passkey-only-2fa@example.com',
      );
    expect(notif).toBeDefined();
  });

  it('§6.1 issue #72: removing the last passkey under always_2fa keeps the mode when TOTP is enabled', async () => {
    const u = await seedUser('passkey-and-totp-2fa@example.com');
    const cookie = await loginAs(
      app,
      'passkey-and-totp-2fa@example.com',
      TEST_PASSWORD,
    );
    const pk = await seedPasskey(u.id, { prfSupported: false });
    await db.insert(mfaTotp).values({
      userId: u.id,
      secret: 'JBSWY3DPEHPK3PXP',
      algo: 'SHA1',
      digits: 6,
      period: 30,
      enabledAt: new Date(),
      lastWindow: null,
    });
    await db
      .update(users)
      .set({ securityMode: 'always_2fa' })
      .where(eq(users.id, u.id));

    const res = await app.request(`/auth/passkeys/${pk.id}/remove`, {
      ...jsonPost({}),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status).toBe(200);

    const [row] = await db
      .select({ mode: users.securityMode })
      .from(users)
      .where(eq(users.id, u.id));
    expect(row?.mode).toBe('always_2fa');
  });

  it('removing a non-PRF passkey under maximum does NOT trigger downgrade', async () => {
    const u = await seedUser('downgrade-non-prf@example.com');
    const prfPk = await seedPasskey(u.id, { prfSupported: true });
    const nonPrfPk = await seedPasskey(u.id, { prfSupported: false });
    await db
      .update(users)
      .set({ securityMode: 'maximum' })
      .where(eq(users.id, u.id));

    const cookie = await loginAs(
      app,
      'downgrade-non-prf@example.com',
      TEST_PASSWORD,
    );

    // Removing the non-PRF passkey leaves the PRF one in place — mode
    // must stay at 'maximum'.
    const res = await app.request(`/auth/passkeys/${nonPrfPk.id}/remove`, {
      ...jsonPost({}),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status).toBe(200);

    const [row] = await db
      .select({ mode: users.securityMode })
      .from(users)
      .where(eq(users.id, u.id));
    expect(row?.mode).toBe('maximum');

    // Sanity check that the PRF passkey survives.
    const survivors = await db
      .select()
      .from(authFactors)
      .where(eq(authFactors.id, prfPk.id));
    expect(survivors).toHaveLength(1);
  });
});

/* ============================================================================
 * POST /auth/passkeys/login/start (anonymous, anti-enum)
 * ========================================================================== */

describe('POST /auth/passkeys/login/start', () => {
  it('returns generic options without `allowCredentials` for unknown email', async () => {
    const res = await app.request(
      '/auth/passkeys/login/start',
      jsonPost({ email: 'nobody-here@example.com' }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      requestOptions: { allowCredentials?: unknown[] };
      loginToken: string;
    };
    // Either undefined or empty array — both anti-enum-friendly. The
    // browser will fall back to discoverable credentials.
    expect(
      body.requestOptions.allowCredentials === undefined ||
        (Array.isArray(body.requestOptions.allowCredentials) &&
          body.requestOptions.allowCredentials.length === 0),
    ).toBe(true);
    expect(typeof body.loginToken).toBe('string');
  });

  it('returns scoped `allowCredentials` for a known email with passkeys', async () => {
    const u = await seedUser('login-start-known@example.com');
    const pk = await seedPasskey(u.id);

    const res = await app.request(
      '/auth/passkeys/login/start',
      jsonPost({ email: 'login-start-known@example.com' }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      requestOptions: { allowCredentials?: { id: string }[] };
    };
    expect(body.requestOptions.allowCredentials).toHaveLength(1);
    expect(body.requestOptions.allowCredentials?.[0]?.id).toBe(pk.credentialId);
  });

  it('400 invalid_body for malformed JSON', async () => {
    const res = await app.request(
      '/auth/passkeys/login/start',
      jsonPost({ email: 'not-an-email' }),
    );
    expect(res.status).toBe(400);
  });
});
