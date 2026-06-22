import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PARENT_REF_KEY } from '@/core/api/modules/import-export/relink.ts';
import type { ImportExportPlugin } from '@/core/api/modules/import-export/types.ts';

/**
 * Integration guard for the export-side relational stamping (#155): the
 * pass in collect-modules that resolves each child's parent index and
 * stamps the child with the parent's stable content key. Confirms the
 * stamp lands and that a failing parent `listKeyIndex` is non-fatal
 * (children left un-stamped, export still succeeds).
 */

let throwOnIndex = false;

const fakeBooks = {
  meta: { id: 'library_items', runtimeKey: 'library-items' },
  listKeyIndex: async () => {
    if (throwOnIndex) throw new Error('boom');
    return [{ id: 'SRV-1', key: 'book::Dune' }];
  },
  exportQuery: async function* () {
    yield { title: 'Dune' };
  },
} as unknown as ImportExportPlugin;

const fakeReviews = {
  meta: {
    id: 'library_reviews',
    runtimeKey: 'library-reviews',
    parentRef: { field: 'itemRid', parentPlugin: 'library_items' },
  },
  exportQuery: async function* () {
    yield { itemRid: 'SRV-1', content: 'great' };
  },
} as unknown as ImportExportPlugin;

vi.mock('@/core/api/modules/import-export/registry.data.ts', () => ({
  getDataPlugin: async (key: string) => {
    if (key === 'library_items') return fakeBooks;
    if (key === 'library_reviews') return fakeReviews;
    throw new Error(`unknown ${key}`);
  },
  knownModules: () => ['library_items', 'library_reviews'],
}));

const { collectModules } = await import('./collect-modules');

const SLICE = {
  'library-items': { moduleUserId: 'sid-books' },
  'library-reviews': { moduleUserId: 'sid-reviews' },
};
const mainKey = {} as never;

beforeEach(() => {
  throwOnIndex = false;
});

describe('collectModules — export-side relational stamping (#155)', () => {
  it('stamps each child with its parent natural key', async () => {
    const { out, failed } = await collectModules(mainKey, SLICE);
    expect(failed).toEqual([]);
    const reviews = out.library_reviews as Record<string, unknown>[];
    expect(reviews[0]![PARENT_REF_KEY]).toBe('book::Dune');
  });

  it('is non-fatal when the parent listKeyIndex throws (children left un-stamped)', async () => {
    throwOnIndex = true;
    const onModuleError = vi.fn();
    const { out } = await collectModules(mainKey, SLICE, onModuleError);
    const reviews = out.library_reviews as Record<string, unknown>[];
    expect(PARENT_REF_KEY in reviews[0]!).toBe(false); // export still succeeds
    expect(onModuleError).toHaveBeenCalledWith('library_reviews', expect.anything());
  });
});
