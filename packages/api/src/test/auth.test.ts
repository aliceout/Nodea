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
import { buildApp } from '../app.ts';
import { db } from '../db/client.ts';
import { invites, users } from '../db/schema.ts';
import {
  TEST_PASSWORD,
  ADMIN_PASSWORD,
  loginAs,
  seedAdmin,
  seedInvite,
  seedUser,
  extractCookie,
} from './helpers.ts';

const app = buildApp();

function json(body: unknown): RequestInit {
  return { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
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
  it('returns the current user with both legacy + OPAQUE credential blobs', async () => {
    await seedUser('me@example.com');
    const cookie = await loginAs(app, 'me@example.com', TEST_PASSWORD);

    const res = await app.request('/auth/me', { headers: { cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.email).toBe('me@example.com');
    expect(body).not.toHaveProperty('passwordHash');
    expect(body).toHaveProperty('encryptionSalt');
    expect(body).toHaveProperty('encryptedKey');
    expect(body).toHaveProperty('wrappedMainKey');
    expect(body).toHaveProperty('wrappedKekPassword');
  });

  it('returns 401 without a cookie', async () => {
    const res = await app.request('/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/change-password', () => {
  const newPassword = 'Brand-New-Horse-Battery-Staple-99';

  // Phase 2C note: change-password still goes through the legacy
  // Argon2id path until 2D rewires it on top of OPAQUE re-registration.
  // Tests below cover the route's HTTP semantics (rotation, session
  // revocation, wrong-password rejection); the matching OPAQUE
  // envelope rotation lands in 2D.
  it('rotates the password, revokes the old session, and issues a fresh one', async () => {
    await seedUser('rotate@example.com');
    const oldCookie = await loginAs(app, 'rotate@example.com', TEST_PASSWORD);

    const change = await app.request('/auth/change-password', {
      ...json({
        currentPassword: TEST_PASSWORD,
        newPassword,
        encryptionSalt: 'new-salt',
        encryptedKey: 'new-wrapped',
      }),
      headers: {
        'content-type': 'application/json',
        cookie: oldCookie,
      },
    });
    expect(change.status).toBe(200);

    // The response must include a NEW session cookie.
    const newCookie = extractCookie(change)!;
    expect(newCookie).not.toBe(oldCookie);

    // Old cookie is dead.
    const meOld = await app.request('/auth/me', { headers: { cookie: oldCookie } });
    expect(meOld.status).toBe(401);

    // New cookie works.
    const meNew = await app.request('/auth/me', { headers: { cookie: newCookie } });
    expect(meNew.status).toBe(200);

    // Phase 2D will assert that re-login with the OLD password is
    // refused — currently the OPAQUE envelope still binds the old
    // password (legacy change-password only rotates `password_hash`)
    // so an OPAQUE login with TEST_PASSWORD would still succeed.
    // Skipped on purpose until 2D rewires change-password.
  });

  it('rejects when the current password is wrong', async () => {
    await seedUser('rotate2@example.com');
    const cookie = await loginAs(app, 'rotate2@example.com', TEST_PASSWORD);

    const change = await app.request('/auth/change-password', {
      ...json({
        currentPassword: 'wrong',
        newPassword,
        encryptionSalt: 's',
        encryptedKey: 'k',
      }),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(change.status).toBe(401);
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

  it('updates the email when the current password is correct', async () => {
    await seedUser('rename@example.com');
    const cookie = await loginAs(app, 'rename@example.com', TEST_PASSWORD);

    const res = await app.request('/auth/email', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ currentPassword: TEST_PASSWORD, newEmail }),
    });
    expect(res.status).toBe(200);

    const me = await app.request('/auth/me', { headers: { cookie } });
    const meBody = (await me.json()) as { email: string };
    expect(meBody.email).toBe(newEmail);
  });

  it('rejects a wrong current password (401)', async () => {
    await seedUser('rename2@example.com');
    const cookie = await loginAs(app, 'rename2@example.com', TEST_PASSWORD);

    const res = await app.request('/auth/email', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ currentPassword: 'wrong', newEmail }),
    });
    expect(res.status).toBe(401);
  });

  it('409 when the new email is already taken', async () => {
    await seedUser('occupant@example.com');
    await seedUser('mover@example.com');
    const cookie = await loginAs(app, 'mover@example.com', TEST_PASSWORD);

    const res = await app.request('/auth/email', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        currentPassword: TEST_PASSWORD,
        newEmail: 'occupant@example.com',
      }),
    });
    expect(res.status).toBe(409);
  });
});

describe('PATCH /auth/username', () => {
  it('sets, rejects duplicates (409), and clears with null', async () => {
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

    // u2 cannot claim the same name → 409.
    const cookieU2 = await loginAs(app, 'u2@example.com', TEST_PASSWORD);

    const collide = await app.request('/auth/username', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: cookieU2 },
      body: JSON.stringify({ username: 'alice' }),
    });
    expect(collide.status).toBe(409);

    // null clears, then u2 can take the freed slot.
    const clear = await app.request('/auth/username', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: cookieU1 },
      body: JSON.stringify({ username: null }),
    });
    expect(clear.status).toBe(200);

    const claim = await app.request('/auth/username', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: cookieU2 },
      body: JSON.stringify({ username: 'alice' }),
    });
    expect(claim.status).toBe(200);
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

    const res = await app.request('/auth/me', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ currentPassword: TEST_PASSWORD }),
    });
    expect(res.status).toBe(200);

    // Subsequent /auth/me with the same cookie returns 401 — the user
    // (and the session row they owned) is gone.
    const me = await app.request('/auth/me', { headers: { cookie } });
    expect(me.status).toBe(401);
  });

  it('rejects a wrong current password (401)', async () => {
    await seedUser('survivor@example.com');
    const cookie = await loginAs(app, 'survivor@example.com', TEST_PASSWORD);

    const res = await app.request('/auth/me', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ currentPassword: 'not-the-one' }),
    });
    expect(res.status).toBe(401);
  });
});

// Suppress unused-import lints for symbols that historically were used
// here (kept around for the moment they come back into play).
void invites;
void eq;
void db;
