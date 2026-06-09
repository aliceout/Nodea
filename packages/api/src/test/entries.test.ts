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

/** SEC-01 — sid + guard travel as headers, never query params.
 *  Issue #67 — collection name moves to the `X-Collection` header so
 *  the URL is the same for every module. */
function authHeaders(
  cookie: string,
  sid: string,
  collection: string,
  guard?: string,
): Record<string, string> {
  const h: Record<string, string> = {
    'content-type': 'application/json',
    cookie,
    'x-sid': sid,
    'x-collection': collection,
  };
  if (guard !== undefined) h['x-guard'] = guard;
  return h;
}

/** POST-body request init with the collection header set. */
function jsonBodyForCollection(body: unknown, cookie: string, collection: string): RequestInit {
  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie,
      'x-collection': collection,
    },
    body: JSON.stringify(body),
  };
}

describe('Collection routes — Mood used as the representative', () => {
  it('goes through the full create → promote → update → list → delete flow', async () => {
    const cookie = await authFor('flow@example.com');
    const sid = 'sid-flow-1';

    // CREATE (guard must be "init")
    const created = await app.request('/records', {
      ...jsonBodyForCollection(
        {
          sid,
          cipherIv: 'iv-v1',
          payload: 'cipher-v1',
          guard: 'init',
        },
        cookie,
        'mood',
      ),
    });
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as Record<string, unknown>;
    expect(createdBody).not.toHaveProperty('guard');
    const entryId = createdBody.id as string;

    // PROMOTE init → g_...
    const promoted = await app.request(`/records/${entryId}`, {
      method: 'PATCH',
      headers: authHeaders(cookie, sid, 'mood', 'init'),
      body: JSON.stringify({ guard: FAKE_GUARD }),
    });
    expect(promoted.status).toBe(200);
    const promotedBody = (await promoted.json()) as Record<string, unknown>;
    expect(promotedBody).not.toHaveProperty('guard');

    // UPDATE content with the real guard
    const updated = await app.request(`/records/${entryId}`, {
      method: 'PATCH',
      headers: authHeaders(cookie, sid, 'mood', FAKE_GUARD),
      body: JSON.stringify({ cipherIv: 'iv-v2', payload: 'cipher-v2' }),
    });
    expect(updated.status).toBe(200);
    const updatedBody = (await updated.json()) as Record<string, unknown>;
    expect(updatedBody.cipherIv).toBe('iv-v2');
    expect(updatedBody).not.toHaveProperty('guard');

    // LIST
    const list = await app.request('/records', {
      headers: { cookie, 'x-sid': sid, 'x-collection': 'mood' },
    });
    expect(list.status).toBe(200);
    const listBody = (await list.json()) as {
      data: Record<string, unknown>[];
      meta: Record<string, unknown>;
    };
    expect(listBody.data).toHaveLength(1);
    expect(listBody.data[0]).not.toHaveProperty('guard');
    expect(listBody.data[0]?.cipherIv).toBe('iv-v2');

    // DELETE
    const deleted = await app.request(`/records/${entryId}`, {
      method: 'DELETE',
      headers: { cookie, 'x-sid': sid, 'x-guard': FAKE_GUARD, 'x-collection': 'mood' },
    });
    expect(deleted.status).toBe(200);

    const [row] = await db.select().from(moodEntries).where(eq(moodEntries.id, entryId));
    expect(row).toBeUndefined();
  });

  it('rejects PATCH without the guard header (X-Guard)', async () => {
    const cookie = await authFor('noguard@example.com');
    const sid = 'sid-noguard';

    const created = await app.request('/records', {
      ...jsonBodyForCollection(
        { sid, cipherIv: 'iv', payload: 'c', guard: 'init' },
        cookie,
        'mood',
      ),
    });
    const { id } = (await created.json()) as { id: string };

    // Missing X-Guard → must be rejected before the handler runs.
    const res = await app.request(`/records/${id}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie,
        'x-sid': sid,
        'x-collection': 'mood',
      },
      body: JSON.stringify({ cipherIv: 'iv2' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects PATCH with a wrong guard (403, not 404)', async () => {
    const cookie = await authFor('wrongguard@example.com');
    const sid = 'sid-wrong';

    const created = await app.request('/records', {
      ...jsonBodyForCollection(
        { sid, cipherIv: 'iv', payload: 'c', guard: 'init' },
        cookie,
        'mood',
      ),
    });
    const { id } = (await created.json()) as { id: string };

    const res = await app.request(`/records/${id}`, {
      method: 'PATCH',
      headers: authHeaders(cookie, sid, 'mood', 'init-wrong'),
      body: JSON.stringify({ cipherIv: 'iv2' }),
    });
    expect(res.status).toBe(403);
  });

  it('refuses to re-promote a guard that was already promoted', async () => {
    const cookie = await authFor('nore@example.com');
    const sid = 'sid-nore';

    const created = await app.request('/records', {
      ...jsonBodyForCollection({ sid, cipherIv: 'iv', payload: 'c', guard: 'init' }, cookie, 'mood'),
    });
    const { id } = (await created.json()) as { id: string };

    await app.request(`/records/${id}`, {
      method: 'PATCH',
      headers: authHeaders(cookie, sid, 'mood', 'init'),
      body: JSON.stringify({ guard: FAKE_GUARD }),
    });

    const again = await app.request(`/records/${id}`, {
      method: 'PATCH',
      headers: authHeaders(cookie, sid, 'mood', FAKE_GUARD),
      body: JSON.stringify({ guard: 'g_' + 'b'.repeat(64) }),
    });
    expect(again.status).toBe(400);
  });

  it('scopes rows by sid only — distinct sids never collide', async () => {
    // Post-`user_id` removal: scoping is by `moduleUserId` (sid)
    // alone. Sids are derived client-side from the user's main key
    // + module-specific entropy (32 bytes random), so accidental
    // collisions are cryptographically negligible.
    const cookieA = await authFor('alice@example.com');
    const cookieB = await authFor('bob@example.com');

    await app.request('/records', {
      ...jsonBodyForCollection(
        { sid: 'sid-alice', cipherIv: 'A-iv', payload: 'A', guard: 'init' },
        cookieA,
        'mood',
      ),
    });
    await app.request('/records', {
      ...jsonBodyForCollection(
        { sid: 'sid-bob', cipherIv: 'B-iv', payload: 'B', guard: 'init' },
        cookieB,
        'mood',
      ),
    });

    const aList = await app.request('/records', {
      headers: { cookie: cookieA, 'x-sid': 'sid-alice', 'x-collection': 'mood' },
    });
    const aBody = (await aList.json()) as {
      data: Array<{ payload: string }>;
      meta: Record<string, unknown>;
    };
    expect(aBody.data).toHaveLength(1);
    expect(aBody.data[0]?.payload).toBe('A');

    const bList = await app.request('/records', {
      headers: { cookie: cookieB, 'x-sid': 'sid-bob', 'x-collection': 'mood' },
    });
    const bBody = (await bList.json()) as {
      data: Array<{ payload: string }>;
      meta: Record<string, unknown>;
    };
    expect(bBody.data).toHaveLength(1);
    expect(bBody.data[0]?.payload).toBe('B');
  });

  it('requires authentication on every route', async () => {
    const unauthed = await Promise.all([
      app.request('/records', { headers: { 'x-sid': 'x', 'x-collection': 'mood' } }),
      app.request('/records', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-collection': 'mood' },
        body: '{}',
      }),
      app.request('/records/anything', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-sid': 'x',
          'x-guard': 'init',
          'x-collection': 'mood',
        },
        body: '{}',
      }),
      app.request('/records/anything', {
        method: 'DELETE',
        headers: { 'x-sid': 'x', 'x-guard': 'init', 'x-collection': 'mood' },
      }),
    ]);
    for (const res of unauthed) expect(res.status).toBe(401);
  });

  it('rejects requests with a missing or unknown X-Collection header (issue #67)', async () => {
    const cookie = await authFor('badcol@example.com');
    const missing = await app.request('/records', {
      headers: { cookie, 'x-sid': 'sid-x' },
    });
    expect(missing.status).toBe(400);

    const unknown = await app.request('/records', {
      headers: { cookie, 'x-sid': 'sid-x', 'x-collection': 'nonexistent' },
    });
    expect(unknown.status).toBe(400);
  });
});

describe('Every registered collection is routable via X-Collection (issue #67)', () => {
  it.each(COLLECTIONS.map((c) => c.name))('%s round-trips create + guard-promote via /records + X-Collection', async (name) => {
    const cookie = await authFor(`user-${name.replace(/-/g, '_')}@example.com`);

    // CREATE
    const create = await app.request(`/records`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, 'x-collection': name },
      body: JSON.stringify({ sid: 'sid-x', cipherIv: 'iv', payload: 'c', guard: 'init' }),
    });
    expect(create.status).toBe(201);
    const { id } = (await create.json()) as { id: string };

    // Guard missing → 400
    const badPatch = await app.request(`/records/${id}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie,
        'x-sid': 'sid-x',
        'x-collection': name,
      },
      body: JSON.stringify({ cipherIv: 'iv2' }),
    });
    expect(badPatch.status).toBe(400);

    // Correct guard → 200
    const goodPatch = await app.request(`/records/${id}`, {
      method: 'PATCH',
      headers: authHeaders(cookie, 'sid-x', name, 'init'),
      body: JSON.stringify({ cipherIv: 'iv2' }),
    });
    expect(goodPatch.status).toBe(200);
  });
});

