import { describe, it, expect } from 'vitest';

import { computeStats, countWords, isoDay } from './stats';
import type { JournalEntry } from './types';

function fixture(partial: Partial<JournalEntry> & { id: string }): JournalEntry {
  return {
    dateIso: '',
    dateLabel: '',
    thread: '',
    title: null,
    content: '',
    attachments: [],
    searchHaystack: '',
    ...partial,
  };
}

const TODAY = new Date(2026, 2, 15); // 15 mars 2026

describe('countWords', () => {
  it('counts whitespace-separated tokens', () => {
    expect(countWords('hello world')).toBe(2);
    expect(countWords('un  deux   trois')).toBe(3);
  });

  it('returns 0 for empty / whitespace-only strings', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   \n\t  ')).toBe(0);
  });

  it('treats punctuation as part of a word', () => {
    expect(countWords("c'était bien.")).toBe(2);
  });
});

describe('isoDay', () => {
  it('formats a Date as YYYY-MM-DD with zero-padding', () => {
    expect(isoDay(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(isoDay(new Date(2024, 11, 31))).toBe('2024-12-31');
  });
});

describe('computeStats', () => {
  it('returns zeros for an empty list', () => {
    const s = computeStats([], TODAY);
    expect(s.totalEntries).toBe(0);
    expect(s.totalWords).toBe(0);
    expect(s.streakDays).toBe(0);
    expect(s.streakIncludesToday).toBe(false);
  });

  it('sums words across content + title for each entry', () => {
    const entries = [
      fixture({
        id: '1',
        dateIso: '2026-03-15',
        title: 'Hello world',
        content: 'one two three',
      }),
      fixture({ id: '2', dateIso: '2026-03-14', content: 'four five' }),
    ];
    const s = computeStats(entries, TODAY);
    // Entry 1 : 'Hello world' (2) + 'one two three' (3) = 5
    // Entry 2 : '' (0) + 'four five' (2) = 2
    expect(s.totalWords).toBe(7);
    expect(s.totalEntries).toBe(2);
  });

  it('counts a streak that ends today', () => {
    const entries = [
      fixture({ id: '1', dateIso: '2026-03-15', content: 'a' }),
      fixture({ id: '2', dateIso: '2026-03-14', content: 'b' }),
      fixture({ id: '3', dateIso: '2026-03-13', content: 'c' }),
    ];
    const s = computeStats(entries, TODAY);
    expect(s.streakDays).toBe(3);
    expect(s.streakIncludesToday).toBe(true);
  });

  it('counts a streak that ends yesterday (today not yet written)', () => {
    const entries = [
      fixture({ id: '1', dateIso: '2026-03-14', content: 'a' }),
      fixture({ id: '2', dateIso: '2026-03-13', content: 'b' }),
    ];
    const s = computeStats(entries, TODAY);
    expect(s.streakDays).toBe(2);
    expect(s.streakIncludesToday).toBe(false);
  });

  it('returns 0 when there is no entry for today nor yesterday', () => {
    const entries = [
      fixture({ id: '1', dateIso: '2026-03-10', content: 'a' }),
      fixture({ id: '2', dateIso: '2026-03-09', content: 'b' }),
    ];
    const s = computeStats(entries, TODAY);
    expect(s.streakDays).toBe(0);
    expect(s.streakIncludesToday).toBe(false);
  });

  it('breaks the streak on a missing day mid-run', () => {
    const entries = [
      fixture({ id: '1', dateIso: '2026-03-15', content: 'a' }),
      fixture({ id: '2', dateIso: '2026-03-14', content: 'b' }),
      // gap on 2026-03-13
      fixture({ id: '3', dateIso: '2026-03-12', content: 'c' }),
    ];
    const s = computeStats(entries, TODAY);
    expect(s.streakDays).toBe(2);
  });
});
