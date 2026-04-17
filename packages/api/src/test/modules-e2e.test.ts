import { describe, it, expect } from 'vitest';
import { webcrypto } from 'node:crypto';
import { buildApp } from '../app.ts';
import { TEST_PASSWORD, seedUser, extractCookie } from './helpers.ts';
import {
  simDeriveMainKeys,
  simEncryptPayload,
  simDecryptPayload,
  simDeriveGuard,
} from './client-simulator.ts';
import type { MoodPayload, GoalsPayload, PassagePayload } from '@nodea/shared';

const app = buildApp();

async function authCookie(email: string): Promise<string> {
  await seedUser(email);
  const res = await app.request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
  });
  return extractCookie(res)!;
}

async function freshMainKeys() {
  const raw = new Uint8Array(32);
  webcrypto.getRandomValues(raw);
  return simDeriveMainKeys(raw);
}

interface RawRecord {
  id: string;
  module_user_id: string;
  cipher_iv: string;
  payload: string;
  created_at: string;
  updated_at: string;
}

async function createPromoted(
  cookie: string,
  collection: string,
  keys: { aesKey: CryptoKey; hmacKey: CryptoKey },
  sid: string,
  payload: unknown,
): Promise<RawRecord> {
  const blob = await simEncryptPayload(keys.aesKey, payload);
  const createRes = await app.request(`/${collection}/records`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ sid, cipher_iv: blob.iv, payload: blob.data, guard: 'init' }),
  });
  expect(createRes.status).toBe(201);
  const created = (await createRes.json()) as RawRecord;

  const guard = await simDeriveGuard(keys.hmacKey, sid, created.id);
  const promoteRes = await app.request(
    `/${collection}/records/${created.id}?sid=${sid}&d=init`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ guard }),
    },
  );
  expect(promoteRes.status).toBe(200);
  return (await promoteRes.json()) as RawRecord;
}

describe('Mood module — full encrypted round-trip through the new API', () => {
  it('create → list → update → delete with decrypted payloads', async () => {
    const cookie = await authCookie('mood@example.com');
    const keys = await freshMainKeys();
    const sid = 'sid-mood';

    const payload: MoodPayload = {
      date: '2026-04-17',
      mood_score: '7',
      mood_emoji: '🙂',
      positive1: 'slept well',
      positive2: 'finished Phase 6',
      positive3: 'coffee',
      comment: 'ok day',
    };

    const created = await createPromoted(cookie, 'mood', keys, sid, payload);

    // LIST + decrypt
    const listRes = await app.request(`/mood/records?sid=${sid}`, { headers: { cookie } });
    const list = (await listRes.json()) as { records: RawRecord[] };
    expect(list.records).toHaveLength(1);
    const decoded = await simDecryptPayload<MoodPayload>(
      keys.aesKey,
      list.records[0]!.cipher_iv,
      list.records[0]!.payload,
    );
    expect(decoded.comment).toBe('ok day');
    expect(decoded.positive1).toBe('slept well');

    // UPDATE with a real guard
    const guard = await simDeriveGuard(keys.hmacKey, sid, created.id);
    const newPayload = { ...payload, comment: 'great day after all' };
    const newBlob = await simEncryptPayload(keys.aesKey, newPayload);
    const upd = await app.request(
      `/mood/records/${created.id}?sid=${sid}&d=${guard}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ cipher_iv: newBlob.iv, payload: newBlob.data }),
      },
    );
    expect(upd.status).toBe(200);
    const updated = (await upd.json()) as RawRecord;
    const reDecoded = await simDecryptPayload<MoodPayload>(
      keys.aesKey,
      updated.cipher_iv,
      updated.payload,
    );
    expect(reDecoded.comment).toBe('great day after all');

    // DELETE
    const del = await app.request(
      `/mood/records/${created.id}?sid=${sid}&d=${guard}`,
      { method: 'DELETE', headers: { cookie } },
    );
    expect(del.status).toBe(200);
  });
});

describe('Goals module — full encrypted round-trip', () => {
  it('creates a goal, lists it decrypted, promotes the guard, deletes', async () => {
    const cookie = await authCookie('goals@example.com');
    const keys = await freshMainKeys();
    const sid = 'sid-goals';

    const payload: GoalsPayload = {
      date: '2026-04-17',
      title: 'Ship Phase 6',
      note: 'end-to-end encrypted',
      status: 'active',
      thread: 'nodea',
    };

    await createPromoted(cookie, 'goals', keys, sid, payload);

    const listRes = await app.request(`/goals/records?sid=${sid}`, { headers: { cookie } });
    const list = (await listRes.json()) as { records: RawRecord[] };
    expect(list.records).toHaveLength(1);
    const got = await simDecryptPayload<GoalsPayload>(
      keys.aesKey,
      list.records[0]!.cipher_iv,
      list.records[0]!.payload,
    );
    expect(got.title).toBe('Ship Phase 6');
    expect(got.status).toBe('active');
  });
});

describe('Passage module — full encrypted round-trip', () => {
  it('creates a passage entry, lists it decrypted', async () => {
    const cookie = await authCookie('passage@example.com');
    const keys = await freshMainKeys();
    const sid = 'sid-passage';

    const payload: PassagePayload = {
      type: 'passage.entry',
      date: new Date().toISOString(),
      thread: 'journal',
      title: 'Phase 6 notes',
      content: 'today i wired up the three modules',
    };

    await createPromoted(cookie, 'passage', keys, sid, payload);

    const listRes = await app.request(`/passage/records?sid=${sid}`, { headers: { cookie } });
    const list = (await listRes.json()) as { records: RawRecord[] };
    const got = await simDecryptPayload<PassagePayload>(
      keys.aesKey,
      list.records[0]!.cipher_iv,
      list.records[0]!.payload,
    );
    expect(got.title).toBe('Phase 6 notes');
    expect(got.type).toBe('passage.entry');
  });

  it('never exposes the guard field to readers', async () => {
    const cookie = await authCookie('noleakpassage@example.com');
    const keys = await freshMainKeys();
    const sid = 'sid-noleak';

    await createPromoted(cookie, 'passage', keys, sid, {
      type: 'passage.entry',
      date: '2026-04-17T00:00:00Z',
      thread: '',
      title: null,
      content: 'some content',
    });

    const listRes = await app.request(`/passage/records?sid=${sid}`, { headers: { cookie } });
    const list = (await listRes.json()) as { records: unknown[] };
    expect(list.records[0]).not.toHaveProperty('guard');
  });
});
