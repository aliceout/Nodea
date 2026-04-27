import { describe, it, expect } from 'vitest';
import { webcrypto } from 'node:crypto';
import { buildApp } from '../app.ts';
import { TEST_PASSWORD, loginAs, seedUser } from './helpers.ts';
import {
  simDeriveMainKeys,
  simEncryptPayload,
  simDecryptPayload,
  simDeriveGuard,
} from './client-simulator.ts';
import type {
  MoodPayload,
  GoalsPayload,
  PassagePayload,
  HabitsItemPayload,
  HabitsLogPayload,
  LibraryItemPayload,
  LibraryReviewPayload,
  ReviewPayload,
} from '@nodea/shared';

const app = buildApp();

async function authCookie(email: string): Promise<string> {
  await seedUser(email);
  return loginAs(app, email, TEST_PASSWORD);
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
      status: 'open',
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
    expect(got.status).toBe('open');
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

// ---------------------------------------------------------------------
// Phase 7 — Habits / Library / Review
// ---------------------------------------------------------------------

describe('Habits — items and logs encrypted round-trip', () => {
  it('creates an item, logs two occurrences, lists them decrypted', async () => {
    const cookie = await authCookie('habits@example.com');
    const keys = await freshMainKeys();
    const itemSid = 'sid-habits-items';
    const logSid = 'sid-habits-logs';

    const itemPayload: HabitsItemPayload = {
      title: 'Tennis',
      category: 'sport',
      frequency: 'weekly',
      target: 1,
      started_at: '2025-08-01',
      archived: false,
    };
    const item = await createPromoted(cookie, 'habits-items', keys, itemSid, itemPayload);

    const log1: HabitsLogPayload = { date: '2025-08-05', item_rid: item.id, done: true };
    const log2: HabitsLogPayload = { date: '2025-08-12', item_rid: item.id, done: true };
    await createPromoted(cookie, 'habits-logs', keys, logSid, log1);
    await createPromoted(cookie, 'habits-logs', keys, logSid, log2);

    const listRes = await app.request(`/habits-logs/records?sid=${logSid}`, { headers: { cookie } });
    const list = (await listRes.json()) as { records: RawRecord[] };
    expect(list.records).toHaveLength(2);

    const decrypted = await Promise.all(
      list.records.map((r) =>
        simDecryptPayload<HabitsLogPayload>(keys.aesKey, r.cipher_iv, r.payload),
      ),
    );
    const dates = decrypted.map((d) => d.date).sort();
    expect(dates).toEqual(['2025-08-05', '2025-08-12']);
    expect(decrypted.every((d) => d.item_rid === item.id)).toBe(true);
  });
});

describe('Library — items and reviews encrypted round-trip', () => {
  it('creates a book + two reading notes, lists them decrypted', async () => {
    const cookie = await authCookie('library@example.com');
    const keys = await freshMainKeys();
    const itemSid = 'sid-library-items';
    const reviewSid = 'sid-library-reviews';

    const book: LibraryItemPayload = {
      type: 'book',
      title: 'Exemple de livre',
      providers: { openlibrary: 'OL123M' },
      creators: [{ name: 'Inconnue AUTRICE', role: 'author' }],
      year: 2022,
      language: 'fr',
      status: 'in_progress',
      format: 'paper',
      cover_rid: null,
      started_at: null,
      finished_at: null,
      current_page: null,
      rating: null,
      tags: ['roman'],
      is_favorite: false,
    };
    const item = await createPromoted(cookie, 'library-items', keys, itemSid, book);

    const r1: LibraryReviewPayload = {
      item_rid: item.id,
      date: '2025-08-20',
      kind: 'quote',
      title: null,
      content: 'Passage marquant',
      page: 54,
      spoiler: false,
    };
    const r2: LibraryReviewPayload = {
      item_rid: item.id,
      date: '2025-08-22',
      kind: 'note',
      title: null,
      content: 'Fin du livre, super conclusion.',
      page: null,
      spoiler: false,
    };
    await createPromoted(cookie, 'library-reviews', keys, reviewSid, r1);
    await createPromoted(cookie, 'library-reviews', keys, reviewSid, r2);

    const listRes = await app.request(`/library-reviews/records?sid=${reviewSid}`, {
      headers: { cookie },
    });
    const list = (await listRes.json()) as { records: RawRecord[] };
    expect(list.records).toHaveLength(2);
    const notes = await Promise.all(
      list.records.map((r) =>
        simDecryptPayload<LibraryReviewPayload>(keys.aesKey, r.cipher_iv, r.payload),
      ),
    );
    const byDate = notes.sort((a, b) => a.date.localeCompare(b.date));
    expect(byDate[0]!.page).toBe(54);
    expect(byDate[0]!.kind).toBe('quote');
    expect(byDate[1]!.content).toMatch(/conclusion/);
    expect(byDate[1]!.kind).toBe('note');
  });
});

describe('Review — yearly deep payload encrypted round-trip', () => {
  it('creates and retrieves a full YearCompass-shape payload', async () => {
    const cookie = await authCookie('review@example.com');
    const keys = await freshMainKeys();
    const sid = 'sid-review-2025';

    const payload: ReviewPayload = {
      year: 2025,
      last_year: {
        agenda_review: ['séjour à Tana', 'départ mission'],
        life_areas: {
          family: ['plus proche de ma sœur'],
          work: ['terminé un projet'],
        },
        best_moments: ['soirée plage'],
        three_challenges: ['burnout'],
      },
      next_year: {
        dream_big: 'poste qui me correspond',
        word_of_year: 'ancrage',
      },
      closing: {
        letter_to_self: 'courage pour toi future Alice…',
        signature: 'Alice',
        date: '2025-08-25',
      },
    };

    await createPromoted(cookie, 'review', keys, sid, payload);

    const listRes = await app.request(`/review/records?sid=${sid}`, { headers: { cookie } });
    const list = (await listRes.json()) as { records: RawRecord[] };
    expect(list.records).toHaveLength(1);
    const got = await simDecryptPayload<ReviewPayload>(
      keys.aesKey,
      list.records[0]!.cipher_iv,
      list.records[0]!.payload,
    );
    expect(got.year).toBe(2025);
    expect(got.next_year).toBeDefined();
    const nextYear = got.next_year as Record<string, unknown>;
    expect(nextYear.word_of_year).toBe('ancrage');
  });
});
