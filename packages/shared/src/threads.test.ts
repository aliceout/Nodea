import { describe, expect, it } from 'vitest';

import { firstThread, splitThreads } from './threads';

describe('splitThreads', () => {
  it('returns trimmed tokens for a comma-separated string', () => {
    expect(splitThreads('#A, #B,  #C ')).toEqual(['#A', '#B', '#C']);
  });

  it('drops empty / whitespace-only tokens', () => {
    expect(splitThreads('#A, , #B,   ,#C')).toEqual(['#A', '#B', '#C']);
  });

  it('dedups while preserving first-seen order', () => {
    expect(splitThreads('#A, #B, #A, #C, #B')).toEqual(['#A', '#B', '#C']);
  });

  it('returns [] for an empty string', () => {
    expect(splitThreads('')).toEqual([]);
  });

  it('returns [] for a comma-only string', () => {
    expect(splitThreads(',,,')).toEqual([]);
  });

  it('handles a single token (no comma)', () => {
    expect(splitThreads('   #solo  ')).toEqual(['#solo']);
  });
});

describe('firstThread', () => {
  it('returns the first comma-separated token, trimmed', () => {
    expect(firstThread('  #alpha  ,  #beta')).toBe('#alpha');
    expect(firstThread('#solo')).toBe('#solo');
  });

  it('skips leading whitespace tokens before the first real one', () => {
    // `splitThreads` drops whitespace-only tokens, so the « first
    // real token » is `#alpha`, not the empty string before it.
    expect(firstThread('  ,  #alpha,#beta')).toBe('#alpha');
  });

  it('returns empty on empty / whitespace input', () => {
    expect(firstThread('')).toBe('');
    expect(firstThread('   ')).toBe('');
    expect(firstThread(',,,')).toBe('');
  });
});
