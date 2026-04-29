import { describe, expect, it } from 'vitest';

import {
  firstThread,
  formatMoodAvg,
  formatTimeFromIso,
  preferredName,
  signedScore,
  toIsoDate,
} from './format';

describe('preferredName', () => {
  it('prefers username over email', () => {
    expect(
      preferredName({ username: 'alice', email: 'a@b.test' }),
    ).toBe('alice');
  });

  it('falls back to email local-part when username is empty', () => {
    expect(preferredName({ username: '   ', email: 'alice@b.test' })).toBe('alice');
    expect(preferredName({ email: 'bob@b.test' })).toBe('bob');
  });

  it('returns empty string for missing user / missing email', () => {
    expect(preferredName(null)).toBe('');
    expect(preferredName(undefined)).toBe('');
    expect(preferredName({ username: null })).toBe('');
  });
});

describe('signedScore', () => {
  it('prefixes positives with +', () => {
    expect(signedScore('1')).toBe('+1');
    expect(signedScore('2')).toBe('+2');
  });

  it('passes 0 and negatives through', () => {
    expect(signedScore('0')).toBe('0');
    expect(signedScore('-1')).toBe('-1');
    expect(signedScore('-2')).toBe('-2');
  });
});

describe('formatTimeFromIso', () => {
  it('renders local HH:MM with leading zeros', () => {
    // 2026-04-12T08:42:00 local — pin the local TZ via Date ctor.
    const local = new Date(2026, 3, 12, 8, 42, 0);
    expect(formatTimeFromIso(local.toISOString())).toBe(
      `${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')}`,
    );
  });

  it('returns empty string on invalid input', () => {
    expect(formatTimeFromIso('not-a-date')).toBe('');
  });
});

describe('formatMoodAvg', () => {
  it('uses unicode minus and FR comma decimal', () => {
    expect(formatMoodAvg(1.23)).toBe('+1,2');
    expect(formatMoodAvg(-0.45)).toBe('−0,5');
    expect(formatMoodAvg(0)).toBe('0,0');
  });
});

describe('toIsoDate', () => {
  it('uses local-TZ year/month/day with zero padding', () => {
    expect(toIsoDate(new Date(2026, 0, 4))).toBe('2026-01-04');
    expect(toIsoDate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('firstThread', () => {
  it('returns the first comma-separated token, trimmed', () => {
    expect(firstThread('  #alpha  ,  #beta')).toBe('#alpha');
    expect(firstThread('#solo')).toBe('#solo');
  });

  it('returns empty on empty / whitespace input', () => {
    expect(firstThread('')).toBe('');
    expect(firstThread('   ')).toBe('');
  });
});
