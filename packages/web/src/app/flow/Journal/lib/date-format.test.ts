import { describe, it, expect } from 'vitest';

import { formatEntryLabel, formatMonthLabel } from './date-format';

// Pinned reference date so the « today » / « hier » / cross-year
// branches stay deterministic across machines and seasons.
const TODAY = new Date(2026, 2, 15); // 15 mars 2026, local time

describe('formatEntryLabel', () => {
  it('returns « Aujourd’hui » for today', () => {
    expect(formatEntryLabel('2026-03-15', TODAY)).toBe('Aujourd’hui');
  });

  it('returns « Hier » for yesterday', () => {
    expect(formatEntryLabel('2026-03-14', TODAY)).toBe('Hier');
  });

  it('returns the long FR form (no year) for older dates in the same year', () => {
    const out = formatEntryLabel('2026-01-20', TODAY);
    // Format is « weekday DD month » — e.g. « Mardi 20 janvier ».
    // Month name + day must be present, year must be absent.
    expect(out).toMatch(/20/);
    expect(out).toMatch(/janvier/i);
    expect(out).not.toMatch(/2026/);
    // First letter is uppercased (not the raw « mardi 20 janvier »).
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
    expect(formatEntryLabel('', TODAY)).toBe('');
  });
});

describe('formatMonthLabel', () => {
  it('renders YYYY-MM as « month YYYY »', () => {
    expect(formatMonthLabel('2026-03')).toMatch(/mars 2026/i);
    expect(formatMonthLabel('2024-12')).toMatch(/décembre 2024/i);
  });

  it('uppercases the first letter', () => {
    const out = formatMonthLabel('2026-03');
    expect(out[0]).toBe(out[0]?.toUpperCase());
  });

  it('falls back to the raw input when YYYY-MM is malformed', () => {
    expect(formatMonthLabel('not-a-month')).toBe('not-a-month');
    expect(formatMonthLabel('')).toBe('');
  });
});
