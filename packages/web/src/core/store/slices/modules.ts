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
import type { NodeaState } from '../nodea-store.ts';

/** Per-module decrypted runtime config (what used to live in modulesRuntime). */
export interface ModuleRuntimeEntry {
  enabled: boolean;
  moduleUserId?: string;
  deleteSecret?: string;
  algo?: string;
}

export type ModulesRuntime = Record<string, ModuleRuntimeEntry>;

export interface ModulesSlice {
  modules: ModulesRuntime;
  setModules(next: ModulesRuntime): void;
  updateModule(id: string, partial: Partial<ModuleRuntimeEntry>): void;
}

export const createModulesSlice: StateCreator<NodeaState, [], [], ModulesSlice> = (set) => ({
  modules: {},
  setModules: (next) => set({ modules: next }),
  updateModule: (id, partial) =>
    set((state) => ({
      modules: {
        ...state.modules,
        [id]: {
          enabled: state.modules[id]?.enabled ?? false,
          ...state.modules[id],
          ...partial,
        },
      },
    })),
});
