import { describe, it, expect } from 'vitest';

import { formatDate } from './date-format';

describe('formatDate (fr)', () => {
  it('formats YYYY-MM as « month YYYY »', () => {
    // Intl FR short months — janvier abbreviated as "janv." on
    // mainstream ICU builds, accept either with or without the
    // trailing dot for forward-compat with future ICU versions.
    expect(formatDate('2025-01', 'fr')).toMatch(/^janv\.? 2025$/);
    expect(formatDate('2025-08', 'fr')).toBe('août 2025');
    expect(formatDate('2025-12', 'fr')).toMatch(/^déc\.? 2025$/);
  });

  it('formats YYYY-MM-DD as « DD month YYYY »', () => {
    expect(formatDate('2025-01-08', 'fr')).toMatch(/^08 janv\.? 2025$/);
    expect(formatDate('2024-03-15', 'fr')).toBe('15 mars 2024');
  });

  it('returns the raw string when the input does not match the date pattern', () => {
    expect(formatDate('not-a-date', 'fr')).toBe('not-a-date');
    expect(formatDate('', 'fr')).toBe('');
    expect(formatDate('2025', 'fr')).toBe('2025');
  });

  it('falls back to the raw month digits when the month index is out of range', () => {
    // Defensive fallback ; in practice the input always carries
    // 01-12 since it comes from the DateMonthPicker, but the
    // function should not crash on bad data.
    expect(formatDate('2025-13', 'fr')).toBe('13 2025');
  });
});

describe('formatDate (en)', () => {
  it('uses English short month names', () => {
    expect(formatDate('2025-01', 'en')).toBe('Jan 2025');
    expect(formatDate('2025-08', 'en')).toBe('Aug 2025');
    expect(formatDate('2025-12', 'en')).toBe('Dec 2025');
  });

  it('renders the day prefix in EN too', () => {
    expect(formatDate('2025-01-08', 'en')).toBe('08 Jan 2025');
  });
});
