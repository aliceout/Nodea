import { describe, it, expect } from 'vitest';

import { formatReviewDate } from './review-format';

describe('formatReviewDate', () => {
  it('formats a valid ISO into a French long date', () => {
    // The exact string can vary slightly between Intl ICU versions
    // (« 8 janvier 2025 » vs « 8 janv. 2025 »). We assert the
    // year + the month root + the day are all present rather than
    // pinning the format byte-for-byte.
    const out = formatReviewDate('2025-01-08T19:42:00.000Z');
    expect(out).toMatch(/8/);
    expect(out).toMatch(/janv/i);
    expect(out).toMatch(/2025/);
  });

  it('returns the raw string when the input is not a parseable date', () => {
    expect(formatReviewDate('not-a-date')).toBe('not-a-date');
  });

  it('returns the raw empty string for empty input', () => {
    expect(formatReviewDate('')).toBe('');
  });
});
