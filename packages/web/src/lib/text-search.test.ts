import { describe, expect, it } from 'vitest';

import {
  buildSearchHaystack,
  matchesAnyField,
  matchesHaystack,
  matchesSearch,
  normalizeForSearch,
} from './text-search';

describe('normalizeForSearch', () => {
  it('strips diacritics and lowercases', () => {
    expect(normalizeForSearch('Café')).toBe('cafe');
    expect(normalizeForSearch('ÀÉÎÔÙ')).toBe('aeiou');
    expect(normalizeForSearch('Eva à la plage')).toBe('eva a la plage');
  });

  it('preserves non-Latin scripts via toLowerCase only', () => {
    expect(normalizeForSearch('Привет')).toBe('привет');
    expect(normalizeForSearch('日本')).toBe('日本');
  });

  it('handles empty input', () => {
    expect(normalizeForSearch('')).toBe('');
  });
});

describe('matchesSearch', () => {
  it('matches when haystack contains the query (case-insensitive)', () => {
    expect(matchesSearch('Promenade avec Anouk', 'anouk')).toBe(true);
    expect(matchesSearch('Promenade avec Anouk', 'ANOUK')).toBe(true);
  });

  it('matches accent-insensitive', () => {
    expect(matchesSearch('Café à la plage', 'cafe')).toBe(true);
    expect(matchesSearch('Café à la plage', 'a la')).toBe(true);
  });

  it('returns true for empty query (no-filter contract)', () => {
    expect(matchesSearch('whatever', '')).toBe(true);
    expect(matchesSearch('whatever', '   ')).toBe(true);
  });

  it('AND-combines whitespace-separated tokens', () => {
    expect(matchesSearch('Promenade avec Anouk à la plage', 'anouk plage')).toBe(true);
    expect(matchesSearch('Promenade avec Anouk', 'anouk plage')).toBe(false);
  });

  it('returns false when no token matches', () => {
    expect(matchesSearch('Promenade avec Anouk', 'tennis')).toBe(false);
  });
});

describe('matchesAnyField', () => {
  it('matches when any field contains the query', () => {
    expect(
      matchesAnyField(['Title', 'A short comment about Anouk', null], 'anouk'),
    ).toBe(true);
  });

  it('skips null / undefined / empty fields', () => {
    expect(matchesAnyField([null, undefined, '', 'Eva'], 'eva')).toBe(true);
    expect(matchesAnyField([null, undefined, ''], 'anything')).toBe(false);
  });

  it('AND-combines tokens across the whole field set (cross-field)', () => {
    // Token 1 lives in field 1, token 2 in field 2 — should match.
    expect(
      matchesAnyField(['Anouk était là', 'plage de Tana'], 'anouk plage'),
    ).toBe(true);
  });

  it('returns false when one token is missing from every field', () => {
    expect(
      matchesAnyField(['Anouk était là', 'plage de Tana'], 'anouk tennis'),
    ).toBe(false);
  });

  it('returns true on empty query (no-filter contract)', () => {
    expect(matchesAnyField(['anything'], '')).toBe(true);
    expect(matchesAnyField([null, undefined], '   ')).toBe(true);
  });

  it('handles diacritics consistently across query and field', () => {
    expect(matchesAnyField(['Eva à la plage'], 'eva a la')).toBe(true);
    expect(matchesAnyField(['eva a la plage'], 'à la')).toBe(true);
  });
});

describe('buildSearchHaystack + matchesHaystack', () => {
  it('precomputed haystack matches the same way matchesAnyField does', () => {
    // The precomputed path must be behaviourally identical to the
    // one-shot path — this is the equivalence the perf optimisation
    // rests on (audit 2026-06 passe 2).
    const fields = ['Anouk était là', 'plage de Tana', null];
    const haystack = buildSearchHaystack(fields);
    for (const query of ['anouk', 'anouk plage', 'anouk tennis', 'à la', '']) {
      expect(matchesHaystack(haystack, query)).toBe(
        matchesAnyField(fields, query),
      );
    }
  });

  it('normalises fields at build time (diacritics + case)', () => {
    const haystack = buildSearchHaystack(['Éva À LA Plage']);
    expect(haystack).toBe('eva a la plage');
    expect(matchesHaystack(haystack, 'eva a la')).toBe(true);
  });

  it('skips null / undefined / empty fields', () => {
    const haystack = buildSearchHaystack([null, undefined, '', 'Eva']);
    expect(matchesHaystack(haystack, 'eva')).toBe(true);
    expect(matchesHaystack(haystack, 'anything')).toBe(false);
  });

  it('does not match a single token spanning two fields (boundary)', () => {
    // A single token must live wholly inside one field — the newline
    // separator prevents « abcdef » from matching « abc » + « def »
    // glued across the boundary. (Multi-token queries AND across
    // fields ; that's covered by the equivalence test above.)
    const haystack = buildSearchHaystack(['abc', 'def']);
    expect(matchesHaystack(haystack, 'abcdef')).toBe(false);
    expect(matchesHaystack(haystack, 'abc')).toBe(true);
  });

  it('returns true on empty / whitespace query (no-filter contract)', () => {
    expect(matchesHaystack(buildSearchHaystack(['x']), '')).toBe(true);
    expect(matchesHaystack(buildSearchHaystack(['x']), '   ')).toBe(true);
  });
});
