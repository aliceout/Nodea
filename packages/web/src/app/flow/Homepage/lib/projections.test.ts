import { describe, expect, it } from 'vitest';
import type {
  GoalsPayload,
  LibraryItemPayload,
  MoodPayload,
} from '@nodea/shared';

import type { DecryptedRecord } from '@/core/api/modules/collection-client';

import {
  projectGoalEntries,
  projectLibraryReadings,
  projectMoodEntries,
} from './projections';

function moodRecord(
  id: string,
  payload: Partial<MoodPayload>,
): DecryptedRecord<MoodPayload> {
  return {
    id,
    moduleUserId: 'sid-x',
    payload: {
      date: '',
      moodScore: '0',
      moodEmoji: '',
      positive1: '',
      positive2: '',
      positive3: '',
      comment: '',
      ...payload,
    } as MoodPayload,
  };
}

function goalRecord(
  id: string,
  payload: Partial<GoalsPayload>,
): DecryptedRecord<GoalsPayload> {
  return {
    id,
    moduleUserId: 'sid-x',
    payload: {
      date: '',
      title: '',
      note: '',
      status: 'open',
      thread: '',
      completedAt: null,
      updatedAt: '2026-03-15T00:00:00Z',
      ...payload,
    } as GoalsPayload,
  };
}

function libraryRecord(
  id: string,
  payload: Partial<LibraryItemPayload>,
): DecryptedRecord<LibraryItemPayload> {
  return {
    id,
    moduleUserId: 'sid-x',
    payload: { title: 'x', ...payload } as LibraryItemPayload,
  };
}

describe('projectMoodEntries', () => {
  it('keeps records with a valid date and a canonical score', () => {
    const out = projectMoodEntries([
      moodRecord('a', { date: '2026-03-15', moodScore: '2' }),
      moodRecord('b', { date: '2026-03-14T08:42:00Z', moodScore: '-1' }),
    ]);
    expect(out).toEqual([
      { dateIso: '2026-03-15', score: '2', createdAt: '2026-03-15' },
      { dateIso: '2026-03-14', score: '-1', createdAt: '2026-03-14' },
    ]);
  });

  it('drops records with a missing or malformed date', () => {
    const out = projectMoodEntries([
      moodRecord('a', { date: '', moodScore: '0' }),
      moodRecord('b', { date: 'garbage', moodScore: '0' }),
      moodRecord('c', { date: '15/03/2026', moodScore: '0' }),
    ]);
    expect(out).toEqual([]);
  });

  it('drops records with an unexpected mood score', () => {
    const out = projectMoodEntries([
      moodRecord('a', { date: '2026-03-15', moodScore: '99' }),
      moodRecord('b', { date: '2026-03-14', moodScore: 'neutre' }),
    ]);
    expect(out).toEqual([]);
  });
});

describe('projectGoalEntries', () => {
  it('maps legacy `active` → `open` and `archived` → `done`', () => {
    const out = projectGoalEntries([
      goalRecord('a', { title: 'A', status: 'active' as never }),
      goalRecord('b', { title: 'B', status: 'archived' as never }),
    ]);
    expect(out.map((g) => g.status)).toEqual(['open', 'done']);
  });

  it('drops records with an empty title', () => {
    const out = projectGoalEntries([
      goalRecord('a', { title: '   ' }),
      goalRecord('b', { title: '' }),
    ]);
    expect(out).toEqual([]);
  });

  it('passes through canonical statuses', () => {
    const out = projectGoalEntries([
      goalRecord('a', { title: 'A', status: 'open' }),
      goalRecord('b', { title: 'B', status: 'wip' }),
      goalRecord('c', { title: 'C', status: 'done' }),
    ]);
    expect(out.map((g) => g.status)).toEqual(['open', 'wip', 'done']);
  });

  it('preserves id, thread and updatedAt', () => {
    const out = projectGoalEntries([
      goalRecord('rec-1', {
        title: 'Hello',
        thread: '#alpha,#beta',
        updatedAt: '2026-04-01T00:00:00Z',
      }),
    ]);
    expect(out[0]).toMatchObject({
      id: 'rec-1',
      title: 'Hello',
      thread: '#alpha,#beta',
      updatedAt: '2026-04-01T00:00:00Z',
    });
  });
});

describe('projectLibraryReadings', () => {
  it('keeps only items with status === in_progress', () => {
    const out = projectLibraryReadings([
      libraryRecord('a', { title: 'A', status: 'in_progress' }),
      libraryRecord('b', { title: 'B', status: 'finished' }),
      libraryRecord('c', { title: 'C', status: 'planned' }),
    ]);
    expect(out.map((r) => r.id)).toEqual(['a']);
  });

  it('drops items with an empty title', () => {
    const out = projectLibraryReadings([
      libraryRecord('a', { title: '   ', status: 'in_progress' }),
    ]);
    expect(out).toEqual([]);
  });

  it('joins author creators (and accepts un-roled creators)', () => {
    const out = projectLibraryReadings([
      libraryRecord('a', {
        title: 'Slow Productivity',
        status: 'in_progress',
        creators: [
          { name: 'Cal Newport', role: 'author' },
          { name: 'Translator', role: 'translator' },
          { name: '  Editor  ', role: undefined as never },
        ],
      } as Partial<LibraryItemPayload>),
    ]);
    expect(out[0]?.author).toBe('Cal Newport, Editor');
  });

  it('defaults isFavorite to false', () => {
    const out = projectLibraryReadings([
      libraryRecord('a', { title: 'A', status: 'in_progress' }),
      libraryRecord('b', {
        title: 'B',
        status: 'in_progress',
        isFavorite: true,
      }),
    ]);
    expect(out[0]?.isFavorite).toBe(false);
    expect(out[1]?.isFavorite).toBe(true);
  });
});
