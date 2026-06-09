import { describe, expect, it } from 'vitest';

import { isCanonicalGoalStatus, isMoodScoreString } from './guards';

describe('isMoodScoreString', () => {
  it('accepts the five canonical scores', () => {
    expect(isMoodScoreString('-2')).toBe(true);
    expect(isMoodScoreString('-1')).toBe(true);
    expect(isMoodScoreString('0')).toBe(true);
    expect(isMoodScoreString('1')).toBe(true);
    expect(isMoodScoreString('2')).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isMoodScoreString('3')).toBe(false);
    expect(isMoodScoreString('-3')).toBe(false);
    expect(isMoodScoreString('1.5')).toBe(false);
    expect(isMoodScoreString('')).toBe(false);
    expect(isMoodScoreString(undefined)).toBe(false);
    expect(isMoodScoreString('two')).toBe(false);
  });
});

describe('isCanonicalGoalStatus', () => {
  it('accepts the three canonical statuses', () => {
    expect(isCanonicalGoalStatus('open')).toBe(true);
    expect(isCanonicalGoalStatus('wip')).toBe(true);
    expect(isCanonicalGoalStatus('done')).toBe(true);
  });

  it('rejects legacy aliases (active / archived)', () => {
    // The Composer narrows to the three-state set on input ;
    // legacy values exist in the wild but are never produced
    // here.
    expect(isCanonicalGoalStatus('active')).toBe(false);
    expect(isCanonicalGoalStatus('archived')).toBe(false);
  });

  it('rejects empty / undefined / unknown values', () => {
    expect(isCanonicalGoalStatus('')).toBe(false);
    expect(isCanonicalGoalStatus(undefined)).toBe(false);
    expect(isCanonicalGoalStatus('OPEN')).toBe(false);
    expect(isCanonicalGoalStatus('todo')).toBe(false);
  });
});
