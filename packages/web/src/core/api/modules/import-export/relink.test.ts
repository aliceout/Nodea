/**
 * Unit tests for the pure cross-host relink helpers (#155) — stamp,
 * relink, the id/key index builders, and the storage-boundary strip —
 * in isolation from the API. The orchestration that wires these to real
 * plugins is covered by restore-envelope.test.ts / collect-modules.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  PARENT_REF_KEY,
  idSet,
  indexById,
  indexByKey,
  relinkParentRefs,
  stampParentKeys,
  stripParentRefKey,
} from './relink';
import type { ParentRef } from './types.ts';

const REQUIRED: ParentRef = { field: 'itemRid', parentPlugin: 'library_items' };
const OPTIONAL: ParentRef = {
  field: 'scheduleId',
  parentPlugin: 'hrt_schedules',
  optional: true,
};
const NO_LIVE = new Set<string>();

describe('stampParentKeys (export)', () => {
  it('stamps each child with its parent natural key', () => {
    const children = [
      { itemRid: 'srv-1', content: 'a' },
      { itemRid: 'srv-2', content: 'b' },
    ];
    const idToKey = new Map([
      ['srv-1', 'book::title-x'],
      ['srv-2', 'book::title-y'],
    ]);
    const out = stampParentKeys(children, REQUIRED, idToKey) as Record<
      string,
      unknown
    >[];
    expect(out[0]![PARENT_REF_KEY]).toBe('book::title-x');
    expect(out[1]![PARENT_REF_KEY]).toBe('book::title-y');
    expect(out[0]!.itemRid).toBe('srv-1');
  });

  it('leaves a child untouched when its parent id is unknown (already dangling)', () => {
    const children = [{ itemRid: 'gone', content: 'a' }];
    const out = stampParentKeys(children, REQUIRED, new Map()) as Record<
      string,
      unknown
    >[];
    expect(PARENT_REF_KEY in out[0]!).toBe(false);
  });
});

describe('relinkParentRefs (import)', () => {
  it('rewrites a dangling cross-host ref to the new server id and strips the carried key', () => {
    const children = [{ itemRid: 'OLD', [PARENT_REF_KEY]: 'book::x', c: 1 }];
    const keyToNewId = new Map([['book::x', 'NEW']]);
    const { remapped, unresolved } = relinkParentRefs(
      children,
      REQUIRED,
      keyToNewId,
      NO_LIVE,
    );
    const rec = remapped[0] as Record<string, unknown>;
    expect(rec.itemRid).toBe('NEW');
    expect(PARENT_REF_KEY in rec).toBe(false);
    expect(unresolved).toBe(0);
  });

  it('leaves a ref that already points at a live parent (same-host idempotency, incl. key collision)', () => {
    // Two parents share key 'book::Dune'; indexByKey is first-id-wins
    // (SRV-A), but the child legitimately points at SRV-B which is live.
    const children = [{ itemRid: 'SRV-B', [PARENT_REF_KEY]: 'book::Dune' }];
    const keyToNewId = new Map([['book::Dune', 'SRV-A']]);
    const live = new Set(['SRV-A', 'SRV-B']);
    const { remapped, unresolved } = relinkParentRefs(
      children,
      REQUIRED,
      keyToNewId,
      live,
    );
    // NOT rewritten to the first-id-wins survivor — keeps its true parent.
    expect((remapped[0] as Record<string, unknown>).itemRid).toBe('SRV-B');
    expect(unresolved).toBe(0);
  });

  it('keeps a required ref as an orphan (never drops) when unresolved', () => {
    const children = [{ itemRid: 'OLD', [PARENT_REF_KEY]: 'book::missing' }];
    const { remapped, unresolved } = relinkParentRefs(
      children,
      REQUIRED,
      new Map(),
      NO_LIVE,
    );
    expect(remapped).toHaveLength(1);
    expect((remapped[0] as Record<string, unknown>).itemRid).toBe('OLD');
    expect(unresolved).toBe(1);
  });

  it('clears an optional ref when unresolved', () => {
    const children = [{ scheduleId: 'OLD', [PARENT_REF_KEY]: 'sch::missing' }];
    const { remapped, unresolved } = relinkParentRefs(
      children,
      OPTIONAL,
      new Map(),
      NO_LIVE,
    );
    const rec = remapped[0] as Record<string, unknown>;
    expect('scheduleId' in rec).toBe(false);
    expect(unresolved).toBe(0);
  });

  it('passes a legacy child (no carried key) through unchanged', () => {
    const children = [{ itemRid: 'OLD', c: 1 }];
    const { remapped, unresolved } = relinkParentRefs(
      children,
      REQUIRED,
      new Map([['book::x', 'NEW']]),
      NO_LIVE,
    );
    expect((remapped[0] as Record<string, unknown>).itemRid).toBe('OLD');
    expect(unresolved).toBe(0);
  });

  it('does not mutate the input children', () => {
    const children = [{ itemRid: 'OLD', [PARENT_REF_KEY]: 'book::x' }];
    relinkParentRefs(children, REQUIRED, new Map([['book::x', 'NEW']]), NO_LIVE);
    expect(children[0]).toEqual({ itemRid: 'OLD', [PARENT_REF_KEY]: 'book::x' });
  });
});

describe('index helpers', () => {
  it('indexById keeps every id even on a key collision', () => {
    const pairs = [
      { id: 'a', key: 'dup' },
      { id: 'b', key: 'dup' },
    ];
    const m = indexById(pairs);
    expect(m.get('a')).toBe('dup');
    expect(m.get('b')).toBe('dup');
  });

  it('indexByKey first-id-wins on a key collision', () => {
    const pairs = [
      { id: 'a', key: 'dup' },
      { id: 'b', key: 'dup' },
    ];
    expect(indexByKey(pairs).get('dup')).toBe('a');
  });

  it('idSet collects every parent id', () => {
    const s = idSet([
      { id: 'a', key: 'k1' },
      { id: 'b', key: 'k2' },
    ]);
    expect([...s].sort()).toEqual(['a', 'b']);
  });
});

describe('stripParentRefKey (storage boundary)', () => {
  it('drops the transient key, keeps the rest', () => {
    const out = stripParentRefKey({ a: 1, [PARENT_REF_KEY]: 'x', b: 2 });
    expect(out).toEqual({ a: 1, b: 2 });
  });

  it('returns the input untouched when the key is absent', () => {
    const p = { a: 1 };
    expect(stripParentRefKey(p)).toBe(p);
  });
});
