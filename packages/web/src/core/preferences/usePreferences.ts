import { useCallback, useEffect } from 'react';
import {
  useNodeaStore,
  selectMainKey,
  selectPreferences,
  selectIsAuthenticated,
} from '@/core/store/nodea-store';
import {
  loadDecryptedPreferences,
  saveEncryptedPreferences,
} from '@/core/api/preferences-client';
import type { UserPreferencesPayload } from '@nodea/shared';

/**
 * Reactive accessor for the encrypted user preferences blob.
 *
 * - Hydrates the Zustand `preferences` slice from `/user-preferences`
 *   as soon as we have both an authenticated session and a main key.
 * - Exposes an imperative `setPreferences(partial)` that merges into
 *   the current preferences and PUTs the re-encrypted envelope.
 * - Swallows transport / decrypt errors — the caller gets the current
 *   (possibly stale) slice instead of a thrown exception.
 *
 * Cross-device sync comes for free: every device loads the same
 * encrypted blob on login, decrypts locally, and writes back on change.
 */
export function usePreferences(): {
  preferences: UserPreferencesPayload;
  setPreferences: (partial: Partial<UserPreferencesPayload>) => Promise<void>;
} {
  const mainKey = useNodeaStore(selectMainKey);
  const isAuth = useNodeaStore(selectIsAuthenticated);
  const preferences = useNodeaStore(selectPreferences);
  const setStore = useNodeaStore((s) => s.setPreferences);
  const update = useNodeaStore((s) => s.updatePreferences);

  // Hydrate when (isAuth, mainKey) becomes truthy. We deliberately do
  // NOT dedup via a `useRef` sentinel: combined with React 18
  // StrictMode's mount → cleanup → mount effect cycle, the sentinel
  // would mark the slot as hydrated on the first (doomed-to-cancel)
  // run and skip the second — leaving the store on its defaults. The
  // effect deps already constrain how often we fetch; a double-fetch
  // in dev is cheap and writes the same value.
  useEffect(() => {
    if (!isAuth || !mainKey) return;
    let cancelled = false;
    loadDecryptedPreferences(mainKey.aesKey)
      .then((p) => {
        if (!cancelled) setStore(p);
      })
      .catch(() => {
        // Stale blob / network blip — keep current in-memory slice.
      });
    return () => {
      cancelled = true;
    };
  }, [isAuth, mainKey, setStore]);

  const setPreferences = useCallback(
    async (partial: Partial<UserPreferencesPayload>): Promise<void> => {
      const next: UserPreferencesPayload = {
        ...useNodeaStore.getState().preferences,
        ...partial,
      };
      update(partial);
      if (!mainKey) return;
      try {
        await saveEncryptedPreferences(mainKey.aesKey, next);
      } catch {
        // Write failed — keep the optimistic state; next reload will
        // re-sync from the server. A toast surface could be added
        // later when the notifications slice wires up UI.
      }
    },
    [mainKey, update],
  );

  return { preferences, setPreferences };
}
