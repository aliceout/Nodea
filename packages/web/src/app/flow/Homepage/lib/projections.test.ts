import { describe, expect, it } from 'vitest';
import type {
  GoalsPayload,
  MoodPayload,
} from '@nodea/shared';

import type { DecryptedRecord } from '@/core/api/modules/collection-client';

import {
  projectGoalEntries,
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

  it('converts legacy / out-of-range scores onto −2..+2 instead of dropping them', () => {
    // Same normalizeScore the Mood page uses, so migrated 0..10 entries
    // stay consistent between the home frise/average and the Mood page.
    const out = projectMoodEntries([
      moodRecord('a', { date: '2026-03-15', moodScore: '7' }), // legacy 0..10 → 1
      moodRecord('b', { date: '2026-03-14', moodScore: '99' }), // out of range → clamps to 2
      moodRecord('c', { date: '2026-03-13', moodScore: 'neutre' }), // non-finite → 0
    ]);
    expect(out).toEqual([
      { dateIso: '2026-03-15', score: '1', createdAt: '2026-03-15' },
      { dateIso: '2026-03-14', score: '2', createdAt: '2026-03-14' },
      { dateIso: '2026-03-13', score: '0', createdAt: '2026-03-13' },
    ]);
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

