import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../app.ts';
import { db } from '../db/client.ts';
import { moodEntries } from '../db/schema.ts';
import { COLLECTIONS } from '../collections.ts';
import { loginAs, seedUser, TEST_PASSWORD } from './helpers.ts';

const app = buildApp();

async function authFor(email: string): Promise<string> {
  await seedUser(email);
  return loginAs(app, email, TEST_PASSWORD);
}

const FAKE_GUARD = 'g_' + 'a'.repeat(64);

function jsonBody(body: unknown, cookie: string): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(body),
  };
}

/** SEC-01 — sid + guard travel as headers, never query params. */
function authHeaders(
  cookie: string,
  sid: string,
  guard?: string,
): Record<string, string> {
  const h: Record<string, string> = {
    'content-type': 'application/json',
    cookie,
    'x-sid': sid,
  };
  if (guard !== undefined) h['x-guard'] = guard;
  return h;
}

describe('Collection routes — Mood used as the representative', () => {
  it('goes through the full create → promote → update → list → delete flow', async () => {
    const cookie = await authFor('flow@example.com');
    const sid = 'sid-flow-1';

    // CREATE (guard must be "init")
    const created = await app.request('/mood/records', {
      ...jsonBody(
        {
          sid,
          cipherIv: 'iv-v1',
          payload: 'cipher-v1',
          guard: 'init',
        },
        cookie,
      ),
    });
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as Record<string, unknown>;
    expect(createdBody).not.toHaveProperty('guard');
    const entryId = createdBody.id as string;

    // PROMOTE init → g_...
    const promoted = await app.request(`/mood/records/${entryId}`, {
      method: 'PATCH',
      headers: authHeaders(cookie, sid, 'init'),
      body: JSON.stringify({ guard: FAKE_GUARD }),
    });
    expect(promoted.status).toBe(200);
    const promotedBody = (await promoted.json()) as Record<string, unknown>;
    expect(promotedBody).not.toHaveProperty('guard');

    // UPDATE content with the real guard
    const updated = await app.request(`/mood/records/${entryId}`, {
      method: 'PATCH',
      headers: authHeaders(cookie, sid, FAKE_GUARD),
      body: JSON.stringify({ cipherIv: 'iv-v2', payload: 'cipher-v2' }),
    });
    expect(updated.status).toBe(200);
    const updatedBody = (await updated.json()) as Record<string, unknown>;
    expect(updatedBody.cipherIv).toBe('iv-v2');
    expect(updatedBody).not.toHaveProperty('guard');

    // LIST
    const list = await app.request('/mood/records', {
      headers: { cookie, 'x-sid': sid },
    });
    expect(list.status).toBe(200);
    const listBody = (await list.json()) as { records: Record<string, unknown>[] };
    expect(listBody.records).toHaveLength(1);
    expect(listBody.records[0]).not.toHaveProperty('guard');
    expect(listBody.records[0]?.cipherIv).toBe('iv-v2');

    // DELETE
    const deleted = await app.request(`/mood/records/${entryId}`, {
      method: 'DELETE',
      headers: { cookie, 'x-sid': sid, 'x-guard': FAKE_GUARD },
    });
    expect(deleted.status).toBe(200);

    const [row] = await db.select().from(moodEntries).where(eq(moodEntries.id, entryId));
    expect(row).toBeUndefined();
  });

  it('rejects PATCH without the guard header (X-Guard)', async () => {
    const cookie = await authFor('noguard@example.com');
    const sid = 'sid-noguard';

    const created = await app.request('/mood/records', {
      ...jsonBody(
        { sid, cipherIv: 'iv', payload: 'c', guard: 'init' },
        cookie,
      ),
    });
    const { id } = (await created.json()) as { id: string };

    // Missing X-Guard → must be rejected before the handler runs.
    const res = await app.request(`/mood/records/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie, 'x-sid': sid },
      body: JSON.stringify({ cipherIv: 'iv2' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects PATCH with a wrong guard (403, not 404)', async () => {
    const cookie = await authFor('wrongguard@example.com');
    const sid = 'sid-wrong';

    const created = await app.request('/mood/records', {
      ...jsonBody(
        { sid, cipherIv: 'iv', payload: 'c', guard: 'init' },
        cookie,
      ),
    });
    const { id } = (await created.json()) as { id: string };

    const res = await app.request(`/mood/records/${id}`, {
      method: 'PATCH',
      headers: authHeaders(cookie, sid, 'init-wrong'),
      body: JSON.stringify({ cipherIv: 'iv2' }),
    });
    expect(res.status).toBe(403);
  });

  it('refuses to re-promote a guard that was already promoted', async () => {
    const cookie = await authFor('nore@example.com');
    const sid = 'sid-nore';

    const created = await app.request('/mood/records', {
      ...jsonBody({ sid, cipherIv: 'iv', payload: 'c', guard: 'init' }, cookie),
    });
    const { id } = (await created.json()) as { id: string };

    await app.request(`/mood/records/${id}`, {
      method: 'PATCH',
      headers: authHeaders(cookie, sid, 'init'),
      body: JSON.stringify({ guard: FAKE_GUARD }),
    });

    const again = await app.request(`/mood/records/${id}`, {
      method: 'PATCH',
      headers: authHeaders(cookie, sid, FAKE_GUARD),
      body: JSON.stringify({ guard: 'g_' + 'b'.repeat(64) }),
    });
    expect(again.status).toBe(400);
  });

  it('scopes rows by sid only — distinct sids never collide', async () => {
    // Post-`user_id` removal: scoping is by `moduleUserId` (sid)
    // alone. Sids are derived client-side from the user's main key
    // + module-specific entropy (32 bytes random), so accidental
    // collisions are cryptographically negligible. Knowing another
    // user's sid requires having their main key — at which point
    // the data is compromised regardless.
    //
    // This test asserts: rows under sid_A and sid_B are disjoint
    // as queried. The previous "two users sharing the same sid"
    // case was testing a defense-in-depth that intentionally no
    // longer exists — `user_id` on entry rows was a privacy
    // regression that let the operator count entries per user per
    // module.
    const cookieA = await authFor('alice@example.com');
    const cookieB = await authFor('bob@example.com');

    await app.request('/mood/records', {
      ...jsonBody({ sid: 'sid-alice', cipherIv: 'A-iv', payload: 'A', guard: 'init' }, cookieA),
    });
    await app.request('/mood/records', {
      ...jsonBody({ sid: 'sid-bob', cipherIv: 'B-iv', payload: 'B', guard: 'init' }, cookieB),
    });

    const aList = await app.request('/mood/records', {
      headers: { cookie: cookieA, 'x-sid': 'sid-alice' },
    });
    const aBody = (await aList.json()) as { records: Array<{ payload: string }> };
    expect(aBody.records).toHaveLength(1);
    expect(aBody.records[0]?.payload).toBe('A');

    const bList = await app.request('/mood/records', {
      headers: { cookie: cookieB, 'x-sid': 'sid-bob' },
    });
    const bBody = (await bList.json()) as { records: Array<{ payload: string }> };
    expect(bBody.records).toHaveLength(1);
    expect(bBody.records[0]?.payload).toBe('B');
  });

  it('requires authentication on every route', async () => {
    const unauthed = await Promise.all([
      app.request('/mood/records', { headers: { 'x-sid': 'x' } }),
      app.request('/mood/records', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
      app.request('/mood/records/anything', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-sid': 'x',
          'x-guard': 'init',
        },
        body: '{}',
      }),
      app.request('/mood/records/anything', {
        method: 'DELETE',
        headers: { 'x-sid': 'x', 'x-guard': 'init' },
      }),
    ]);
    for (const res of unauthed) expect(res.status).toBe(401);
  });
});

describe('Every registered collection is mounted and guard-protected', () => {
  it.each(COLLECTIONS.map((c) => c.name))('%s exposes the 4 CRUD routes', async (name) => {
    const cookie = await authFor(`user-${name.replace(/-/g, '_')}@example.com`);

    // CREATE
    const create = await app.request(`/${name}/records`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ sid: 'sid-x', cipherIv: 'iv', payload: 'c', guard: 'init' }),
    });
    expect(create.status).toBe(201);
    const { id } = (await create.json()) as { id: string };

    // Guard missing → 400
    const badPatch = await app.request(`/${name}/records/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie, 'x-sid': 'sid-x' },
      body: JSON.stringify({ cipherIv: 'iv2' }),
    });
    expect(badPatch.status).toBe(400);

    // Correct guard → 200
    const goodPatch = await app.request(`/${name}/records/${id}`, {
      method: 'PATCH',
      headers: authHeaders(cookie, 'sid-x', 'init'),
      body: JSON.stringify({ cipherIv: 'iv2' }),
    });
    expect(goodPatch.status).toBe(200);
  });
});

describe('/modules-config (no guard)', () => {
  it('returns an empty shape for a fresh user', async () => {
    const cookie = await authFor('cfg1@example.com');
    const res = await app.request('/modules-config', { headers: { cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { cipherIv: string | null };
    expect(body.cipherIv).toBeNull();
  });

  it('upserts via PUT and reads it back', async () => {
    const cookie = await authFor('cfg2@example.com');

    const put = await app.request('/modules-config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ cipherIv: 'iv-cfg', payload: 'blob-1' }),
    });
    expect(put.status).toBe(200);

    const get = await app.request('/modules-config', { headers: { cookie } });
    const body = (await get.json()) as Record<string, unknown>;
    expect(body.cipherIv).toBe('iv-cfg');
    expect(body.payload).toBe('blob-1');

    // Second PUT overwrites.
    await app.request('/modules-config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ cipherIv: 'iv-cfg-2', payload: 'blob-2' }),
    });
    const get2 = await app.request('/modules-config', { headers: { cookie } });
    const body2 = (await get2.json()) as Record<string, unknown>;
    expect(body2.payload).toBe('blob-2');
  });

  it('requires authentication', async () => {
    const a = await app.request('/modules-config');
    expect(a.status).toBe(401);
  });
});
