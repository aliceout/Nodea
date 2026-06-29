import { describe, expect, it } from 'vitest';

import {
  computeRecoveryReverifyDue,
  recoveryReverifyWindowMs,
} from './recovery-reverify.ts';

const WEEK = 7 * 24 * 60 * 60 * 1000;
const NOW = new Date('2026-06-29T12:00:00.000Z');
const weeksAgo = (n: number): Date => new Date(NOW.getTime() - n * WEEK);

describe('recoveryReverifyWindowMs', () => {
  it('follows the 6 → 13 → 26 → 52 week ladder', () => {
    expect(recoveryReverifyWindowMs(0)).toBe(6 * WEEK);
    expect(recoveryReverifyWindowMs(1)).toBe(13 * WEEK);
    expect(recoveryReverifyWindowMs(2)).toBe(26 * WEEK);
    expect(recoveryReverifyWindowMs(3)).toBe(52 * WEEK);
  });

  it('clamps higher streaks to the last rung and floors negatives', () => {
    expect(recoveryReverifyWindowMs(99)).toBe(52 * WEEK);
    expect(recoveryReverifyWindowMs(-1)).toBe(6 * WEEK);
  });
});

describe('computeRecoveryReverifyDue', () => {
  it('treats a missing anchor as due (self-heal)', () => {
    expect(computeRecoveryReverifyDue(null, 0, NOW)).toBe(true);
  });

  it('streak 0 → due once 6 weeks elapse', () => {
    expect(computeRecoveryReverifyDue(weeksAgo(5), 0, NOW)).toBe(false);
    expect(computeRecoveryReverifyDue(weeksAgo(7), 0, NOW)).toBe(true);
  });

  it('a longer streak lengthens the window', () => {
    expect(computeRecoveryReverifyDue(weeksAgo(10), 1, NOW)).toBe(false);
    expect(computeRecoveryReverifyDue(weeksAgo(14), 1, NOW)).toBe(true);
    // streak 5 clamps to the 52-week rung.
    expect(computeRecoveryReverifyDue(weeksAgo(51), 5, NOW)).toBe(false);
    expect(computeRecoveryReverifyDue(weeksAgo(53), 5, NOW)).toBe(true);
  });

  it('hitting the window exactly is due (>=)', () => {
    expect(computeRecoveryReverifyDue(weeksAgo(6), 0, NOW)).toBe(true);
  });
});
