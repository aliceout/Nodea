/**
 * Nodea's single application store (Zustand).
 *
 * One `create()` call, eight slice creators spread across
 * `./slices/*.ts`. The slice pattern keeps the file ceiling honest
 * (factor-early rule) without giving up the atomicity guarantees
 * documented in ADR-0006 — every slice still shares the same `set`
 * so multi-slice mutations are a single render. The split is
 * acted in ADR-0013 as a complement to ADR-0006.
 *
 * Public surface : every consumer imports from
 * `@/core/store/nodea-store` and that path re-exports the
 * full surface (slice types, selectors, module-id helpers).
 */
import { create } from 'zustand';
import {
  MODULE_IDS,
  DATA_MODULE_IDS,
  isModuleId,
  isDataModuleId,
  type DataModuleId,
  type ModuleId,
} from '@nodea/shared';

import { createAuthSlice, loggedOutAuth, type AuthSlice } from './slices/auth.ts';
import { createCryptoSlice, emptyCrypto, type CryptoSlice } from './slices/crypto.ts';
import { createModulesSlice, type ModulesSlice } from './slices/modules.ts';
import {
  createPreferencesSlice,
  type PreferencesSlice,
} from './slices/preferences.ts';
import {
  createNotificationsSlice,
  type NotificationsSlice,
} from './slices/notifications.ts';
import { createUiSlice, type UiSlice } from './slices/ui.ts';
import { createFlowSlice, initialFlow, type FlowSlice } from './slices/flow.ts';
import { createVersionsSlice, type VersionsSlice } from './slices/versions.ts';

// --- Re-exports : public surface preserved for ~30 consumers ---

// Re-export the module-id surface for backward compat with the
// existing `@/core/store/nodea-store` consumers (`App.tsx`,
// `SidebarNav.tsx`, etc.). Single source lives in
// `@nodea/shared/module-ids` so the api seed orchestrator types
// its `ensureModuleUserId(moduleId, …)` arg against the same union.
export { MODULE_IDS, DATA_MODULE_IDS, isModuleId, isDataModuleId };
export type { ModuleId, DataModuleId };

// Slice types + ancillary types/constants/type-guards.
export type { AuthStatus, SessionUser } from './slices/auth.ts';
export type { KeyStatus } from './slices/crypto.ts';
export type { ModuleRuntimeEntry, ModulesRuntime } from './slices/modules.ts';
export type { ToastNotification } from './slices/notifications.ts';
export {
  LIBRARY_SUBVIEWS,
  isLibrarySubview,
  type LibrarySubview,
  HRT_SUBVIEWS,
  isHrtSubview,
  type HrtSubview,
} from './slices/flow.ts';
// Selectors live in their own file but ship from this barrel so
// existing consumers (`useNodeaStore, selectUser`-style imports)
// keep working unchanged.
export {
  selectUser,
  selectAuthStatus,
  selectIsAuthenticated,
  selectMainKey,
  selectKeyStatus,
  selectModules,
  selectMobileMenuOpen,
  selectEnabledModuleCount,
  selectPreferences,
  selectCurrentModule,
  selectLibrarySubview,
  selectHrtSubview,
} from './selectors.ts';

/**
 * The full store shape — union of every slice + the cross-slice
 * `resetAll` action. Each slice creator is typed against
 * `NodeaState` (not its own slice) so it can `get()` other slices
 * if needed (rarely).
 */
export interface NodeaState
  extends AuthSlice,
    CryptoSlice,
    ModulesSlice,
    PreferencesSlice,
    NotificationsSlice,
    UiSlice,
    FlowSlice,
    VersionsSlice {
  /**
   * Atomic logout reset — flips every slice back to its post-login
   * baseline in a single `set()` call. Atomicity matters here :
   * leaving e.g. `crypto.main` set after `auth` has been cleared
   * would create a brief window where the app appears logged-out
   * but still holds key material. ADR-0006 made this the reason
   * the store stays mono-instance; ADR-0013 keeps that guarantee.
   */
  resetAll(): void;
}

export const useNodeaStore = create<NodeaState>()((...a) => {
  const [set] = a;
  return {
    ...createAuthSlice(...a),
    ...createCryptoSlice(...a),
    ...createModulesSlice(...a),
    ...createPreferencesSlice(...a),
    ...createNotificationsSlice(...a),
    ...createUiSlice(...a),
    ...createFlowSlice(...a),
    ...createVersionsSlice(...a),

    resetAll: () =>
      set({
        auth: loggedOutAuth,
        crypto: emptyCrypto,
        modules: {},
        preferences: {},
        notifications: [],
        mobileMenuOpen: false,
        flow: initialFlow,
        goalsVersion: 0,
        moodVersion: 0,
        journalVersion: 0,
        libraryItemsVersion: 0,
        libraryReviewsVersion: 0,
      }),
  };
});
