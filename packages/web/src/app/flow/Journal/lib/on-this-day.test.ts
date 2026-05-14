import { describe, expect, it } from 'vitest';

import { formatMonthDay, pickOnThisDay, yearsAgo } from './on-this-day';
import type { JournalEntry } from './types';

function entry(dateIso: string, title = 'x'): JournalEntry {
  return {
    id: dateIso,
    dateIso,
    dateLabel: dateIso,
    thread: 'default',
    title,
    content: 'body',
    attachments: [],
  };
}

describe('formatMonthDay', () => {
  it('zero-pads month and day', () => {
    expect(formatMonthDay(new Date(2026, 0, 5))).toBe('01-05');
    expect(formatMonthDay(new Date(2024, 11, 31))).toBe('12-31');
    expect(formatMonthDay(new Date(2025, 6, 1))).toBe('07-01');
  });
});

describe('pickOnThisDay', () => {
  const today = new Date(2026, 4, 14); // 2026-05-14

  it('returns earlier-year entries matching today MM-DD, newest first', () => {
    const entries = [
      entry('2026-05-14T08:00:00', 'today should be excluded'),
      entry('2025-05-14', 'one year ago'),
      entry('2024-05-14', 'two years ago'),
      entry('2023-05-14', 'three years ago'),
      entry('2022-05-13', 'wrong day'),
      entry('2022-06-14', 'wrong month'),
    ];
    const out = pickOnThisDay(entries, today);
    expect(out.map((e) => e.title)).toEqual([
      'one year ago',
      'two years ago',
      'three years ago',
    ]);
  });

  it('excludes today, even when today\'s entry shares the same MM-DD', () => {
    const entries = [
      entry('2026-05-14', 'today'),
      entry('2025-05-14', 'last year'),
    ];
    const out = pickOnThisDay(entries, today);
    expect(out.map((e) => e.dateIso)).toEqual(['2025-05-14']);
  });

  it('respects the default limit of 3', () => {
    const entries = [
      entry('2025-05-14'),
      entry('2024-05-14'),
      entry('2023-05-14'),
      entry('2022-05-14'),
      entry('2021-05-14'),
    ];
    const out = pickOnThisDay(entries, today);
    expect(out).toHaveLength(3);
    expect(out[0]!.dateIso).toBe('2025-05-14');
    expect(out[2]!.dateIso).toBe('2023-05-14');
  });

  it('honours a custom limit', () => {
    const entries = [entry('2025-05-14'), entry('2024-05-14')];
    expect(pickOnThisDay(entries, today, 1)).toHaveLength(1);
    expect(pickOnThisDay(entries, today, 5)).toHaveLength(2);
  });

  it('returns empty when nothing matches today MM-DD', () => {
    const entries = [entry('2025-06-15'), entry('2024-01-01')];
    expect(pickOnThisDay(entries, today)).toEqual([]);
  });

  it('ignores malformed dateIso strings without throwing', () => {
    const entries = [
      entry('2025-05-14', 'good'),
      entry('not-a-date', 'bad'),
      entry('2024-', 'truncated'),
    ];
    const out = pickOnThisDay(entries, today);
    expect(out.map((e) => e.title)).toEqual(['good']);
  });
});

describe('yearsAgo', () => {
  const today = new Date(2026, 4, 14);

  it('counts whole-year deltas', () => {
    expect(yearsAgo(entry('2025-05-14'), today)).toBe(1);
    expect(yearsAgo(entry('2020-05-14'), today)).toBe(6);
    expect(yearsAgo(entry('2026-05-14'), today)).toBe(0);
  });

  it('returns 0 on malformed input rather than NaN', () => {
    expect(yearsAgo(entry('not-a-date'), today)).toBe(0);
  });
});
