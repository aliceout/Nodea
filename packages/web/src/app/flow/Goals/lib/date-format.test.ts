import { describe, it, expect } from 'vitest';

import { formatDate } from './date-format';

describe('formatDate', () => {
  it('formats YYYY-MM as « month YYYY »', () => {
    expect(formatDate('2025-01')).toBe('janv. 2025');
    expect(formatDate('2025-08')).toBe('août 2025');
    expect(formatDate('2025-12')).toBe('déc. 2025');
  });

  it('formats YYYY-MM-DD as « DD month YYYY »', () => {
    expect(formatDate('2025-01-08')).toBe('08 janv. 2025');
    expect(formatDate('2024-03-15')).toBe('15 mars 2024');
  });

  it('returns the raw string when the input does not match the date pattern', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
    expect(formatDate('')).toBe('');
    expect(formatDate('2025')).toBe('2025');
  });

  it('falls back to the raw month digits when the month index is out of range', () => {
    // Defensive fallback ; in practice the input always carries
    // 01-12 since it comes from the DateMonthPicker, but the
    // function should not crash on bad data.
    expect(formatDate('2025-13')).toBe('13 2025');
  });
});
