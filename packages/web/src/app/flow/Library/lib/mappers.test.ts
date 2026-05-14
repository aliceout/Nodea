import { describe, it, expect } from 'vitest';
import type {
  LibraryCoverPayload,
  LibraryItemPayload,
  LibraryReviewPayload,
} from '@nodea/shared';
import type { DecryptedRecord } from '@/core/api/modules/collection-client';

import { itemFromRecord, reviewFromRecord, buildCoverMap } from './mappers';

const sampleItemPayload: LibraryItemPayload = {
  type: 'book',
  title: 'Les Misérables',
  creators: [{ name: 'Victor HUGO', role: 'author' }],
  year: 1862,
  coverRid: null,
  status: 'finished',
  format: 'paper',
  startedAt: null,
  finishedAt: null,
  rating: null,
  tags: [],
  isFavorite: false,
};

describe('itemFromRecord', () => {
  it('flattens the record into id + payload fields', () => {
    const record: DecryptedRecord<LibraryItemPayload> = {
      id: 'rec-1',
      moduleUserId: 'sid-x',
      payload: sampleItemPayload,
    };
    const item = itemFromRecord(record);
    expect(item.id).toBe('rec-1');
    expect(item.title).toBe('Les Misérables');
    expect(item.creators[0]?.name).toBe('Victor HUGO');
    expect(item.year).toBe(1862);
  });
});

describe('reviewFromRecord', () => {
  it('flattens the record into id + payload fields', () => {
    const payload: LibraryReviewPayload = {
      itemRid: 'item-42',
      date: '2025-01-08T19:42:00.000Z',
      kind: 'quote',
      title: null,
      content: 'Markdown libre',
      page: 318,
      spoiler: false,
    };
    const record: DecryptedRecord<LibraryReviewPayload> = {
      id: 'rev-1',
      moduleUserId: 'sid-x',
      payload,
    };
    const review = reviewFromRecord(record);
    expect(review.id).toBe('rev-1');
    expect(review.itemRid).toBe('item-42');
    expect(review.kind).toBe('quote');
    expect(review.page).toBe(318);
  });
});

describe('buildCoverMap', () => {
  it('returns an empty map for zero records', () => {
    expect(buildCoverMap([]).size).toBe(0);
  });

  it('keys by record id and emits data: URLs', () => {
    const records: DecryptedRecord<LibraryCoverPayload>[] = [
      {
        id: 'cov-a',
        moduleUserId: 'sid-x',
        payload: {
          itemRid: 'item-a',
          mime: 'image/jpeg',
          blobB64: 'AAA',
          fetchedFrom: null,
          fetchedAt: null,
        },
      },
      {
        id: 'cov-b',
        moduleUserId: 'sid-x',
        payload: {
          itemRid: 'item-b',
          mime: 'image/png',
          blobB64: 'BBB',
          fetchedFrom: null,
          fetchedAt: null,
        },
      },
    ];
    const map = buildCoverMap(records);
    expect(map.size).toBe(2);
    expect(map.get('cov-a')).toBe('data:image/jpeg;base64,AAA');
    expect(map.get('cov-b')).toBe('data:image/png;base64,BBB');
  });
});
