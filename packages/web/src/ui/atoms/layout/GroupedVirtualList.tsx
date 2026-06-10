/**
 * Grouped + window-virtualized list (audit 2026-06 passe 2).
 *
 * The module list surfaces (Journal / Goals / Library) group their
 * entries by thread / status / year and used to mount ONE
 * `VirtualWindowList` PER GROUP. With the 100-item threshold applied
 * per group, a 2000-entry journal split across 25 threads of ~80
 * never crossed the threshold in any single group → nothing was
 * virtualized, 2000 rows (each parsing its markdown + decoding its
 * images) hit the DOM at once. That's the n°1 cause of the « ça rame
 * avec beaucoup de données » report.
 *
 * This atom flattens ALL groups into a single heterogeneous row
 * stream — `{ kind: 'header' } | { kind: 'entry' }` — and hands it to
 * ONE `VirtualWindowList`, so the threshold sees the TOTAL count and
 * the virtualizer mounts only the visible window (~20-30 rows)
 * regardless of how the entries split across groups.
 *
 * Below the threshold it renders the exact same `GroupBlock` +
 * plain-map output as before, so small lists are visually identical
 * and pay zero virtualizer overhead. Only the large-list path
 * changed.
 */
import { useMemo, type ReactNode } from 'react';

import GroupBlock, { type GroupBlockVariant } from '@/ui/dirk/module/GroupBlock';
import VirtualWindowList from '@/ui/atoms/layout/VirtualWindowList';
import { buildGroupRows, type Group } from '@/ui/atoms/layout/group-rows';
import { cn } from '@/lib/utils';

export type { Group };

interface GroupedVirtualListProps<T> {
  groups: ReadonlyArray<Group<T>>;
  getItemKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  /** Singular noun for the group count (« entrée », « objectif »…). */
  countNoun: string;
  variant?: GroupBlockVariant;
  /** Rough entry-row height for the virtualizer's initial estimate. */
  estimateRowHeight?: number;
  /** Total-item count above which the flattened virtualized path
   *  kicks in. Defaults to 100 (same spirit as VirtualWindowList). */
  threshold?: number;
}

/** Standalone group header — the same label/count/hairline bar
 *  `GroupBlock` renders, extracted so it can be a virtualized row.
 *  `first` drops the top margin so the list doesn't start with a gap. */
function GroupHeaderRow({
  label,
  count,
  countNoun,
  variant,
  first,
}: {
  label: string;
  count: number;
  countNoun: string;
  variant: GroupBlockVariant;
  first: boolean;
}) {
  const plural = count !== 1 ? `${countNoun}s` : countNoun;
  const headerClass =
    variant === 'eyebrow'
      ? 'text-[12px] font-semibold uppercase tracking-[0.04em] text-muted'
      : 'text-[15px] font-semibold tracking-[-0.005em] text-ink';
  return (
    <div
      className={cn(
        'mb-2 flex items-baseline justify-between border-b border-hair pb-1.5',
        first ? '' : variant === 'eyebrow' ? 'mt-7' : 'mt-9',
      )}
    >
      <h2 className={headerClass}>{label}</h2>
      <span className="text-[11px] tabular-nums text-muted">
        {count} {plural}
      </span>
    </div>
  );
}

export default function GroupedVirtualList<T>({
  groups,
  getItemKey,
  renderItem,
  countNoun,
  variant = 'subtitle',
  estimateRowHeight = 90,
  threshold = 100,
}: GroupedVirtualListProps<T>) {
  const total = useMemo(
    () => groups.reduce((n, [, items]) => n + items.length, 0),
    [groups],
  );

  // Flat heterogeneous row stream — only built (and only consumed)
  // on the virtualized path. `buildGroupRows` namespaces every key by
  // group index so a cross-group item (multi-thread goal, multi-tag
  // book) doesn't collide with itself once flattened (see group-rows.ts).
  const rows = useMemo(
    () => (total < threshold ? [] : buildGroupRows(groups, getItemKey)),
    [groups, total, threshold, getItemKey],
  );

  // Below threshold : identical to the previous per-group rendering.
  if (total < threshold) {
    return (
      <>
        {groups.map(([label, items]) => (
          <GroupBlock
            key={label}
            label={label}
            count={items.length}
            countNoun={countNoun}
            variant={variant}
            listTag="div"
            className="mb-0"
          >
            {items.map((item) => (
              <div key={getItemKey(item)}>{renderItem(item)}</div>
            ))}
          </GroupBlock>
        ))}
      </>
    );
  }

  return (
    <VirtualWindowList
      items={rows}
      threshold={0}
      estimateRowHeight={estimateRowHeight}
      getKey={(r) => r.key}
      renderItem={(r) =>
        r.kind === 'header' ? (
          <GroupHeaderRow
            label={r.label}
            count={r.count}
            countNoun={countNoun}
            variant={variant}
            first={r.first}
          />
        ) : (
          renderItem(r.item)
        )
      }
    />
  );
}
