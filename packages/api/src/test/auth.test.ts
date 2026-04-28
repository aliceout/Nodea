/**
 * Auth integration tests — covers everything around session lifecycle
 * (logout, /me, change-password, change-email, change-username,
 * onboarding, delete-self) plus the admin/invites endpoint that
 * historically lived here.
 *
 * The login flow itself (OPAQUE 2-step + activation gate + anti-enum)
 * has its own file `auth-login-v2.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { client, ready } from '@serenity-kit/opaque';
import { buildApp } from '../app.ts';
import { db } from '../db/client.ts';
import { invites, sessions, users } from '../db/schema.ts';
import {
  TEST_PASSWORD,
  ADMIN_PASSWORD,
  extractCookie,
  loginAs,
  passwordProofFor,
  seedAdmin,
  seedInvite,
  seedUser,
} from './helpers.ts';

const app = buildApp();

function json(body: unknown): RequestInit {
  return { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}

/**
 * Drive the /auth/change-password 2-step flow against the test app
 * with deterministic wrap blobs. Returns the /finish response so
 * the caller can assert on status + cookie. Used by the change-
 * password test below.
 */
async function performChangePassword(
  cookie: string,
  email: string,
  currentPassword: string,
  newPassword: string,
): Promise<Response> {
  await ready;
  const proof = await passwordProofFor(app, email, currentPassword);

  const { clientRegistrationState, registrationRequest } = client.startRegistration({
    password: newPassword,
  });
  const startRes = await app.request('/auth/change-password/start', {
    ...json({
      proofLoginToken: proof.proofLoginToken,
      proofFinishLoginRequest: proof.proofFinishLoginRequest,
      registrationRequest,
    }),
    headers: { 'content-type': 'application/json', cookie },
  });
  if (startRes.status !== 200) return startRes;
  const { registrationResponse, changePasswordToken } = (await startRes.json()) as {
    registrationResponse: string;
    changePasswordToken: string;
  };

  const { registrationRecord } = client.finishRegistration({
    password: newPassword,
    clientRegistrationState,
    registrationResponse,
  });

  return app.request('/auth/change-password/finish', {
    ...json({
      changePasswordToken,
      registrationRecord,
      wrappedKekPassword: 'rotated-wrapped-kek',
      wrappedKekPasswordIv: 'rotated-iv',
    }),
    headers: { 'content-type': 'application/json', cookie },
  });
}

describe('POST /auth/logout', () => {
  it('revokes the session and clears the cookie', async () => {
    await seedUser('logoutme@example.com');
    const cookie = await loginAs(app, 'logoutme@example.com', TEST_PASSWORD);

    const logout = await app.request('/auth/logout', {
      method: 'POST',
      headers: { cookie },
    });
    expect(logout.status).toBe(200);

    // /auth/me with the same cookie must now fail.
    const me = await app.request('/auth/me', { headers: { cookie } });
    expect(me.status).toBe(401);
  });
});

