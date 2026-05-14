import { describe, expect, it } from 'vitest';

import {
  aggregateByDay,
  buildIntensityLookup,
  densityToIntensity,
} from './day-density';
import type { JournalEntry } from './types';

function entry(
  dateIso: string,
  content: string,
  opts: { title?: string | null } = {},
): JournalEntry {
  return {
    id: `${dateIso}-${content.length}`,
    dateIso,
    dateLabel: dateIso,
    thread: 'default',
    title: opts.title ?? null,
    content,
    attachments: [],
  };
}

describe('aggregateByDay', () => {
  it('returns an empty Map for an empty list', () => {
    expect(aggregateByDay([])).toEqual(new Map());
  });

  it('counts entries per ISO day and sums words across title + content', () => {
    const entries = [
      entry('2026-05-14', 'three words here', { title: 'Title' }),
      entry('2026-05-14', 'two more'),
      entry('2026-05-13', 'one'),
    ];
    const out = aggregateByDay(entries);
    expect(out.get('2026-05-14')).toEqual({
      count: 2,
      // 'Title three words here' = 4 + 'two more' = 2 = 6
      words: 6,
    });
    expect(out.get('2026-05-13')).toEqual({ count: 1, words: 1 });
  });

  it('ignores entries with a malformed dateIso', () => {
    const entries = [
      entry('2026-05-14', 'good'),
      entry('not-a-date', 'bad'),
      entry('2024-', 'truncated'),
    ];
    const out = aggregateByDay(entries);
    expect(out.size).toBe(1);
    expect(out.get('2026-05-14')!.count).toBe(1);
  });

  it('handles full-ISO timestamps by slicing to YYYY-MM-DD', () => {
    const entries = [
      entry('2026-05-14T08:30:00.000Z', 'morning'),
      entry('2026-05-14T20:00:00.000Z', 'evening'),
    ];
    const out = aggregateByDay(entries);
    expect(out.get('2026-05-14')).toEqual({ count: 2, words: 2 });
  });
});

describe('densityToIntensity', () => {
  it('returns 0 for undefined or empty days', () => {
    expect(densityToIntensity(undefined)).toBe(0);
    expect(densityToIntensity({ count: 0, words: 0 })).toBe(0);
  });

  it('buckets by word count, not entry count', () => {
    // 5 short one-liners (5 × 10 words) lands in the same bucket
    // as 1 short entry of 50 words.
    expect(densityToIntensity({ count: 5, words: 50 })).toBe(2);
    expect(densityToIntensity({ count: 1, words: 1200 })).toBe(4);
  });

  it('walks the 4 thresholds at 1 / 30 / 80 / 200 words', () => {
    expect(densityToIntensity({ count: 1, words: 1 })).toBe(1);
    expect(densityToIntensity({ count: 1, words: 29 })).toBe(1);
    expect(densityToIntensity({ count: 1, words: 30 })).toBe(2);
    expect(densityToIntensity({ count: 1, words: 79 })).toBe(2);
    expect(densityToIntensity({ count: 1, words: 80 })).toBe(3);
    expect(densityToIntensity({ count: 1, words: 199 })).toBe(3);
    expect(densityToIntensity({ count: 1, words: 200 })).toBe(4);
  });
});

describe('buildIntensityLookup', () => {
  it('returns a function that maps Date → 0..4 via the same buckets', () => {
    const entries = [
      entry('2026-05-14', new Array(150).fill('a').join(' ')), // 150 words → 3
      entry('2026-05-13', 'short note'), // 2 words → 1
    ];
    const lookup = buildIntensityLookup(entries);
    expect(lookup(new Date(2026, 4, 14))).toBe(3);
    expect(lookup(new Date(2026, 4, 13))).toBe(1);
    expect(lookup(new Date(2026, 4, 12))).toBe(0);
  });
});
