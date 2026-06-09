import { describe, it, expect } from 'vitest';
import type { MoodPayload } from '@nodea/shared';

import type { DecryptedRecord } from '@/core/api/modules/collection-client';

import { normalizeScore, recordToEntry } from './mappers';

const TODAY = new Date(2026, 2, 15); // 15 mars 2026

describe('normalizeScore', () => {
  it('passes canonical values through', () => {
    expect(normalizeScore('-2')).toBe('-2');
    expect(normalizeScore('-1')).toBe('-1');
    expect(normalizeScore('0')).toBe('0');
    expect(normalizeScore('1')).toBe('1');
    expect(normalizeScore('2')).toBe('2');
  });

  it('maps legacy 0..10 onto -2..+2 linearly', () => {
    expect(normalizeScore('0')).toBe('0'); // canonical wins
    expect(normalizeScore('5')).toBe('0'); // mid scale → neutral
    expect(normalizeScore('10')).toBe('2'); // top → very good
    expect(normalizeScore('3')).toBe('-1'); // 3 → (3-5)/2.5 ≈ -0.8 → -1
    expect(normalizeScore('8')).toBe('1'); // 8 → (8-5)/2.5 = 1.2 → 1
  });

  it('clamps out-of-range numerics to -2..+2', () => {
    expect(normalizeScore('100')).toBe('2');
    expect(normalizeScore('-100')).toBe('-2');
  });

  it('falls back to 0 on non-finite input', () => {
    expect(normalizeScore('not-a-number')).toBe('0');
  });

  it("treats empty string as legacy 0 → -2 (Number('') is 0, not NaN)", () => {
    // Documented quirk : '' coerces to 0 numerically and falls
    // into the 0..10 → −2..+2 mapping, which sends 0 to the
    // bottom of the scale. A future cleanup that wants `''` →
    // `'0'` should add an explicit empty-string short-circuit.
    expect(normalizeScore('')).toBe('-2');
  });
});

describe('recordToEntry', () => {
  const LABELS = {
    language: 'fr',
    todayLabel: 'Aujourd’hui',
    yesterdayLabel: 'Hier',
  };

  function record(payload: Partial<MoodPayload>): DecryptedRecord<MoodPayload> {
    return {
      id: 'rec-1',
      moduleUserId: 'sid-x',
      payload: payload as MoodPayload,
    };
  }

  it('flattens id + canonical fields with positives tuple', () => {
    const out = recordToEntry(
      record({
        date: '2026-03-12',
        moodScore: '1',
        positive1: 'a',
        positive2: 'b',
        positive3: 'c',
      }),
      TODAY,
      LABELS,
    );
    expect(out.id).toBe('rec-1');
    expect(out.dateIso).toBe('2026-03-12');
    expect(out.score).toBe('1');
    expect(out.positives).toEqual(['a', 'b', 'c']);
  });

  it('falls back to LOCAL today when payload date is missing or malformed', () => {
    // Local calendar date, NOT `toISOString()` (UTC) — east of UTC
    // after midnight the UTC slice reads yesterday (audit 2026-06 ;
    // the previous expectation reproduced that very bug).
    const todayIso = '2026-03-15';
    expect(
      recordToEntry(record({ moodScore: '0' }), TODAY, LABELS).dateIso,
    ).toBe(todayIso);
    expect(
      recordToEntry(record({ date: 'garbage', moodScore: '0' }), TODAY, LABELS)
        .dateIso,
    ).toBe(todayIso);
  });

  it('omits empty optional fields (comment / question / answer)', () => {
    const out = recordToEntry(
      record({ date: '2026-03-12', moodScore: '0', comment: '   ' }),
      TODAY,
      LABELS,
    );
    expect(out).not.toHaveProperty('comment');
    expect(out).not.toHaveProperty('question');
    expect(out).not.toHaveProperty('answer');
  });

  it('keeps non-empty optional fields', () => {
    const out = recordToEntry(
      record({
        date: '2026-03-12',
        moodScore: '0',
        comment: 'tired',
        question: 'q?',
        answer: 'yes',
      }),
      TODAY,
      LABELS,
    );
    expect(out.comment).toBe('tired');
    expect(out.question).toBe('q?');
    expect(out.answer).toBe('yes');
  });
});
