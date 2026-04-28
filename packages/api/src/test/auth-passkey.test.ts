/**
 * Integration tests for the passkey routes (Auth-Roadmap Phase 4,
 * Auth-Spec §7.3 + §9).
 *
 * Routes under test:
 *   - GET    /auth/me                          (passkey counts)
 *   - POST   /auth/passkey/enroll/start        (auth, password proof)
 *   - GET    /auth/passkey/list                (auth)
 *   - PATCH  /auth/passkey/:id/label           (auth, password proof)
 *   - POST   /auth/passkey/:id/remove          (auth, password proof,
 *                                               §6.1 downgrade auto)
 *   - POST   /auth/passkey/login/start         (anon, anti-enum)
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
import { authFactors, sessions, users } from '../db/schema.ts';
import { loginAs, seedUser, TEST_PASSWORD } from './helpers.ts';

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
 * POST /auth/passkey/enroll/start
 * ========================================================================== */

describe('POST /auth/passkey/enroll/start', () => {
  it('401 unauthenticated without a cookie', async () => {
    const res = await app.request('/auth/passkey/enroll/start', jsonPost({}));
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
    const res = await app.request('/auth/passkey/enroll/start', {
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

    const res = await app.request('/auth/passkey/enroll/start', {
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
 * GET /auth/passkey/list
 * ========================================================================== */

describe('GET /auth/passkey/list', () => {
  it('401 unauthenticated', async () => {
    const res = await app.request('/auth/passkey/list');
    expect(res.status).toBe(401);
  });

  it('returns the caller\'s passkeys with prfCount', async () => {
    const u = await seedUser('list-passkeys@example.com');
    await seedPasskey(u.id, { prfSupported: true, label: 'iPhone' });
    await seedPasskey(u.id, { prfSupported: false, label: 'Yubikey' });
    const cookie = await loginAs(app, 'list-passkeys@example.com', TEST_PASSWORD);

    const res = await app.request('/auth/passkey/list', {
      headers: { cookie },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      passkeys: { label: string | null; prfSupported: boolean }[];
      prfCount: number;
    };
    expect(body.passkeys).toHaveLength(2);
    expect(body.prfCount).toBe(1);
    expect(body.passkeys.map((p) => p.label).sort()).toEqual([
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

    const res = await app.request('/auth/passkey/list', {
      headers: { cookie: cookieA },
    });
    const body = (await res.json()) as {
      passkeys: { label: string | null }[];
    };
    expect(body.passkeys.map((p) => p.label)).toEqual(['A1']);
  });
});

/* ============================================================================
 * PATCH /auth/passkey/:id/label
 * ========================================================================== */

describe('PATCH /auth/passkey/:id/label', () => {
  it('renames the passkey on a fresh-password session', async () => {
    const u = await seedUser('rename-ok@example.com');
    const pk = await seedPasskey(u.id, { label: 'old' });
    const cookie = await loginAs(app, 'rename-ok@example.com', TEST_PASSWORD);

    const res = await app.request(`/auth/passkey/${pk.id}/label`, {
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

    const res = await app.request(`/auth/passkey/${pkB.id}/label`, {
      ...jsonPatch({ label: 'hijack' }),
      headers: { 'content-type': 'application/json', cookie: cookieA },
    });
    expect(res.status).toBe(404);
  });
});

/* ============================================================================
 * POST /auth/passkey/:id/remove + §6.1 downgrade auto
 * ========================================================================== */

describe('POST /auth/passkey/:id/remove', () => {
  it('removes the passkey on a fresh-password session', async () => {
    const u = await seedUser('remove-ok@example.com');
    const pk = await seedPasskey(u.id);
    const cookie = await loginAs(app, 'remove-ok@example.com', TEST_PASSWORD);

    const res = await app.request(`/auth/passkey/${pk.id}/remove`, {
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

    const res = await app.request(`/auth/passkey/${pk.id}/remove`, {
      ...jsonPost({}),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status).toBe(200);

    const [row] = await db
      .select({ mode: users.securityMode })
      .from(users)
      .where(eq(users.id, u.id));
    expect(row?.mode).toBe('password_or_passkey');
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
    const res = await app.request(`/auth/passkey/${nonPrfPk.id}/remove`, {
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
 * POST /auth/passkey/login/start (anonymous, anti-enum)
 * ========================================================================== */

describe('POST /auth/passkey/login/start', () => {
  it('returns generic options without `allowCredentials` for unknown email', async () => {
    const res = await app.request(
      '/auth/passkey/login/start',
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
      '/auth/passkey/login/start',
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
      '/auth/passkey/login/start',
      jsonPost({ email: 'not-an-email' }),
    );
    expect(res.status).toBe(400);
  });
});
