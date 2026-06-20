import { describe, it, expect } from 'vitest';

import {
  checkQuizAnswers,
  normaliseWord,
  pickQuizPositions,
} from './mnemonic-quiz';

describe('pickQuizPositions', () => {
  it('returns the requested count of distinct, in-range, ascending positions', () => {
    // Run many times — the RNG must never break the invariants.
    for (let run = 0; run < 100; run += 1) {
      const pos = pickQuizPositions(12, 3);
      expect(pos).toHaveLength(3);
      expect(new Set(pos).size).toBe(3); // distinct
      expect(pos).toEqual([...pos].sort((a, b) => a - b)); // sorted
      for (const p of pos) {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThan(12);
      }
    }
  });

  it('caps count at total when asked for more than available', () => {
    expect(pickQuizPositions(2, 5)).toHaveLength(2);
  });
});

describe('checkQuizAnswers', () => {
  const words = 'alpha bravo charlie delta echo foxtrot'.split(' ');

  it('passes when all quizzed words match (case + whitespace insensitive)', () => {
    expect(checkQuizAnswers(words, [0, 2, 4], ['alpha', ' Charlie ', 'ECHO'])).toBe(
      true,
    );
  });

  it('fails when any answer is wrong', () => {
    expect(checkQuizAnswers(words, [0, 2, 4], ['alpha', 'delta', 'echo'])).toBe(
      false,
    );
  });

  it('fails on a length mismatch or empty quiz', () => {
    expect(checkQuizAnswers(words, [0, 2], ['alpha'])).toBe(false);
    expect(checkQuizAnswers(words, [], [])).toBe(false);
  });
});

describe('normaliseWord', () => {
  it('trims and lowercases', () => {
    expect(normaliseWord('  Échec ')).toBe('échec');
    expect(normaliseWord('ALPHA')).toBe('alpha');
  });
});
