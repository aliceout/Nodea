import { describe, it, expect } from 'vitest';
import { buildApp } from '../app.ts';
import {
  ADMIN_PASSWORD,
  TEST_PASSWORD,
  loginAs,
  seedAdmin,
  seedUser,
} from './helpers.ts';
import type { AnnouncementResponse } from '@nodea/shared';

const app = buildApp();

async function adminCookie(): Promise<string> {
  const admin = await seedAdmin();
  return loginAs(app, admin.email, ADMIN_PASSWORD);
}

async function userCookie(email = 'user@example.com'): Promise<string> {
  await seedUser(email);
  return loginAs(app, email, TEST_PASSWORD);
}

async function createAnnouncement(
  cookie: string,
  body: Record<string, unknown>,
): Promise<AnnouncementResponse> {
  const res = await app.request('/admin/announcements', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(body),
  });
  expect(res.status).toBe(201);
  return (await res.json()) as AnnouncementResponse;
}

describe('POST /admin/announcements', () => {
  it('creates a row and returns the serialized announcement', async () => {
    const cookie = await adminCookie();
    const created = await createAnnouncement(cookie, {
      title: 'Hello',
      body: 'Nodea v1 is live.',
    });
    expect(created.id).toMatch(/.+/);
    expect(created.title).toBe('Hello');
    expect(created.body).toBe('Nodea v1 is live.');
    expect(created.active).toBe(true);
    expect(created.startAt).toBeNull();
    expect(created.endAt).toBeNull();
  });

  it('rejects a non-admin user (403)', async () => {
    const cookie = await userCookie();
    const res = await app.request('/admin/announcements', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ title: 'x', body: 'y' }),
    });
    expect(res.status).toBe(403);
  });

  it('rejects invalid bodies (400)', async () => {
    const cookie = await adminCookie();
    const res = await app.request('/admin/announcements', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ title: '', body: 'only-body' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /admin/announcements', () => {
  it('lists every row including inactive ones', async () => {
    const cookie = await adminCookie();
    const a = await createAnnouncement(cookie, { title: 'A', body: 'a' });
    const b = await createAnnouncement(cookie, { title: 'B', body: 'b', active: false });

    const res = await app.request('/admin/announcements', { headers: { cookie } });
    const { data: rows } = (await res.json()) as {
      data: AnnouncementResponse[];
      meta: Record<string, unknown>;
    };
    expect(rows).toHaveLength(2);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(b.id);
  });
});

describe('PATCH /admin/announcements/:id', () => {
  it('updates allowed fields and returns the fresh row', async () => {
    const cookie = await adminCookie();
    const created = await createAnnouncement(cookie, { title: 'T', body: 'B' });

    const res = await app.request(`/admin/announcements/${created.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ title: 'T2', active: false }),
    });
    expect(res.status).toBe(200);
    const updated = (await res.json()) as AnnouncementResponse;
    expect(updated.title).toBe('T2');
    expect(updated.active).toBe(false);
    expect(updated.body).toBe('B');
  });

  it('returns 404 for an unknown id', async () => {
    const cookie = await adminCookie();
    const res = await app.request('/admin/announcements/nope', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ title: 'x' }),
    });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /admin/announcements/:id', () => {
  it('removes the row', async () => {
    const cookie = await adminCookie();
    const created = await createAnnouncement(cookie, { title: 'T', body: 'B' });

    const res = await app.request(`/admin/announcements/${created.id}`, {
      method: 'DELETE',
      headers: { cookie },
    });
    expect(res.status).toBe(200);

    const list = await app.request('/admin/announcements', { headers: { cookie } });
    const { data: rows } = (await list.json()) as {
      data: AnnouncementResponse[];
      meta: Record<string, unknown>;
    };
    expect(rows.find((r) => r.id === created.id)).toBeUndefined();
  });
});

describe('GET /announcements (public feed)', () => {
  it('returns active, in-window rows for authenticated users', async () => {
    const adminC = await adminCookie();
    const live = await createAnnouncement(adminC, { title: 'Live', body: 'now' });
    const inactive = await createAnnouncement(adminC, {
      title: 'Inactive',
      body: 'hidden',
      active: false,
    });
    const future = await createAnnouncement(adminC, {
      title: 'Future',
      body: 'not yet',
      startAt: new Date(Date.now() + 86_400_000).toISOString(),
    });

    const userC = await userCookie();
    const res = await app.request('/announcements', { headers: { cookie: userC } });
    expect(res.status).toBe(200);
    const { data: rows } = (await res.json()) as {
      data: AnnouncementResponse[];
      meta: Record<string, unknown>;
    };
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(live.id);
    expect(ids).not.toContain(inactive.id);
    expect(ids).not.toContain(future.id);
  });

  it('returns 401 without a session cookie', async () => {
    const res = await app.request('/announcements');
    expect(res.status).toBe(401);
  });
});
