/**
 * Versions slice — per-module mutation counters.
 *
 * Bumped after a successful create / update / delete on a given
 * module's collection. Pages include the matching version in their
 * fetch useEffect deps so newly persisted entries appear without a
 * page reload. A lightweight stand-in for TanStack Query's
 * `invalidateQueries` until the workspace adopts it.
 *
 * Sits inside `useNodeaStore` (Zustand slice pattern, see ADR-0013).
 */
import type { StateCreator } from 'zustand';
import type { NodeaState } from '../nodea-store.ts';

export interface VersionsSlice {
  goalsVersion: number;
  bumpGoalsVersion(): void;
  moodVersion: number;
  bumpMoodVersion(): void;
  journalVersion: number;
  bumpJournalVersion(): void;
  libraryItemsVersion: number;
  bumpLibraryItemsVersion(): void;
  libraryReviewsVersion: number;
  bumpLibraryReviewsVersion(): void;
}

export const createVersionsSlice: StateCreator<NodeaState, [], [], VersionsSlice> = (set) => ({
  goalsVersion: 0,
  bumpGoalsVersion: () => set((state) => ({ goalsVersion: state.goalsVersion + 1 })),
  moodVersion: 0,
  bumpMoodVersion: () => set((state) => ({ moodVersion: state.moodVersion + 1 })),
  journalVersion: 0,
  bumpJournalVersion: () =>
    set((state) => ({ journalVersion: state.journalVersion + 1 })),
  libraryItemsVersion: 0,
  bumpLibraryItemsVersion: () =>
    set((state) => ({ libraryItemsVersion: state.libraryItemsVersion + 1 })),
  libraryReviewsVersion: 0,
  bumpLibraryReviewsVersion: () =>
    set((state) => ({ libraryReviewsVersion: state.libraryReviewsVersion + 1 })),
});
