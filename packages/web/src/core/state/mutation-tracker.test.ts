import { describe, it, expect } from 'vitest';
import { createMutationTracker } from './mutation-tracker';

describe('createMutationTracker', () => {
  it('returns true on isLatest right after begin for the same key', () => {
    const t = createMutationTracker<string>();
    const token = t.begin('a');
    expect(t.isLatest('a', token)).toBe(true);
  });

  it('returns false on isLatest after a newer begin for the same key', () => {
    const t = createMutationTracker<string>();
    const first = t.begin('a');
    const second = t.begin('a');
    // Older mutation no longer the latest — its rollback should be ignored.
    expect(t.isLatest('a', first)).toBe(false);
    // Newer mutation IS the latest.
    expect(t.isLatest('a', second)).toBe(true);
  });

  it('isolates keys — a mutation on key B does not invalidate key A', () => {
    const t = createMutationTracker<string>();
    const a = t.begin('a');
    t.begin('b');
    expect(t.isLatest('a', a)).toBe(true);
  });

  it('returns false for an unknown key', () => {
    const t = createMutationTracker<string>();
    expect(t.isLatest('a', 'never-issued')).toBe(false);
  });

  it('forget drops a key — a stale token reads as not-latest after forget', () => {
    const t = createMutationTracker<string>();
    const token = t.begin('a');
    expect(t.isLatest('a', token)).toBe(true);
    t.forget('a');
    expect(t.isLatest('a', token)).toBe(false);
  });

  it('issues distinct tokens across calls (no collisions to worry about)', () => {
    const t = createMutationTracker<string>();
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) tokens.add(t.begin('a'));
    expect(tokens.size).toBe(100);
  });
});
