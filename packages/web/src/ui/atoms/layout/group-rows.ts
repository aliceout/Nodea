/**
 * Pure row-flattening for `GroupedVirtualList` (audit 2026-06 passe 2
 * review). Splitting it out of the component keeps the keying
 * invariant unit-testable without a DOM, and keeps the `.tsx` free of
 * a non-component export (`react-refresh/only-export-components`).
 *
 * The invariant that MATTERS here : once every group is flattened into
 * a single virtualized list, every row key must be globally unique.
 * The same item can legitimately belong to several groups (a
 * multi-thread goal, a multi-tag / multi-author book), so keying an
 * entry row by `getItemKey(item)` alone produced duplicate React /
 * virtualizer keys at scale. Keying by GROUP INDEX + item key keeps
 * each (group, item) row uniquely identified regardless of label or id
 * contents, and keeps the header keyspace (`__h__<n>`) disjoint from
 * the entry keyspace (`<n>__<id>`).
 */

/** One group : a label + its items, in display order. */
export type Group<T> = readonly [label: string, items: T[]];

export type GroupRow<T> =
  | { kind: 'header'; key: string; label: string; first: boolean }
  | { kind: 'entry'; key: string; item: T; lastInGroup: boolean };

/** Flatten grouped items into the heterogeneous header/entry row
 *  stream the virtualized path renders. Group index `g` namespaces
 *  every key so a cross-group item never collides with itself. */
export function buildGroupRows<T>(
  groups: ReadonlyArray<Group<T>>,
  getItemKey: (item: T) => string,
): GroupRow<T>[] {
  const out: GroupRow<T>[] = [];
  let g = 0;
  for (const [label, items] of groups) {
    out.push({
      kind: 'header',
      key: `__h__${g}`,
      label,
      first: g === 0,
    });
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i]!;
      out.push({
        kind: 'entry',
        key: `${g}__${getItemKey(item)}`,
        item,
        lastInGroup: i === items.length - 1,
      });
    }
    g += 1;
  }
  return out;
}