describe('GET /auth/me', () => {
  it('returns the current user with the OPAQUE credential blobs', async () => {
    await seedUser('me@example.com');
    const cookie = await loginAs(app, 'me@example.com', TEST_PASSWORD);

    const res = await app.request('/auth/me', { headers: { cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.email).toBe('me@example.com');
    // Phase 2D dropped the legacy password / envelope columns —
    // the response no longer carries them.
    expect(body).not.toHaveProperty('passwordHash');
    expect(body).not.toHaveProperty('encryptionSalt');
    expect(body).not.toHaveProperty('encryptedKey');
    expect(body).toHaveProperty('wrappedMainKey');
    expect(body).toHaveProperty('wrappedKekPassword');
  });

  it('returns 401 without a cookie', async () => {
    const res = await app.request('/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/change-password (OPAQUE 2-step)', () => {
  const newPassword = 'Brand-New-Horse-Battery-Staple-99';

  it('rotates the envelope, revokes the old session, mints a fresh one, and binds login to the new password', async () => {
    await seedUser('rotate@example.com');
    const oldCookie = await loginAs(app, 'rotate@example.com', TEST_PASSWORD);

    const change = await performChangePassword(
      oldCookie,
      'rotate@example.com',
      TEST_PASSWORD,
      newPassword,
    );
    expect(change.status).toBe(200);

    // Response must include a NEW session cookie.
    const newCookie = extractCookie(change)!;
    expect(newCookie).not.toBe(oldCookie);

    // Old cookie is dead.
    const meOld = await app.request('/auth/me', { headers: { cookie: oldCookie } });
    expect(meOld.status).toBe(401);

    // New cookie works.
    const meNew = await app.request('/auth/me', { headers: { cookie: newCookie } });
    expect(meNew.status).toBe(200);

    // OLD password no longer works (envelope replaced).
    await expect(
      loginAs(app, 'rotate@example.com', TEST_PASSWORD),
    ).rejects.toThrow();

    // NEW password binds.
    const cookieNewLogin = await loginAs(app, 'rotate@example.com', newPassword);
    expect(cookieNewLogin).toBeTruthy();
  });

  it('rejects when the session is not fresh (Phase 7B middleware)', async () => {
    const u = await seedUser('rotate2@example.com');
    const cookie = await loginAs(app, 'rotate2@example.com', TEST_PASSWORD);

    // Backdate both reauth timestamps past the 5-min window so
    // requireFreshPasswordOrPasskey refuses. Pre-7B this slot used
    // an embedded OPAQUE proof; the equivalent now is a stale
    // session timestamp — coverage of the OPAQUE proof path itself
    // lives in `auth-reauth.test.ts`.
    void u;
    const sessionId = cookie.replace(/^nodea_session=/, '').split('.')[0]!;
    const stale = new Date(Date.now() - 6 * 60_000);
    await db
      .update(sessions)
      .set({ reauthPasswordAt: stale, reauthPasskeyAt: stale })
      .where(eq(sessions.id, sessionId));

    const startRes = await app.request('/auth/change-password/start', {
      ...json({ registrationRequest: 'whatever' }),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(startRes.status).toBe(401);
    expect(await startRes.json()).toMatchObject({
      error: 'reauth_required',
      reauth_required: 'password_or_passkey',
    });
  });
});

describe('POST /admin/invites', () => {
  it('lets an admin send an invite by email and stores it pending', async () => {
    const admin = await seedAdmin();
    const cookie = await loginAs(app, admin.email, ADMIN_PASSWORD);

    const res = await app.request('/admin/invites', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ email: 'newcomer@example.com' }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; email: string };
    expect(body.email).toBe('newcomer@example.com');
    // Clear token never surfaces in the response — only via the email.
    expect(body).not.toHaveProperty('code');
    expect(body).not.toHaveProperty('token');
  });

  it('refuses inviting an already-existing user with 409', async () => {
    const admin = await seedAdmin();
    await seedUser('exists@example.com');
    const cookie = await loginAs(app, admin.email, ADMIN_PASSWORD);

    const res = await app.request('/admin/invites', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ email: 'exists@example.com' }),
    });
    expect(res.status).toBe(409);
  });

  it('refuses a non-admin user', async () => {
    await seedUser('peasant@example.com');
    const cookie = await loginAs(app, 'peasant@example.com', TEST_PASSWORD);

    const res = await app.request('/admin/invites', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ email: 'whatever@example.com' }),
    });
    expect(res.status).toBe(403);
  });

  it('refuses unauthenticated requests', async () => {
    const res = await app.request('/admin/invites', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'whatever@example.com' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('PATCH /auth/email', () => {
  const newEmail = 'renamed@example.com';

  it('updates the email when the OPAQUE proof checks out', async () => {
    await seedUser('rename@example.com');
    const cookie = await loginAs(app, 'rename@example.com', TEST_PASSWORD);
    const proof = await passwordProofFor(app, 'rename@example.com', TEST_PASSWORD);

    const res = await app.request('/auth/email', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ ...proof, newEmail }),
    });
    expect(res.status).toBe(200);

    const me = await app.request('/auth/me', { headers: { cookie } });
    const meBody = (await me.json()) as { email: string };
    expect(meBody.email).toBe(newEmail);
  });

  it('rejects when the session is not fresh (Phase 7B middleware)', async () => {
    await seedUser('rename2@example.com');
    const cookie = await loginAs(app, 'rename2@example.com', TEST_PASSWORD);

    // Backdate the password reauth stamp past the 5-min window —
    // requireFreshPassword refuses with reauth_required.
    const sessionId = cookie.replace(/^nodea_session=/, '').split('.')[0]!;
    await db
      .update(sessions)
      .set({ reauthPasswordAt: new Date(Date.now() - 6 * 60_000) })
      .where(eq(sessions.id, sessionId));

    const res = await app.request('/auth/email', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ newEmail }),
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({
      error: 'reauth_required',
      reauth_required: 'password',
    });
  });

  it('409 when the new email is already taken', async () => {
    await seedUser('occupant@example.com');
    await seedUser('mover@example.com');
    const cookie = await loginAs(app, 'mover@example.com', TEST_PASSWORD);
    const proof = await passwordProofFor(app, 'mover@example.com', TEST_PASSWORD);

    const res = await app.request('/auth/email', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        ...proof,
        newEmail: 'occupant@example.com',
      }),
    });
    expect(res.status).toBe(409);
  });
});

