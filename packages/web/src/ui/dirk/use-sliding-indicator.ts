import { useLayoutEffect, useRef, useState } from 'react';

export interface IndicatorRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface IndicatorState {
  rect: IndicatorRect;
  /** Whether THIS placement should animate. True only when the active
   *  element changed (a real tab/module switch); false for the first
   *  placement and for pure relayout / resize re-measures — so the
   *  highlight snaps instead of trailing, e.g. the sidebar's collapse
   *  width animation (which also reflows row heights). */
  animate: boolean;
}

/**
 * Measures the active child inside a container so a single shared indicator
 * can glide to it — the "sliding tab / nav highlight" pattern, shared by
 * `Tabs` (horizontal pill) and `SidebarNav` (vertical module highlight).
 *
 * Returns a ref for the container and an `{ rect, animate }` state (null
 * until the first measure). Consumers transition only when `animate` is
 * true; snap otherwise. Do that by toggling transition DURATION (keep the
 * `transition-property` always set) so a switch never relies on a
 * same-frame transition being added.
 *
 * Re-measures whenever `activeKey` or `layoutSignal` changes, and on
 * container resize (a `ResizeObserver`). `activeKey` is the active id alone
 * (its change is what animates); `layoutSignal` is everything else that can
 * move things without a switch (item list, collapsed/drawer mode, locale
 * label widths) — those snap. `selector` locates the active element; pass
 * `''` to disable.
 *
 * SPA-only: `useLayoutEffect` measures before paint, so there's no flash of
 * an unpositioned indicator, and no SSR to trip the layout-effect warning.
 */
export function useSlidingIndicator(
  activeKey: string,
  layoutSignal: unknown,
  selector: string,
) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<IndicatorState | null>(null);
  // Trails the committed active id so a re-measure can tell a switch (animate)
  // from a relayout/resize (snap). `null` until the first placement.
  const prevActive = useRef<string | null>(null);

  useLayoutEffect(() => {
    const list = ref.current;
    if (!list || !selector) return;
    const switched = prevActive.current !== null && prevActive.current !== activeKey;
    prevActive.current = activeKey;
    const measure = (animate: boolean): void => {
      const el = list.querySelector<HTMLElement>(selector);
      if (!el) {
        // No active element — e.g. the sidebar nav while on a non-module
        // page (Settings / Admin set `current` to 'account' / 'admin',
        // which match no nav button). Hide the indicator instead of
        // stranding it on the previously-active item.
        setState(null);
        return;
      }
      setState({
        rect: {
          left: el.offsetLeft,
          top: el.offsetTop,
          width: el.offsetWidth,
          height: el.offsetHeight,
        },
        animate,
      });
    };
    measure(switched);
    // Resize re-measures always snap — track the container, don't trail it.
    const ro = new ResizeObserver(() => measure(false));
    ro.observe(list);
    return () => ro.disconnect();
  }, [activeKey, layoutSignal, selector]);

  return { ref, state };
}
