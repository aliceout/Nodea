/**
 * Modules slice — per-module decrypted runtime config.
 *
 * Replaces the legacy `modulesRuntime.js` singleton (was an
 * `useSyncExternalStore` external store). Same data, same shape,
 * same lifecycle — now subscribed via Zustand selectors.
 *
 * Sits inside `useNodeaStore` (Zustand slice pattern, see ADR-0013).
 */
import type { StateCreator } from 'zustand';
import type {
  ModuleRuntimeEntryPayload,
  ModulesRuntimePayload,
} from '@nodea/shared';
import type { NodeaState } from '../nodea-store.ts';

/** Per-module decrypted runtime config (what used to live in
 *  modulesRuntime). Derived from the shared Zod schema
 *  (`ModulesRuntimeSchema`) since audit 2026-06 so the validated
 *  decrypt in `modules-config-client` and the store agree by
 *  construction — single source of truth in `packages/shared`. */
export type ModuleRuntimeEntry = ModuleRuntimeEntryPayload;

export type ModulesRuntime = ModulesRuntimePayload;

export interface ModulesSlice {
  modules: ModulesRuntime;
  /** Monotonic counter bumped by every LOCAL write (`setModules`,
   *  `updateModule`). The async hydration captures it before its GET
   *  and only applies the result if it hasn't advanced — otherwise a
   *  slow first-login hydration that left before the seed could land
   *  its stale/empty config on top of the freshly-seeded one and wipe
   *  the user's modules (audit 2026-06 passe 2, 3.6). The preferences
   *  slice already had this guard ; modules lacked it. */
  modulesWriteSeq: number;
  setModules(next: ModulesRuntime): void;
  updateModule(id: string, partial: Partial<ModuleRuntimeEntry>): void;
  /** Apply a server-fetched config ONLY if no local write happened
   *  since `baselineSeq` was captured. Does not bump the seq (it's a
   *  reconcile-to-server, not a user intent). Returns nothing ; a
   *  skipped apply is the intended no-op. */
  hydrateModules(next: ModulesRuntime, baselineSeq: number): void;
}

export const createModulesSlice: StateCreator<NodeaState, [], [], ModulesSlice> = (set) => ({
  modules: {},
  modulesWriteSeq: 0,
  setModules: (next) =>
    set((state) => ({ modules: next, modulesWriteSeq: state.modulesWriteSeq + 1 })),
  updateModule: (id, partial) =>
    set((state) => ({
      modulesWriteSeq: state.modulesWriteSeq + 1,
      modules: {
        ...state.modules,
        [id]: {
          enabled: state.modules[id]?.enabled ?? false,
          ...state.modules[id],
          ...partial,
        },
      },
    })),
  hydrateModules: (next, baselineSeq) =>
    set((state) =>
      state.modulesWriteSeq === baselineSeq ? { modules: next } : {},
    ),
});
