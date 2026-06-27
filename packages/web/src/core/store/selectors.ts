/**
 * Selectors for `useNodeaStore`. One file so consumers can grep a
 * `select*` name and find both its definition and all the others
 * available — the slice files themselves stay focused on shape +
 * actions.
 *
 * Keep selectors that return primitives (number, boolean, string)
 * rather than ad-hoc objects : Zustand's default `Object.is`
 * comparison would otherwise re-render every subscriber on every
 * store update (see React's "getSnapshot should be cached" warning).
 */
import type { NodeaState } from './nodea-store.ts';

export const selectUser = (s: NodeaState) => s.auth.user;
export const selectAuthStatus = (s: NodeaState) => s.auth.status;
export const selectIsAuthenticated = (s: NodeaState) =>
  s.auth.status === 'authenticated';
export const selectMainKey = (s: NodeaState) => s.crypto.main;
export const selectKeyStatus = (s: NodeaState) => s.crypto.status;
export const selectModules = (s: NodeaState) => s.modules;
export const selectMobileMenuOpen = (s: NodeaState) => s.mobileMenuOpen;
/**
 * Count of currently-enabled modules. Exposed as a primitive (number)
 * rather than an array so the selector returns a stable reference
 * across renders — Zustand's default `Object.is` comparison would
 * otherwise re-render every subscriber on every store update (see
 * React's "getSnapshot should be cached" warning).
 */
export const selectEnabledModuleCount = (s: NodeaState): number => {
  let n = 0;
  for (const key in s.modules) {
    if (s.modules[key]?.enabled) n += 1;
  }
  return n;
};
export const selectPreferences = (s: NodeaState) => s.preferences;
export const selectCurrentModule = (s: NodeaState) => s.flow.currentModule;
export const selectLibrarySubview = (s: NodeaState) => s.flow.librarySubview;
export const selectHrtSubview = (s: NodeaState) => s.flow.hrtSubview;
export const selectBackupProgress = (s: NodeaState) => s.backupProgress;
