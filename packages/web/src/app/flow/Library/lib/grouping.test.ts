import { describe, it, expect } from 'vitest';

import { buildGroups, groupKeysFor } from './grouping';
import type { LibraryItem } from './types';

/** Minimal LibraryItem fixture — only the fields the tests need ;
 *  everything else gets a sensible default. */
function fixture(
  partial: Partial<LibraryItem> & { id: string; title: string },
): LibraryItem {
  return {
    type: 'book',
    creators: [],
    cover_rid: null,
    status: 'planned',
    format: 'unknown',
    started_at: null,
    finished_at: null,
    current_page: null,
    rating: null,
    tags: [],
    is_favorite: false,
    ...partial,
  };
}

describe('groupKeysFor', () => {
  it('returns the trimmed first author name, or [] if absent / blank', () => {
    expect(
      groupKeysFor(
        fixture({
          id: '1',
          title: 'X',
          creators: [{ name: '  Hugo ', role: 'author' }],
        }),
        'author',
      ),
    ).toEqual(['Hugo']);
    expect(groupKeysFor(fixture({ id: '1', title: 'X' }), 'author')).toEqual([]);
    expect(
      groupKeysFor(
        fixture({
          id: '1',
          title: 'X',
          creators: [{ name: '   ', role: 'author' }],
        }),
        'author',
      ),
    ).toEqual([]);
  });

  it('returns the year as a string, or [] if missing', () => {
    expect(
      groupKeysFor(fixture({ id: '1', title: 'X', year: 1862 }), 'year'),
    ).toEqual(['1862']);
    expect(groupKeysFor(fixture({ id: '1', title: 'X' }), 'year')).toEqual([]);
  });

  it('returns trimmed non-empty tags (book lands in every matching bucket)', () => {
    expect(
      groupKeysFor(
        fixture({
          id: '1',
          title: 'X',
          tags: ['  classique', 'roman ', '   '],
        }),
        'tag',
      ),
    ).toEqual(['classique', 'roman']);
    expect(groupKeysFor(fixture({ id: '1', title: 'X' }), 'tag')).toEqual([]);
  });

  it('returns the trimmed publisher / collection when present', () => {
    expect(
      groupKeysFor(
        fixture({ id: '1', title: 'X', publisher: '  Folio  ' }),
        'publisher',
      ),
    ).toEqual(['Folio']);
    expect(
      groupKeysFor(
        fixture({ id: '1', title: 'X', collection: 'Pléiade' }),
        'collection',
      ),
    ).toEqual(['Pléiade']);
    expect(
      groupKeysFor(fixture({ id: '1', title: 'X' }), 'publisher'),
    ).toEqual([]);
    expect(
      groupKeysFor(fixture({ id: '1', title: 'X' }), 'collection'),
    ).toEqual([]);
  });
});

describe('buildGroups (status)', () => {
  it('returns 4 groups in the canonical reading order', () => {
    const items = [
      fixture({ id: '1', title: 'A', status: 'finished' }),
      fixture({ id: '2', title: 'B', status: 'planned' }),
      fixture({ id: '3', title: 'C', status: 'in_progress' }),
    ];
    const groups = buildGroups(items, 'status');
    expect(groups.map((g) => g.key)).toEqual([
      'in_progress',
      'planned',
      'finished',
      'abandoned',
    ]);
    expect(groups.map((g) => g.items.length)).toEqual([1, 1, 1, 0]);
  });

  it('sorts items within a status group alphabetically (FR locale)', () => {
    const items = [
      fixture({ id: '1', title: 'Étoiles', status: 'finished' }),
      fixture({ id: '2', title: 'Albanie', status: 'finished' }),
      fixture({ id: '3', title: 'Élève', status: 'finished' }),
    ];
    const groups = buildGroups(items, 'status');
    const finished = groups.find((g) => g.key === 'finished');
    expect(finished?.items.map((i) => i.title)).toEqual([
      'Albanie',
      'Élève',
      'Étoiles',
    ]);
  });
});

describe('buildGroups (metadata axes)', () => {
  it('groups by author and adds a « no value » bucket at the end', () => {
    const items = [
      fixture({
        id: '1',
        title: 'A',
        creators: [{ name: 'Hugo', role: 'author' }],
      }),
      fixture({
        id: '2',
        title: 'B',
        creators: [{ name: 'Zola', role: 'author' }],
      }),
      fixture({ id: '3', title: 'C' }), // no author
    ];
    const groups = buildGroups(items, 'author');
    expect(groups.map((g) => g.key)).toEqual(['Hugo', 'Zola', '__none__']);
    expect(groups[2]?.items.map((i) => i.title)).toEqual(['C']);
  });

  it('places a multi-tag book in every matching tag bucket', () => {
    const items = [
      fixture({ id: '1', title: 'A', tags: ['classique', 'roman'] }),
      fixture({ id: '2', title: 'B', tags: ['classique'] }),
    ];
    const groups = buildGroups(items, 'tag');
    const classique = groups.find((g) => g.key === 'classique');
    const roman = groups.find((g) => g.key === 'roman');
    expect(classique?.items.length).toBe(2);
    expect(roman?.items.length).toBe(1);
  });

  it('sorts year buckets newest-first', () => {
    const items = [
      fixture({ id: '1', title: 'Old', year: 1862 }),
      fixture({ id: '2', title: 'Modern', year: 2024 }),
      fixture({ id: '3', title: 'Mid', year: 1956 }),
    ];
    const groups = buildGroups(items, 'year');
    expect(groups.map((g) => g.key)).toEqual(['2024', '1956', '1862']);
  });

  it('omits the no-value bucket when every item has a value', () => {
    const items = [
      fixture({ id: '1', title: 'A', publisher: 'Folio' }),
      fixture({ id: '2', title: 'B', publisher: 'Folio' }),
    ];
    const groups = buildGroups(items, 'publisher');
    expect(groups).toHaveLength(1);
    expect(groups[0]?.key).toBe('Folio');
    expect(groups[0]?.items.map((i) => i.title)).toEqual(['A', 'B']);
  });
});
