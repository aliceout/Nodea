import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../app.ts';
import { db } from '../db/client.ts';
import { invites, users } from '../db/schema.ts';
import {
  ADMIN_PASSWORD,
  TEST_PASSWORD,
  extractCookie,
  seedAdmin,
  seedUser,
} from './helpers.ts';

const app = buildApp();

function postJson(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

async function loginAs(email: string, password: string): Promise<string> {
  const res = await app.request('/auth/login', postJson({ email, password }));
  return extractCookie(res)!;
}

async function adminCookie(): Promise<string> {
  const admin = await seedAdmin();
  return loginAs(admin.email, ADMIN_PASSWORD);
}

describe('GET /admin/invites', () => {
  it('lists pending invites with their email + metadata', async () => {
    const cookie = await adminCookie();
    const mint1 = await app.request('/admin/invites', {
      ...postJson({ email: 'invite-a@example.com' }),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(mint1.status).toBe(201);
    const { id: id1 } = (await mint1.json()) as { id: string };

    const mint2 = await app.request('/admin/invites', {
      ...postJson({ email: 'invite-b@example.com' }),
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(mint2.status).toBe(201);
    const { id: id2 } = (await mint2.json()) as { id: string };

    const list = await app.request('/admin/invites', { headers: { cookie } });
    expect(list.status).toBe(200);
    const body = (await list.json()) as {
      invites: Array<{ id: string; email: string }>;
    };
    const byId = new Map(body.invites.map((i) => [i.id, i]));
    expect(byId.get(id1)?.email).toBe('invite-a@example.com');
    expect(byId.get(id2)?.email).toBe('invite-b@example.com');
  });

  it('refuses non-admin users', async () => {
    await seedUser('peasant@example.com');
    const cookie = await loginAs('peasant@example.com', TEST_PASSWORD);
    const res = await app.request('/admin/invites', { headers: { cookie } });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /admin/invites/:id', () => {
  it('removes an unused invite', async () => {
    const cookie = await adminCookie();
    const mint = await app.request('/admin/invites', {
      ...postJson({ email: 'doomed-invite@example.com' }),
      headers: { 'content-type': 'application/json', cookie },
    });
    const { id } = (await mint.json()) as { id: string };

    const del = await app.request(`/admin/invites/${id}`, {
      method: 'DELETE',
      headers: { cookie },
    });
    expect(del.status).toBe(200);

    const [row] = await db.select().from(invites).where(eq(invites.id, id));
    expect(row).toBeUndefined();
  });

  it('404s for an unknown id', async () => {
    const cookie = await adminCookie();
    const res = await app.request('/admin/invites/nope-not-here', {
      method: 'DELETE',
      headers: { cookie },
    });
    expect(res.status).toBe(404);
  });
});

describe('GET /admin/users', () => {
  it('returns every user without password hash', async () => {
    const cookie = await adminCookie();
    await seedUser('alice@example.com');
    await seedUser('bob@example.com');

    const res = await app.request('/admin/users', { headers: { cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      users: Array<Record<string, unknown>>;
    };
    expect(body.users.length).toBeGreaterThanOrEqual(3);
    for (const u of body.users) {
      expect(u).not.toHaveProperty('passwordHash');
      expect(u).toHaveProperty('email');
    }
  });

  it('refuses unauthenticated requests', async () => {
    const res = await app.request('/admin/users');
    expect(res.status).toBe(401);
  });
});

describe('DELETE /admin/users/:id', () => {
  it('cascades: deletes the user and their session rows', async () => {
    const cookie = await adminCookie();
    const target = await seedUser('victim@example.com');

    const del = await app.request(`/admin/users/${target.id}`, {
      method: 'DELETE',
      headers: { cookie },
    });
    expect(del.status).toBe(200);

    const [row] = await db.select().from(users).where(eq(users.id, target.id));
    expect(row).toBeUndefined();
  });

  it('refuses an admin deleting themselves', async () => {
    const admin = await seedAdmin();
    const cookie = await loginAs(admin.email, ADMIN_PASSWORD);

    const res = await app.request(`/admin/users/${admin.id}`, {
      method: 'DELETE',
      headers: { cookie },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('cannot_delete_self');
  });
});
