/**
 * UI slice — purely-visual app-shell state.
 *
 * Currently holds only `mobileMenuOpen` (sidebar drawer flag on
 * narrow viewports). Kept separate from the `flow` slice because
 * this is layout chrome, not content / navigation state.
 *
 * Sits inside `useNodeaStore` (Zustand slice pattern, see ADR-0013).
 */
import type { StateCreator } from 'zustand';
import type { NodeaState } from '../nodea-store.ts';

export interface UiSlice {
  mobileMenuOpen: boolean;
  setMobileMenuOpen(open: boolean): void;
}

export const createUiSlice: StateCreator<NodeaState, [], [], UiSlice> = (set) => ({
  mobileMenuOpen: false,
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
});