describe('PATCH /auth/username', () => {
  it('sets, allows duplicates (display name only), and clears with null', async () => {
    await seedUser('u1@example.com');
    await seedUser('u2@example.com');

    const cookieU1 = await loginAs(app, 'u1@example.com', TEST_PASSWORD);

    const set1 = await app.request('/auth/username', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: cookieU1 },
      body: JSON.stringify({ username: 'alice' }),
    });
    expect(set1.status).toBe(200);

    const me1 = await app.request('/auth/me', { headers: { cookie: cookieU1 } });
    const me1Body = (await me1.json()) as { username: string | null };
    expect(me1Body.username).toBe('alice');

    // u2 can claim the same display name — usernames are not
    // identifiers (the actual identity lives in `users.id` and
    // `users.email`).
    const cookieU2 = await loginAs(app, 'u2@example.com', TEST_PASSWORD);

    const dup = await app.request('/auth/username', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: cookieU2 },
      body: JSON.stringify({ username: 'alice' }),
    });
    expect(dup.status).toBe(200);

    const me2 = await app.request('/auth/me', { headers: { cookie: cookieU2 } });
    const me2Body = (await me2.json()) as { username: string | null };
    expect(me2Body.username).toBe('alice');

    // null clears the display name; u1 can now go back to NULL.
    const clear = await app.request('/auth/username', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: cookieU1 },
      body: JSON.stringify({ username: null }),
    });
    expect(clear.status).toBe(200);
  });

  it('rejects an invalid shape (400)', async () => {
    await seedUser('u3@example.com');
    const cookie = await loginAs(app, 'u3@example.com', TEST_PASSWORD);

    const res = await app.request('/auth/username', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ username: 'a' }), // too short
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/onboarding/complete', () => {
  it('flips onboardingStatus from pending to complete and is idempotent', async () => {
    await seedUser('ob@example.com');
    const cookie = await loginAs(app, 'ob@example.com', TEST_PASSWORD);

    const before = await app.request('/auth/me', { headers: { cookie } });
    const beforeBody = (await before.json()) as { onboardingStatus: string };
    expect(beforeBody.onboardingStatus).toBe('pending');

    const first = await app.request('/auth/onboarding/complete', {
      method: 'POST',
      headers: { cookie },
    });
    expect(first.status).toBe(200);

    const after = await app.request('/auth/me', { headers: { cookie } });
    const afterBody = (await after.json()) as { onboardingStatus: string };
    expect(afterBody.onboardingStatus).toBe('complete');

    // Second call must be a no-op without error.
    const second = await app.request('/auth/onboarding/complete', {
      method: 'POST',
      headers: { cookie },
    });
    expect(second.status).toBe(200);
  });

  it('returns 401 without a session cookie', async () => {
    const res = await app.request('/auth/onboarding/complete', { method: 'POST' });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /auth/me', () => {
  it('removes the user and cascades sessions + entries', async () => {
    await seedUser('suicide@example.com');
    const cookie = await loginAs(app, 'suicide@example.com', TEST_PASSWORD);
    const proof = await passwordProofFor(app, 'suicide@example.com', TEST_PASSWORD);

    const res = await app.request('/auth/me', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(proof),
    });
    expect(res.status).toBe(200);

    // Subsequent /auth/me with the same cookie returns 401 — the user
    // (and the session row they owned) is gone.
    const me = await app.request('/auth/me', { headers: { cookie } });
    expect(me.status).toBe(401);
  });

  it('rejects when the session is not fresh (Phase 7B middleware)', async () => {
    await seedUser('survivor@example.com');
    const cookie = await loginAs(app, 'survivor@example.com', TEST_PASSWORD);

    const sessionId = cookie.replace(/^nodea_session=/, '').split('.')[0]!;
    await db
      .update(sessions)
      .set({ reauthPasswordAt: new Date(Date.now() - 6 * 60_000) })
      .where(eq(sessions.id, sessionId));

    const res = await app.request('/auth/me', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({
      error: 'reauth_required',
      reauth_required: 'password',
    });
  });
});

// Suppress unused-import lints for symbols that historically were used
// here (kept around for the moment they come back into play).
void invites;
void eq;
void db;
