import { describe, it, expect } from 'vitest';

import { buildGroupRows, type Group } from './group-rows';

/**
 * Regression guard (audit 2026-06 passe 2 review). The bug : a
 * multi-group item (a goal in several threads, a book under several
 * tags) flattened into one virtualized list produced duplicate row
 * keys, because entry rows were keyed by `getItemKey(item)` alone.
 * The fix namespaces by group index. These tests lock the global
 * uniqueness invariant.
 */

interface Item {
  id: string;
}
const key = (it: Item) => it.id;

describe('buildGroupRows', () => {
  it('keeps every row key unique even when an item spans groups', () => {
    // `a` lives in both « santé » and « sport » — the exact shape Goals
    // thread-grouping and Library tag-grouping produce.
    const shared: Item = { id: 'a' };
    const groups: Group<Item>[] = [
      ['santé', [shared, { id: 'b' }]],
      ['sport', [shared, { id: 'c' }]],
    ];

    const rows = buildGroupRows(groups, key);
    const keys = rows.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);

    // The shared item produced two distinct rows (one per group).
    const sharedRows = rows.filter(
      (r) => r.kind === 'entry' && r.item.id === 'a',
    );
    expect(sharedRows).toHaveLength(2);
  });

  it('emits a header then its entries, with disjoint header/entry keyspaces', () => {
    const groups: Group<Item>[] = [
      ['g0', [{ id: 'x' }]],
      ['g1', [{ id: 'y' }]],
    ];
    const rows = buildGroupRows(groups, key);

    expect(rows.map((r) => r.kind)).toEqual([
      'header',
      'entry',
      'header',
      'entry',
    ]);
    // Header keys are `__h__<n>`, entry keys are `<n>__<id>` — no overlap.
    const headerKeys = rows.filter((r) => r.kind === 'header').map((r) => r.key);
    const entryKeys = rows.filter((r) => r.kind === 'entry').map((r) => r.key);
    expect(headerKeys.every((k) => k.startsWith('__h__'))).toBe(true);
    expect(entryKeys.some((k) => headerKeys.includes(k))).toBe(false);
  });

  it('marks only the first group header as `first`', () => {
    const groups: Group<Item>[] = [
      ['g0', [{ id: 'x' }]],
      ['g1', [{ id: 'y' }]],
    ];
    const headers = buildGroupRows(groups, key).filter(
      (r) => r.kind === 'header',
    );
    expect(headers.map((h) => (h.kind === 'header' ? h.first : null))).toEqual([
      true,
      false,
    ]);
  });
});
