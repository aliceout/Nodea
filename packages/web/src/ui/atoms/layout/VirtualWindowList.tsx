/**
 * Window-virtualized list helper (issue #128 — perf bullet).
 *
 * Wraps `@tanstack/react-virtual`'s `useWindowVirtualizer` with the
 * Nodea-specific defaults : a threshold below which we skip
 * virtualization entirely (the DOM cost on a small list is cheaper
 * than the virtualizer overhead and keeps the original layout for
 * free), a sensible overscan, and dynamic item measurement so
 * variable-height rows don't drift.
 *
 * **Why window-virtualized, not container-virtualized.** Every
 * Nodea module's primary column scrolls with the page, not inside a
 * fixed-height overflow container. The page-level scroll is
 * deliberate (sticky headers + keyboard-friendly back/forward,
 * which break with internal scrolls) so the virtualizer follows
 * `window.scrollY` and uses the rendered list's `offsetTop` as the
 * scroll margin to align with the sticky-region above.
 *
 * **Threshold semantics.** While `items.length < threshold` we
 * render the plain `.map()` output (no virtualizer hook mounted at
 * all). Above it, we mount the virtualized variant. The cross-over
 * happens via two distinct child components so React's hook order
 * stays consistent inside each variant ; the parent doesn't break
 * the rules of hooks by toggling. The trade-off : if `items.length`
 * crosses the threshold mid-session the tree resets (briefly losing
 * scroll position), which is acceptable since the only way to push
 * past 100 entries in one render is bulk import — at which point a
 * reset is the expected UX.
 */
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';

interface VirtualWindowListProps<T> {
  items: ReadonlyArray<T>;
  /** Minimum item count below which we skip virtualization and render
   *  the full list as plain `map`. Defaults to 100 — picked so a
   *  typical day-to-day session never pays the virtualizer overhead. */
  threshold?: number;
  /** Rough average row height in pixels. Used as the starting estimate
   *  before items are measured ; tune per-module (Mood/Goals rows are
   *  ~70 px, Journal with attachments ~110 px). */
  estimateRowHeight?: number;
  /** Number of rows to render above/below the visible window. Larger
   *  values hide measurement errors and reduce blank flicker on fast
   *  scroll, at the cost of more DOM work. */
  overscan?: number;
  /** Stable key for each item — same contract as `key` in React.
   *  Crucial for the virtualizer to maintain item identity across
   *  re-orderings (filter changes, sort flips). */
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
}

/** Plain map render — used below the virtualization threshold and
 *  for SSR / first paint where measuring DOM offsets isn't possible. */
function PlainList<T>({
  items,
  getKey,
  renderItem,
}: Pick<VirtualWindowListProps<T>, 'items' | 'getKey' | 'renderItem'>) {
  return (
    <>
      {items.map((it, i) => (
        <div key={getKey(it, i)}>{renderItem(it, i)}</div>
      ))}
    </>
  );
}

/** Virtualized variant — only mounted when above threshold so the
 *  hook is exercised only on the long-list path. */
function VirtualList<T>({
  items,
  estimateRowHeight = 80,
  overscan = 8,
  getKey,
  renderItem,
}: Omit<VirtualWindowListProps<T>, 'threshold'>) {
  const containerRef = useRef<HTMLDivElement>(null);
  // `scrollMargin` tells the window virtualizer where this list starts
  // relative to the document, so items remain correctly aligned with
  // window.scrollY despite the sticky header / page padding above.
  //
  // It needs to live in state — not just read inline from
  // `containerRef.current` — because the ref is `null` on the first
  // render (the DOM node doesn't exist yet). A naive
  // `containerRef.current?.offsetTop ?? 0` locks scrollMargin at 0 for
  // the initial layout pass and never recovers, since the virtualizer
  // re-evaluates the option only on subsequent renders that we have to
  // trigger ourselves. The `useLayoutEffect` below runs after mount
  // and on every layout commit, comparing the freshly-measured
  // `offsetTop` to the cached one ; React bails on the setState when
  // they match so this is stable, and re-fires when the sticky header
  // collapses/expands and the container moves.
  const [scrollMargin, setScrollMargin] = useState(0);
  // Re-measure on every render — the layout effect is intentionally
  // deps-less. eslint suggests `[]` (run once on mount), which would
  // miss the dominant trigger for `offsetTop` changing : a sticky
  // header collapsing or a filter narrowing the rows above the list
  // (both shift the container up the page without unmounting it).
  // The setState callback bails on equal values, so the no-deps
  // effect doesn't spin — it just re-measures cheaply and only
  // commits when the value actually moves.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const top = el.offsetTop;
    setScrollMargin((prev) => (prev !== top ? top : prev));
  });

  // Pre-compute the keys array once per `items` change. Two payoffs :
  //  1. Eliminates the implicit coupling between the virtualizer's
  //     `count` and `items[i]` access. `count` is read from `keys.length`,
  //     and `keys` is `items.map(...)` — so by construction the two
  //     arrays have identical length and a future maintainer can't
  //     change one without changing the other. The whole reason the
  //     audit flagged this file is that the old code used `items[i]!`
  //     and trusted the contract implicitly ; here the relationship is
  //     structural rather than asserted.
  //  2. `getItemKey` doesn't re-call `getKey` for every visible row on
  //     every scroll-induced re-render. With overscan=8 and a 30-row
  //     viewport, that saves ~46 calls per scroll tick.
  const keys = useMemo(
    () => items.map((item, i) => getKey(item, i)),
    [items, getKey],
  );

  const virtualizer = useWindowVirtualizer({
    count: keys.length,
    estimateSize: () => estimateRowHeight,
    overscan,
    scrollMargin,
    // `keys[i]` can only be `undefined` if @tanstack/react-virtual asks
    // for an index >= count, which would be a bug in the library — we
    // hand it a deterministic sentinel rather than throw, so the rest
    // of the list keeps rendering while a future debug session traces
    // the root cause.
    getItemKey: (i) =>
      keys[i] ?? `__VirtualWindowList_oob_${i}`,
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={containerRef}
      style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
    >
      {virtualItems.map((virt) => {
        // Single bounds check per visible row, in the only place that
        // dereferences `items`. If `virt.index` lands outside the array
        // (same impossible-by-construction case as above), we drop the
        // slot rather than crash on a `.id` / `.payload` read inside
        // `renderItem`.
        const item = items[virt.index];
        if (item === undefined) return null;
        return (
          <div
            key={virt.key}
            data-index={virt.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virt.start - scrollMargin}px)`,
            }}
          >
            {renderItem(item, virt.index)}
          </div>
        );
      })}
    </div>
  );
}

export default function VirtualWindowList<T>({
  items,
  threshold = 100,
  estimateRowHeight,
  overscan,
  getKey,
  renderItem,
}: VirtualWindowListProps<T>) {
  if (items.length < threshold) {
    return <PlainList items={items} getKey={getKey} renderItem={renderItem} />;
  }
  // Conditional spread so `exactOptionalPropertyTypes` doesn't bark
  // on a literal `undefined` for the optional props.
  return (
    <VirtualList
      items={items}
      getKey={getKey}
      renderItem={renderItem}
      {...(estimateRowHeight !== undefined ? { estimateRowHeight } : {})}
      {...(overscan !== undefined ? { overscan } : {})}
    />
  );
}
