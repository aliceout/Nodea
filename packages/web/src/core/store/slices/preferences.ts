/**
 * Preferences slice — E2E-encrypted user preferences blob.
 *
 * Synced via `/user-preferences`. Decrypted into the store on app
 * boot, mutated locally, re-encrypted and pushed back on save.
 *
 * Sits inside `useNodeaStore` (Zustand slice pattern, see ADR-0013).
 */
import type { StateCreator } from 'zustand';
import type { UserPreferencesPayload } from '@nodea/shared';
import type { NodeaState } from '../nodea-store.ts';

export interface PreferencesSlice {
  preferences: UserPreferencesPayload;
  setPreferences(next: UserPreferencesPayload): void;
  updatePreferences(partial: Partial<UserPreferencesPayload>): void;
}

export const createPreferencesSlice: StateCreator<NodeaState, [], [], PreferencesSlice> = (
  set,
) => ({
  preferences: {},
  setPreferences: (next) => set({ preferences: next }),
  updatePreferences: (partial) =>
    set((state) => ({ preferences: { ...state.preferences, ...partial } })),
});
