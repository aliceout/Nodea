import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../app.ts';
import { db } from '../db/client.ts';
import { invites, users } from '../db/schema.ts';
import {
  TEST_PASSWORD,
  ADMIN_PASSWORD,
  seedAdmin,
  seedInvite,
  seedUser,
  extractCookie,
} from './helpers.ts';

const app = buildApp();

function json(body: unknown): RequestInit {
  return { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}

async function registerBody(inviteCode: string, email: string, password = TEST_PASSWORD) {
  return {
    email,
    password,
    inviteCode,
    encryptionSalt: 'salt-base64',
    encryptedKey: 'wrapped-key-base64',
  };
}

describe('POST /auth/register', () => {
  it('creates a user and sets a session cookie when the invite is valid', async () => {
    const invite = await seedInvite();
    const res = await app.request(
      '/auth/register',
      json(await registerBody(invite.code, 'new@example.com')),
    );
    expect(res.status).toBe(201);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/nodea_session=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);

    const [row] = await db.select().from(users).where(eq(users.email, 'new@example.com'));
    expect(row).toBeDefined();
  });

  it('rejects a weak password (length OK, entropy not)', async () => {
    const invite = await seedInvite();
    // 12+ chars so Zod accepts it, but clearly a very common pattern so
    // zxcvbn returns score 0 or 1.
    const res = await app.request(
      '/auth/register',
      json(await registerBody(invite.code, 'weak@example.com', 'password1234')),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('weak_password');
  });

  it('rejects an unknown invite code', async () => {
    const res = await app.request(
      '/auth/register',
      json(await registerBody('nd-totallybogus000000000', 'x@example.com')),
    );
    expect(res.status).toBe(400);
  });

  it('prevents invite reuse (atomic consumption)', async () => {
    const invite = await seedInvite();

    // First race: two parallel registrations with the same code.
    const [a, b] = await Promise.all([
      app.request('/auth/register', json(await registerBody(invite.code, 'first@example.com'))),
      app.request('/auth/register', json(await registerBody(invite.code, 'second@example.com'))),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses[0]).toBe(201);
    expect(statuses[1]).toBe(400);

    // Third attempt sequentially — still refused.
    const c = await app.request(
      '/auth/register',
      json(await registerBody(invite.code, 'third@example.com')),
    );
    expect(c.status).toBe(400);

    // The invite row must be marked consumed.
    const [row] = await db.select().from(invites).where(eq(invites.id, invite.id));
    expect(row?.usedBy).toBeDefined();
    expect(row?.usedAt).toBeInstanceOf(Date);
  });
});

describe('POST /auth/login', () => {
  it('accepts correct credentials and returns a session cookie', async () => {
    await seedUser('loginme@example.com');
    const res = await app.request(
      '/auth/login',
      json({ email: 'loginme@example.com', password: TEST_PASSWORD }),
    );
    expect(res.status).toBe(200);
    expect(extractCookie(res)).toBeTruthy();
  });

  it('rejects a wrong password', async () => {
    await seedUser('loginme@example.com');
    const res = await app.request(
      '/auth/login',
      json({ email: 'loginme@example.com', password: 'not-the-password' }),
    );
    expect(res.status).toBe(401);
  });

  it('rejects an unknown email with the same shape of error (no enumeration leak)', async () => {
    const res = await app.request(
      '/auth/login',
      json({ email: 'nobody@example.com', password: 'anything-will-do' }),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('invalid_credentials');
  });
});

describe('POST /auth/logout', () => {
  it('revokes the session and clears the cookie', async () => {
    await seedUser('logoutme@example.com');
    const login = await app.request(
      '/auth/login',
      json({ email: 'logoutme@example.com', password: TEST_PASSWORD }),
    );
    const cookie = extractCookie(login)!;

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
  it('returns the current user (without password hash)', async () => {
    await seedUser('me@example.com');
    const login = await app.request(
      '/auth/login',
      json({ email: 'me@example.com', password: TEST_PASSWORD }),
    );
    const cookie = extractCookie(login)!;

    const res = await app.request('/auth/me', { headers: { cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.email).toBe('me@example.com');
    expect(body).not.toHaveProperty('passwordHash');
    expect(body).toHaveProperty('encryptionSalt');
    expect(body).toHaveProperty('encryptedKey');
  });

  it('returns 401 without a cookie', async () => {
    const res = await app.request('/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/change-password', () => {
  const newPassword = 'Brand-New-Horse-Battery-Staple-99';

  it('rotates the password, revokes the old session, and issues a fresh one', async () => {
    await seedUser('rotate@example.com');
    const login = await app.request(
      '/auth/login',
      json({ email: 'rotate@example.com', password: TEST_PASSWORD }),
    );
    const oldCookie = extractCookie(login)!;

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

    // New cookie works and old password no longer does.
    const meNew = await app.request('/auth/me', { headers: { cookie: newCookie } });
    expect(meNew.status).toBe(200);

    const relogOld = await app.request(
      '/auth/login',
      json({ email: 'rotate@example.com', password: TEST_PASSWORD }),
    );
    expect(relogOld.status).toBe(401);

    const relogNew = await app.request(
      '/auth/login',
      json({ email: 'rotate@example.com', password: newPassword }),
    );
    expect(relogNew.status).toBe(200);
  });

  it('rejects when the current password is wrong', async () => {
    await seedUser('rotate2@example.com');
    const login = await app.request(
      '/auth/login',
      json({ email: 'rotate2@example.com', password: TEST_PASSWORD }),
    );
    const cookie = extractCookie(login)!;

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
  it('lets an admin mint an invite and returns the clear code once', async () => {
    const admin = await seedAdmin();
    const login = await app.request(
      '/auth/login',
      json({ email: admin.email, password: ADMIN_PASSWORD }),
    );
    const cookie = extractCookie(login)!;

    const res = await app.request('/admin/invites', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; code: string };
    expect(body.code).toMatch(/^nd-[a-z2-9]+$/);
  });

  it('refuses a non-admin user', async () => {
    await seedUser('peasant@example.com');
    const login = await app.request(
      '/auth/login',
      json({ email: 'peasant@example.com', password: TEST_PASSWORD }),
    );
    const cookie = extractCookie(login)!;

    const res = await app.request('/admin/invites', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
  });

  it('refuses unauthenticated requests', async () => {
    const res = await app.request('/admin/invites', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });
});

describe('PATCH /auth/email', () => {
  const newEmail = 'renamed@example.com';

  it('updates the email when the current password is correct', async () => {
    await seedUser('rename@example.com');
    const login = await app.request(
      '/auth/login',
      json({ email: 'rename@example.com', password: TEST_PASSWORD }),
    );
    const cookie = extractCookie(login)!;

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
    const login = await app.request(
      '/auth/login',
      json({ email: 'rename2@example.com', password: TEST_PASSWORD }),
    );
    const cookie = extractCookie(login)!;

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
    const login = await app.request(
      '/auth/login',
      json({ email: 'mover@example.com', password: TEST_PASSWORD }),
    );
    const cookie = extractCookie(login)!;

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

    const loginU1 = await app.request(
      '/auth/login',
      json({ email: 'u1@example.com', password: TEST_PASSWORD }),
    );
    const cookieU1 = extractCookie(loginU1)!;

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
    const loginU2 = await app.request(
      '/auth/login',
      json({ email: 'u2@example.com', password: TEST_PASSWORD }),
    );
    const cookieU2 = extractCookie(loginU2)!;

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
    const login = await app.request(
      '/auth/login',
      json({ email: 'u3@example.com', password: TEST_PASSWORD }),
    );
    const cookie = extractCookie(login)!;

    const res = await app.request('/auth/username', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ username: 'a' }), // too short
    });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /auth/me', () => {
  it('removes the user and cascades sessions + entries', async () => {
    await seedUser('suicide@example.com');
    const login = await app.request(
      '/auth/login',
      json({ email: 'suicide@example.com', password: TEST_PASSWORD }),
    );
    const cookie = extractCookie(login)!;

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
    const login = await app.request(
      '/auth/login',
      json({ email: 'survivor@example.com', password: TEST_PASSWORD }),
    );
    const cookie = extractCookie(login)!;

    const res = await app.request('/auth/me', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ currentPassword: 'not-the-one' }),
    });
    expect(res.status).toBe(401);
  });
});
