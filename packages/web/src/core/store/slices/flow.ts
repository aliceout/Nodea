/**
 * Flow slice — current module + library sub-view, with the
 * popstate-aware `setModule` that keeps the URL frozen at `/flow`.
 *
 * Privacy invariant : no module-visited / sub-view metadata leaks
 * through Nginx access logs, Hono/Pino request logs, or browser
 * referrers. The browser history API still tracks navigation, with
 * `nodeaModule` in the entry's state payload — useful for the back
 * button without revealing anything in the URL or sent to the server.
 *
 * Sits inside `useNodeaStore` (Zustand slice pattern, see ADR-0013).
 */
import type { StateCreator } from 'zustand';
import type { ModuleId } from '@nodea/shared';
import type { NodeaState } from '../nodea-store.ts';

/**
 * Library has three lenses on the same encrypted catalogue : the
 * books themselves, the highlighted extracts, the freeform notes.
 * The active lens used to live in the URL (`?subview=`) — moved
 * here as part of the `/flow` URL-freezing rework so the server
 * never sees which sub-page the user is on.
 */
export const LIBRARY_SUBVIEWS = ['livres', 'extraits', 'notes'] as const;
export type LibrarySubview = (typeof LIBRARY_SUBVIEWS)[number];

export function isLibrarySubview(value: unknown): value is LibrarySubview {
  return (
    typeof value === 'string' && (LIBRARY_SUBVIEWS as readonly string[]).includes(value)
  );
}

/**
 * HRT has four lenses on the same encrypted data : the `summary`
 * landing (read-only dashboard + the product catalog it absorbed), the
 * administration log (`administration` — each dose/injection, timed),
 * the lab results with their chart (`labs`), and a printable doctor
 * `export` (regimen + doses + analyses recap). `summary` is the
 * default. Same privacy contract as Library : the active lens lives
 * here, never in the URL.
 */
export const HRT_SUBVIEWS = ['summary', 'administration', 'labs', 'export'] as const;
export type HrtSubview = (typeof HRT_SUBVIEWS)[number];

export function isHrtSubview(value: unknown): value is HrtSubview {
  return (
    typeof value === 'string' && (HRT_SUBVIEWS as readonly string[]).includes(value)
  );
}

export interface FlowSlice {
  flow: {
    currentModule: ModuleId;
    librarySubview: LibrarySubview;
    hrtSubview: HrtSubview;
  };
  /**
   * Imperative module switch. Pushes a new browser history entry so the
   * back button works, then updates the store. No-op if the target is
   * already the current module (avoids polluting the back-stack with
   * duplicates when the same sidebar item is clicked twice).
   */
  setModule(id: ModuleId): void;
  /**
   * Internal — called by the popstate listener when the user hits
   * back/forward. Updates the store WITHOUT calling `pushState`,
   * otherwise we'd corrupt the very history we're responding to.
   */
  syncCurrentModule(id: ModuleId): void;
  setLibrarySubview(sub: LibrarySubview): void;
  setHrtSubview(sub: HrtSubview): void;
}

export const initialFlow: FlowSlice['flow'] = {
  currentModule: 'home',
  librarySubview: 'livres',
  hrtSubview: 'summary',
};

export const createFlowSlice: StateCreator<NodeaState, [], [], FlowSlice> = (set, get) => ({
  flow: initialFlow,
  setModule: (id) => {
    const current = get().flow.currentModule;
    if (current === id) return;
    if (typeof window !== 'undefined') {
      // Stamp the current scrollY onto the entry we're about to
      // leave so back-navigation can restore the user's position
      // (FRONT-06). Without this, the browser snaps to the top when
      // we pushState — the new entry has no scroll memory of its
      // own. We `replaceState` first to add `scrollY` to the
      // outgoing entry, then `pushState` the new module entry at
      // top.
      const currentState =
        (window.history.state as { nodeaModule?: unknown } | null) ?? {};
      window.history.replaceState(
        { ...currentState, scrollY: window.scrollY },
        '',
      );
      window.history.pushState({ nodeaModule: id, scrollY: 0 }, '', '/flow');
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    set((state) => ({ flow: { ...state.flow, currentModule: id } }));
  },
  syncCurrentModule: (id) =>
    set((state) => ({ flow: { ...state.flow, currentModule: id } })),
  setLibrarySubview: (sub) =>
    set((state) => ({ flow: { ...state.flow, librarySubview: sub } })),
  setHrtSubview: (sub) =>
    set((state) => ({ flow: { ...state.flow, hrtSubview: sub } })),
});
