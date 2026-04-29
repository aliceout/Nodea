import { describe, it, expect } from 'vitest';

import { splitThreads } from './threads';

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