describe('Bulk records — POST /records/bulk + POST /records/promote-guards (issue #127)', () => {
  it('creates N entries in one POST, all at init guard, in input order', async () => {
    const cookie = await authFor('bulkA@example.com');
    const sid = 'sid-bulkA';

    const res = await app.request('/records/bulk', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, 'x-collection': 'mood' },
      body: JSON.stringify({
        sid,
        entries: [
          { cipherIv: 'iv-1', payload: 'c-1' },
          { cipherIv: 'iv-2', payload: 'c-2' },
          { cipherIv: 'iv-3', payload: 'c-3' },
        ],
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      data: Array<{ id: string; moduleUserId: string; cipherIv: string; payload: string }>;
    };
    expect(body.data).toHaveLength(3);
    expect(body.data[0]!.cipherIv).toBe('iv-1');
    expect(body.data[1]!.cipherIv).toBe('iv-2');
    expect(body.data[2]!.cipherIv).toBe('iv-3');
    expect(body.data[0]).not.toHaveProperty('guard');

    // List the sid: all 3 rows visible.
    const list = await app.request('/records', {
      headers: { cookie, 'x-sid': sid, 'x-collection': 'mood' },
    });
    const listBody = (await list.json()) as { data: Array<{ id: string }> };
    expect(listBody.data).toHaveLength(3);
  });

  it('promote-guards flips every init guard to its HMAC value atomically', async () => {
    const cookie = await authFor('bulkB@example.com');
    const sid = 'sid-bulkB';

    const created = await app.request('/records/bulk', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, 'x-collection': 'mood' },
      body: JSON.stringify({
        sid,
        entries: [
          { cipherIv: 'iv-a', payload: 'a' },
          { cipherIv: 'iv-b', payload: 'b' },
        ],
      }),
    });
    const createdBody = (await created.json()) as { data: Array<{ id: string }> };
    const ids = createdBody.data.map((r) => r.id);

    const guardA = 'g_' + 'a'.repeat(64);
    const guardB = 'g_' + 'b'.repeat(64);

    const promote = await app.request('/records/promote-guards', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, 'x-collection': 'mood' },
      body: JSON.stringify({
        sid,
        promotions: [
          { id: ids[0], guard: guardA },
          { id: ids[1], guard: guardB },
        ],
      }),
    });
    expect(promote.status).toBe(200);
    expect((await promote.json()) as { promoted: number }).toEqual({ promoted: 2 });

    // The new guard is the only valid X-Guard for subsequent PATCH.
    const goodPatch = await app.request(`/records/${ids[0]}`, {
      method: 'PATCH',
      headers: authHeaders(cookie, sid, 'mood', guardA),
      body: JSON.stringify({ cipherIv: 'iv-a2' }),
    });
    expect(goodPatch.status).toBe(200);

    // Old "init" guard no longer works on a promoted row.
    const staleInit = await app.request(`/records/${ids[1]}`, {
      method: 'PATCH',
      headers: authHeaders(cookie, sid, 'mood', 'init'),
      body: JSON.stringify({ cipherIv: 'iv-b2' }),
    });
    expect(staleInit.status).toBe(403);
  });

  it('promote-guards rejects an already-promoted row with 400', async () => {
    const cookie = await authFor('bulkC@example.com');
    const sid = 'sid-bulkC';

    const created = await app.request('/records/bulk', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, 'x-collection': 'mood' },
      body: JSON.stringify({
        sid,
        entries: [{ cipherIv: 'iv', payload: 'p' }],
      }),
    });
    const { data } = (await created.json()) as { data: Array<{ id: string }> };
    const id = data[0]!.id;

    // First promote: ok.
    const guard1 = 'g_' + '1'.repeat(64);
    const first = await app.request('/records/promote-guards', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, 'x-collection': 'mood' },
      body: JSON.stringify({ sid, promotions: [{ id, guard: guard1 }] }),
    });
    expect(first.status).toBe(200);

    // Second attempt: already promoted → 400 + transaction NOT applied.
    const guard2 = 'g_' + '2'.repeat(64);
    const second = await app.request('/records/promote-guards', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, 'x-collection': 'mood' },
      body: JSON.stringify({ sid, promotions: [{ id, guard: guard2 }] }),
    });
    expect(second.status).toBe(400);
    const err = (await second.json()) as { error: string };
    expect(err.error).toBe('guard_already_promoted');

    // PATCH with the original promoted guard still works — the second
    // promote-guards left no trace.
    const stillWorks = await app.request(`/records/${id}`, {
      method: 'PATCH',
      headers: authHeaders(cookie, sid, 'mood', guard1),
      body: JSON.stringify({ cipherIv: 'iv2' }),
    });
    expect(stillWorks.status).toBe(200);
  });

  it('promote-guards returns 404 when one of the ids doesn’t exist under the sid', async () => {
    const cookie = await authFor('bulkD@example.com');
    const sid = 'sid-bulkD';

    const created = await app.request('/records/bulk', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, 'x-collection': 'mood' },
      body: JSON.stringify({ sid, entries: [{ cipherIv: 'iv', payload: 'p' }] }),
    });
    const { data } = (await created.json()) as { data: Array<{ id: string }> };

    const guard = 'g_' + 'f'.repeat(64);
    const res = await app.request('/records/promote-guards', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, 'x-collection': 'mood' },
      body: JSON.stringify({
        sid,
        promotions: [
          { id: data[0]!.id, guard },
          { id: 'not-a-real-id', guard },
        ],
      }),
    });
    expect(res.status).toBe(404);
  });

  it('promote-guards rejects a body with duplicate ids', async () => {
    const cookie = await authFor('bulkE@example.com');
    const sid = 'sid-bulkE';

    const created = await app.request('/records/bulk', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, 'x-collection': 'mood' },
      body: JSON.stringify({ sid, entries: [{ cipherIv: 'iv', payload: 'p' }] }),
    });
    const { data } = (await created.json()) as { data: Array<{ id: string }> };
    const id = data[0]!.id;
    const guard = 'g_' + '9'.repeat(64);

    const res = await app.request('/records/promote-guards', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, 'x-collection': 'mood' },
      body: JSON.stringify({
        sid,
        promotions: [{ id, guard }, { id, guard }],
      }),
    });
    expect(res.status).toBe(400);
  });

  it('bulk POST rejects bodies past BULK_MAX_ENTRIES', async () => {
    const cookie = await authFor('bulkF@example.com');
    const sid = 'sid-bulkF';
    const entries = Array.from({ length: 101 }, (_, i) => ({
      cipherIv: 'iv-' + i,
      payload: 'p',
    }));
    const res = await app.request('/records/bulk', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, 'x-collection': 'mood' },
      body: JSON.stringify({ sid, entries }),
    });
    expect(res.status).toBe(400);
  });

  it('bulk POST returns `bulk_payload_too_large` when aggregate size exceeds the cap', async () => {
    // Three entries at 6 MB each pass the per-entry 8 MB cap but
    // aggregate to 18 MB, above the 16 MB bulk cap. The handler must
    // distinguish this from a generic `invalid_body` so a client can
    // react (split into smaller chunks + retry).
    const cookie = await authFor('bulkG@example.com');
    const sid = 'sid-bulkG';
    const big = 'A'.repeat(6 * 1024 * 1024);
    const entries = [
      { cipherIv: 'iv-1', payload: big },
      { cipherIv: 'iv-2', payload: big },
      { cipherIv: 'iv-3', payload: big },
    ];
    const res = await app.request('/records/bulk', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, 'x-collection': 'mood' },
      body: JSON.stringify({ sid, entries }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('bulk_payload_too_large');
  });

  it('bulk POST and promote-guards both require authentication', async () => {
    const noAuthBulk = await app.request('/records/bulk', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-collection': 'mood' },
      body: JSON.stringify({ sid: 's', entries: [{ cipherIv: 'i', payload: 'p' }] }),
    });
    expect(noAuthBulk.status).toBe(401);

    const noAuthPromote = await app.request('/records/promote-guards', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-collection': 'mood' },
      body: JSON.stringify({
        sid: 's',
        promotions: [{ id: 'x', guard: 'g_' + '0'.repeat(64) }],
      }),
    });
    expect(noAuthPromote.status).toBe(401);
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
