import { describe, it, expect } from 'vitest';

import { matchesCellFilter } from './cell-filter';
import type { LibraryItem } from './types';

function fixture(
  partial: Partial<LibraryItem> & { id: string; title: string },
): LibraryItem {
  return {
    type: 'book',
    creators: [],
    coverRid: null,
    status: 'planned',
    format: 'unknown',
    startedAt: null,
    finishedAt: null,
    rating: null,
    tags: [],
    isFavorite: false,
    ...partial,
  };
}

describe('matchesCellFilter — author', () => {
  it('matches when one of the item authors equals the filter value', () => {
    const item = fixture({
      id: '1',
      title: 'X',
      creators: [
        { name: 'Camille Leboulanger', role: 'author' },
        { name: 'Some Translator', role: 'translator' },
      ],
    });
    expect(
      matchesCellFilter(item, {
        field: 'author',
        value: 'Camille Leboulanger',
      }),
    ).toBe(true);
  });

  it('ignores non-author roles', () => {
    const item = fixture({
      id: '1',
      title: 'X',
      creators: [{ name: 'Some Translator', role: 'translator' }],
    });
    expect(
      matchesCellFilter(item, {
        field: 'author',
        value: 'Some Translator',
      }),
    ).toBe(false);
  });

  it('treats unset role as author (defensive — legacy data only)', () => {
    // The Zod schema defaults `role` to 'author', so freshly written
    // data always has it set. The runtime `!c.role` branch is a
    // defensive fallback for legacy / pre-migration creators that
    // haven't been re-saved through the schema. We force a missing
    // `role` here to exercise that branch.
    const creator = { name: 'Hugo' } as unknown as LibraryItem['creators'][number];
    const item = fixture({ id: '1', title: 'X', creators: [creator] });
    expect(matchesCellFilter(item, { field: 'author', value: 'Hugo' })).toBe(
      true,
    );
  });
});

describe('matchesCellFilter — publisher', () => {
  it('matches an exact (trimmed) publisher string', () => {
    const item = fixture({ id: '1', title: 'X', publisher: '  Folio  ' });
    expect(matchesCellFilter(item, { field: 'publisher', value: 'Folio' })).toBe(
      true,
    );
    expect(matchesCellFilter(item, { field: 'publisher', value: 'Pléiade' })).toBe(
      false,
    );
  });
});

describe('matchesCellFilter — language', () => {
  it('matches case-insensitively', () => {
    const item = fixture({ id: '1', title: 'X', language: 'FR' });
    expect(matchesCellFilter(item, { field: 'language', value: 'fr' })).toBe(
      true,
    );
  });

  it('returns false when the item has no language', () => {
    const item = fixture({ id: '1', title: 'X' });
    expect(matchesCellFilter(item, { field: 'language', value: 'fr' })).toBe(
      false,
    );
  });
});

describe('matchesCellFilter — year', () => {
  it('matches the canonical year string', () => {
    const item = fixture({ id: '1', title: 'X', year: 2022 });
    expect(matchesCellFilter(item, { field: 'year', value: '2022' })).toBe(true);
    expect(matchesCellFilter(item, { field: 'year', value: '2023' })).toBe(false);
  });

  it('returns false when the item has no year', () => {
    const item = fixture({ id: '1', title: 'X' });
    expect(matchesCellFilter(item, { field: 'year', value: '2022' })).toBe(false);
  });
});
