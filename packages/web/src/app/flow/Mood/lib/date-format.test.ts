import { describe, it, expect } from 'vitest';

import { formatEntryLabel, rangeFor, toIsoDate } from './date-format';

const TODAY = new Date(2026, 2, 15); // 15 mars 2026 (Sunday)

describe('formatEntryLabel', () => {
  it('returns « Aujourd’hui » for today', () => {
    expect(formatEntryLabel('2026-03-15', TODAY)).toBe('Aujourd’hui');
  });

  it('returns « Hier » for yesterday', () => {
    expect(formatEntryLabel('2026-03-14', TODAY)).toBe('Hier');
  });

  it('returns the long FR form (no year) for older dates in the same year', () => {
    const out = formatEntryLabel('2026-01-20', TODAY);
    expect(out).toMatch(/20/);
    expect(out).toMatch(/janvier/i);
    expect(out).not.toMatch(/2026/);
    expect(out[0]).toBe(out[0]?.toUpperCase());
  });

  it('returns the long FR form WITH year for cross-year dates', () => {
    const out = formatEntryLabel('2024-08-12', TODAY);
    expect(out).toMatch(/12/);
    expect(out).toMatch(/août/i);
    expect(out).toMatch(/2024/);
  });

  it('returns the raw input when the ISO can\'t be parsed', () => {
    expect(formatEntryLabel('not-a-date', TODAY)).toBe('not-a-date');
  });
});

describe('toIsoDate', () => {
  it('returns YYYY-MM-DD with zero-padding', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toIsoDate(new Date(2024, 11, 31))).toBe('2024-12-31');
  });
});

describe('rangeFor', () => {
  it('rolling 52 weeks ending today when year is null', () => {
    const { start, end, dataEnd } = rangeFor(null, TODAY);
    expect(end).toEqual(TODAY);
    expect(dataEnd).toEqual(TODAY);
    // 52 weeks × 7 days = 364 days back, plus 1 (the +1 in the
    // implementation puts `start` on day -363 from today).
    const dayMs = 24 * 3600 * 1000;
    const diff = Math.round((TODAY.getTime() - start.getTime()) / dayMs);
    expect(diff).toBe(363);
  });

  it('current year : Jan 1 → Dec 31, dataEnd at today', () => {
    const { start, end, dataEnd } = rangeFor(2026, TODAY);
    expect(start).toEqual(new Date(2026, 0, 1));
    expect(end).toEqual(new Date(2026, 11, 31));
    expect(dataEnd).toEqual(TODAY);
  });

  it('past year : Jan 1 → Dec 31, dataEnd matches end', () => {
    const { start, end, dataEnd } = rangeFor(2024, TODAY);
    expect(start).toEqual(new Date(2024, 0, 1));
    expect(end).toEqual(new Date(2024, 11, 31));
    expect(dataEnd).toEqual(new Date(2024, 11, 31));
  });

  it('future year : Jan 1 → Dec 31, dataEnd matches end (no truncation)', () => {
    // Slightly weird semantically — a future year selection will
    // show empty cells throughout — but the function should still
    // behave deterministically.
    const { start, end, dataEnd } = rangeFor(2030, TODAY);
    expect(start).toEqual(new Date(2030, 0, 1));
    expect(end).toEqual(new Date(2030, 11, 31));
    expect(dataEnd).toEqual(new Date(2030, 11, 31));
  });
});
