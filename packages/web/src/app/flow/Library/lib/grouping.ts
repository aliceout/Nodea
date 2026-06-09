import {
  LIBRARY_STATUS_VALUES,
  type LibraryStatus,
} from '@nodea/shared';

import type { LibraryGroup, LibraryItem, TranslateFn } from './types';

/**
 * Five grouping axes : status (the historical default, ordered by
 * reading flow — en cours → à lire → terminés → abandonnés), and
 * five metadata-driven ones (author, year, tag, publisher,
 * collection). All produce `LibraryGroup[]` so `<GroupBlock>`
 * doesn't have to branch on the active axis.
 *
 * Tag grouping is the only one where a single book lands in
 * multiple groups (a book tagged `classique, roman` shows in both
 * sections). That's intentional — the user reads the page to scan
 * « what do I have in this category », not « what's the canonical
 * home for this book ». For the others a book has at most one
 * value per axis, so each book appears once.
 */

export const LIBRARY_GROUP_BY_VALUES = [
  'status',
  'author',
  'year',
  'tag',
  'publisher',
  'collection',
] as const;
export type LibraryGroupBy = (typeof LIBRARY_GROUP_BY_VALUES)[number];

const STATUS_GROUP_ORDER: readonly LibraryStatus[] = [
  'in_progress',
  'planned',
  'finished',
  'abandoned',
];

/**
 * Build the rendered groups. Group headers that are UI copy (the
 * status names, the « no value » bucket) resolve through the
 * caller-provided `t` — the i18n hook can't be called here because
 * this stays a pure, hook-free function (tested with a stub `t`).
 */
export function buildGroups(
  items: readonly LibraryItem[],
  groupBy: LibraryGroupBy,
  t: TranslateFn,
): LibraryGroup[] {
  if (groupBy === 'status') {
    const map = new Map<LibraryStatus, LibraryItem[]>();
    for (const status of LIBRARY_STATUS_VALUES) map.set(status, []);
    for (const it of items) (map.get(it.status) ?? []).push(it);
    for (const [, list] of map) {
      list.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
    }
    return STATUS_GROUP_ORDER.map(
      (s): LibraryGroup => ({
        key: s,
        label: t(`library.statusGroup.${s}`),
        items: map.get(s) ?? [],
      }),
    );
  }

  // Metadata-driven groupings : walk the items, key on the chosen
  // axis, alphabetical bucket order. The « no value » bucket goes
  // last so the populated groups stay at the top of the page.
  const buckets = new Map<string, LibraryItem[]>();
  const noValueBucket: LibraryItem[] = [];
  for (const it of items) {
    const keys = groupKeysFor(it, groupBy);
    if (keys.length === 0) {
      noValueBucket.push(it);
      continue;
    }
    for (const k of keys) {
      const list = buckets.get(k);
      if (list) list.push(it);
      else buckets.set(k, [it]);
    }
  }
  // Year buckets sort newest-first (a 2024 read above a 1956
  // classic reads more naturally than the other way around) ;
  // every other axis stays alphabetical.
  const sortedKeys = Array.from(buckets.keys()).sort((a, b) =>
    groupBy === 'year' ? b.localeCompare(a) : a.localeCompare(b, 'fr'),
  );
  const groups: LibraryGroup[] = sortedKeys.map((k): LibraryGroup => {
    const list = buckets.get(k) ?? [];
    list.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
    return { key: k, label: k, items: list };
  });
  if (noValueBucket.length > 0) {
    noValueBucket.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
    groups.push({
      key: '__none__',
      label: t(`library.groupNone.${groupBy}`),
      items: noValueBucket,
    });
  }
  return groups;
}

/**
 * Per-axis keys for a single item. A book can land in zero (no
 * value), one (author / year / publisher / collection), or many
 * (every tag) buckets. Empty strings are filtered out so blank
 * values don't create their own ghost bucket.
 */
export function groupKeysFor(
  item: LibraryItem,
  groupBy: Exclude<LibraryGroupBy, 'status'>,
): string[] {
  switch (groupBy) {
    case 'author': {
      const name = item.creators?.[0]?.name?.trim() ?? '';
      return name ? [name] : [];
    }
    case 'year': {
      return item.year != null ? [String(item.year)] : [];
    }
    case 'tag': {
      return (item.tags ?? []).map((t) => t.trim()).filter(Boolean);
    }
    case 'publisher': {
      const p = item.publisher?.trim() ?? '';
      return p ? [p] : [];
    }
    case 'collection': {
      const c = item.collection?.trim() ?? '';
      return c ? [c] : [];
    }
  }
}
