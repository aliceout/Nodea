import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PARENT_REF_KEY } from '@/core/api/modules/import-export/relink.ts';
import type { ImportExportPlugin } from '@/core/api/modules/import-export/types.ts';

/**
 * Integration guard for the cross-host relational remap (#155). Drives
 * the real `restoreEnvelope` orchestration (phase ordering + parent
 * index + relink) against fake plugins that mirror the real contract:
 * they assign FRESH server ids, expose `listKeyIndex`/`listExistingKeys`
 * from a backing store, and commit through `bulkImportHandler` — the
 * branch production actually takes (every real plugin has one). Covers
 * the fresh-host rewrite, children-only re-link, never-dropped orphan,
 * same-host idempotency, and the parent natural-key collision regression.
 */

let bookSeq = 0;
const bookStore: Array<{ id: string; key: string }> = []; // parents on host
const reviewStore: Array<Record<string, unknown>> = []; // children on host

function bookKey(p: unknown): string {
  return `book::${(p as { title: string }).title}`;
}
function reviewKey(p: unknown): string {
  const r = p as { itemRid: string; content: string };
  return `rev::${r.itemRid}::${r.content}`;
}

const fakeBooks = {
  meta: { id: 'library_items', runtimeKey: 'library-items' },
  getNaturalKey: bookKey,
  listExistingKeys: async () => new Set(bookStore.map((b) => b.key)),
  listKeyIndex: async () => bookStore.map((b) => ({ id: b.id, key: b.key })),
  importHandler: async ({ payload }: { payload: unknown }) => {
    bookSeq += 1;
    const id = `NEW-BOOK-${bookSeq}`;
    bookStore.push({ id, key: bookKey(payload) });
    return { action: 'created' as const, id };
  },
  bulkImportHandler: async ({ payloads }: { payloads: ReadonlyArray<unknown> }) => {
    const ids: string[] = [];
    for (const p of payloads) {
      bookSeq += 1;
      const id = `NEW-BOOK-${bookSeq}`;
      bookStore.push({ id, key: bookKey(p) });
      ids.push(id);
    }
    return { ids };
  },
  exportQuery: async function* () {},
  exportSerialize: (payload: unknown) => ({ module: 'library_items', version: 1, payload }),
} as unknown as ImportExportPlugin;

const fakeReviews = {
  meta: {
    id: 'library_reviews',
    runtimeKey: 'library-reviews',
    parentRef: { field: 'itemRid', parentPlugin: 'library_items' },
  },
  getNaturalKey: reviewKey,
  listExistingKeys: async () => new Set(reviewStore.map(reviewKey)),
  importHandler: async ({ payload }: { payload: unknown }) => {
    reviewStore.push(payload as Record<string, unknown>);
    return { action: 'created' as const, id: `NEW-REV-${reviewStore.length}` };
  },
  bulkImportHandler: async ({ payloads }: { payloads: ReadonlyArray<unknown> }) => {
    const ids: string[] = [];
    for (const p of payloads) {
      reviewStore.push(p as Record<string, unknown>);
      ids.push(`NEW-REV-${reviewStore.length}`);
    }
    return { ids };
  },
  exportQuery: async function* () {},
  exportSerialize: (payload: unknown) => ({ module: 'library_reviews', version: 1, payload }),
} as unknown as ImportExportPlugin;

vi.mock('@/core/api/modules/import-export/registry.data.ts', () => ({
  getDataPlugin: async (key: string) => {
    if (key === 'library_items') return fakeBooks;
    if (key === 'library_reviews') return fakeReviews;
    throw new Error(`unknown module ${key}`);
  },
}));

const { restoreEnvelope } = await import('./restore-envelope');

const SLICE = {
  'library-items': { moduleUserId: 'sid-books' },
  'library-reviews': { moduleUserId: 'sid-reviews' },
};
const mainKey = {} as never;
const t = (k: string) => k;

beforeEach(() => {
  bookSeq = 0;
  bookStore.length = 0;
  reviewStore.length = 0;
});

describe('restoreEnvelope — cross-host relational remap (#155)', () => {
  it('rewrites a review itemRid to the parent book new id on a fresh host', async () => {
    const envelope = {
      library_items: [{ title: 'Dune' }],
      library_reviews: [
        { itemRid: 'OLD-BOOK', content: 'great', [PARENT_REF_KEY]: 'book::Dune' },
      ],
    };
    await restoreEnvelope(envelope, mainKey, SLICE, t);

    expect(reviewStore).toHaveLength(1);
    expect(reviewStore[0]!.itemRid).toBe('NEW-BOOK-1'); // relinked, not OLD-BOOK
    expect(PARENT_REF_KEY in reviewStore[0]!).toBe(false); // transient stripped
  });

  it('links children to a parent that already exists on the target (children-only import)', async () => {
    bookStore.push({ id: 'EXISTING-BOOK', key: 'book::Dune' });
    const envelope = {
      library_reviews: [
        { itemRid: 'OLD-BOOK', content: 'great', [PARENT_REF_KEY]: 'book::Dune' },
      ],
    };
    await restoreEnvelope(envelope, mainKey, SLICE, t);
    expect(reviewStore[0]!.itemRid).toBe('EXISTING-BOOK');
  });

  it('keeps a review as an orphan (never drops) + warns when its parent is absent', async () => {
    const envelope = {
      library_reviews: [
        { itemRid: 'OLD-BOOK', content: 'great', [PARENT_REF_KEY]: 'book::Ghost' },
      ],
    };
    const { parts } = await restoreEnvelope(envelope, mainKey, SLICE, t);
    expect(reviewStore).toHaveLength(1);
    expect(reviewStore[0]!.itemRid).toBe('OLD-BOOK'); // original kept
    expect(parts).toContain('account.data.import.orphanedRefs'); // surfaced
  });

  it('is idempotent on a same-host re-import (no duplicate child)', async () => {
    bookStore.push({ id: 'SRV-1', key: 'book::Dune' });
    const envelope = {
      library_items: [{ title: 'Dune' }],
      library_reviews: [
        { itemRid: 'SRV-1', content: 'great', [PARENT_REF_KEY]: 'book::Dune' },
      ],
    };
    await restoreEnvelope(envelope, mainKey, SLICE, t);
    await restoreEnvelope(envelope, mainKey, SLICE, t); // second run
    expect(reviewStore).toHaveLength(1); // not duplicated
    expect(bookStore).toHaveLength(1); // book not re-created
  });

  it('does NOT duplicate or re-parent a child when two parents share a natural key (regression)', async () => {
    // Same host already holds two same-titled books with distinct ids and
    // a review attached to the SECOND one.
    bookStore.push({ id: 'SRV-A', key: 'book::Dune' });
    bookStore.push({ id: 'SRV-B', key: 'book::Dune' });
    reviewStore.push({ itemRid: 'SRV-B', content: 'great' });
    const envelope = {
      library_items: [{ title: 'Dune' }, { title: 'Dune' }],
      library_reviews: [
        { itemRid: 'SRV-B', content: 'great', [PARENT_REF_KEY]: 'book::Dune' },
      ],
    };
    await restoreEnvelope(envelope, mainKey, SLICE, t);
    // Pre-fix: review rewritten SRV-B→SRV-A (first-id-wins) → new dedup key
    // → duplicate (length 2). Fixed: SRV-B is live → kept → dedup skips.
    expect(reviewStore).toHaveLength(1);
    expect(reviewStore[0]!.itemRid).toBe('SRV-B');
  });
});
