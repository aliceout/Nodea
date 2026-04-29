import { describe, expect, it } from 'vitest';

import {
  formatEntryLabel,
  formatLongDate,
  formatMonthLabel,
  parseLocalDate,
  toIsoDate,
} from './date-fr';

const TODAY = new Date(2026, 2, 15); // 15 mars 2026, midi local

describe('parseLocalDate', () => {
  it('reads YYYY-MM-DD as local midnight', () => {
    const d = parseLocalDate('2026-03-15');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(0);
  });

  it('tolerates trailing time / timezone suffixes', () => {
    const d = parseLocalDate('2026-03-15T08:42:00Z');
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(0);
  });

  it('returns Invalid Date on a malformed input', () => {
    expect(Number.isNaN(parseLocalDate('garbage').getTime())).toBe(true);
    expect(Number.isNaN(parseLocalDate('').getTime())).toBe(true);
    expect(Number.isNaN(parseLocalDate('15/03/2026').getTime())).toBe(true);
  });
});

describe('toIsoDate', () => {
  it('uses local-TZ year/month/day with zero padding', () => {
    expect(toIsoDate(new Date(2026, 0, 4))).toBe('2026-01-04');
    expect(toIsoDate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('round-trips with parseLocalDate', () => {
    const d = new Date(2026, 5, 7);
    const back = parseLocalDate(toIsoDate(d));
    expect(back.getTime()).toBe(d.getTime());
  });
});

describe('formatEntryLabel', () => {
  it('returns « Aujourd’hui » when the entry matches today', () => {
    expect(formatEntryLabel('2026-03-15', TODAY)).toBe('Aujourd’hui');
  });

  it('returns « Hier » for the previous day', () => {
    expect(formatEntryLabel('2026-03-14', TODAY)).toBe('Hier');
  });

  it('returns capitalised same-year label for older days', () => {
    // 12 mars 2026 — « jeudi 12 mars » (capitalised first letter)
    const out = formatEntryLabel('2026-03-12', TODAY);
    expect(out).toMatch(/^[A-ZÀÂ]/);
    expect(out).toContain('mars');
    expect(out).not.toContain('2026'); // same year — no year suffix
  });

  it('switches to cross-year label (with year, no weekday)', () => {
    const out = formatEntryLabel('2024-03-12', TODAY);
    expect(out).toContain('2024');
    expect(out).toContain('mars');
  });

  it('falls back to raw input on parse failure', () => {
    expect(formatEntryLabel('garbage', TODAY)).toBe('garbage');
  });

  it('survives a UTC midnight ISO without slipping to « hier »', () => {
    // The pre-fix `new Date('2026-03-15')` parsed as UTC midnight,
    // which became 2026-03-14 23:00 in UTC− zones — surfaced as
    // « hier » where it should be « aujourd’hui ». parseLocalDate
    // sidesteps the wobble.
    expect(formatEntryLabel('2026-03-15T00:00:00Z', TODAY)).toBe('Aujourd’hui');
  });
});

describe('formatMonthLabel', () => {
  it('formats YYYY-MM as « Mars 2026 » (capitalised)', () => {
    const out = formatMonthLabel('2026-03');
    expect(out).toMatch(/^[A-ZÀ]/);
    expect(out).toContain('2026');
  });

  it('falls back to the raw key on malformed input', () => {
    expect(formatMonthLabel('not-a-month')).toBe('not-a-month');
    expect(formatMonthLabel('2026-')).toBe('2026-');
  });
});

describe('formatLongDate', () => {
  it('formats a full ISO timestamp as day + month + year', () => {
    const out = formatLongDate('2025-01-08T19:42:00.000Z');
    expect(out).toContain('janvier');
    expect(out).toContain('2025');
  });

  it('returns the raw string when the ISO fails to parse', () => {
    expect(formatLongDate('not-a-date')).toBe('not-a-date');
    expect(formatLongDate('')).toBe('');
  });
});
