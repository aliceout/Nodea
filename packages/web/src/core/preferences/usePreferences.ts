import { useCallback, useEffect, useRef } from 'react';
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
  const hydrated = useRef<string | null>(null);

  // Hydrate once per (user, key) pair. We dedupe via a ref because
  // `mainKey` is a deep object and React re-renders would loop us.
  useEffect(() => {
    if (!isAuth || !mainKey) return;
    const stamp = `${mainKey.aesKey ? 'k' : ''}`;
    if (hydrated.current === stamp) return;
    hydrated.current = stamp;
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

  // Reset hydration when the session goes away so a later login re-hydrates.
  useEffect(() => {
    if (!isAuth) hydrated.current = null;
  }, [isAuth]);

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
