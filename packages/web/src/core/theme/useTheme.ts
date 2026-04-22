import { useCallback, useEffect } from 'react';
import { applyTheme, watchSystemThemeChanges } from './themeManager.ts';
import { usePreferences } from '@/core/preferences/usePreferences';
import type { ThemePreference } from '@nodea/shared';

export type { ThemePreference };

const STORAGE_KEY = 'nodea:theme';

function isTheme(v: unknown): v is ThemePreference {
  return v === 'light' || v === 'dark' || v === 'system';
}

function readCache(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (isTheme(v)) return v;
  } catch {
    // storage disabled (private mode) — fall through
  }
  return 'system';
}

function writeCache(next: ThemePreference): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // ignore
  }
}

/**
 * Theme hook, backed by the encrypted user-preferences blob.
 *
 * Authority chain:
 *   1. The server-synced `preferences.theme` (decrypted into the
 *      Zustand slice) wins once the user is authenticated and their
 *      main key is derived.
 *   2. `localStorage` ("nodea:theme") is a local cache so the initial
 *      paint (pre-React) and any logged-out browsing don't flash the
 *      wrong palette. It is NOT the source of truth.
 *
 * When the user toggles the theme, we write to both the encrypted blob
 * (cross-device) AND the local cache (next cold start). The sync is
 * debounced by `usePreferences` so rapid clicks collapse to a single
 * PUT.
 */
export function useTheme(): { theme: ThemePreference; setTheme: (next: ThemePreference) => void } {
  const { preferences, setPreferences } = usePreferences();
  const theme: ThemePreference = isTheme(preferences.theme) ? preferences.theme : readCache();

  useEffect(() => {
    applyTheme(theme);
    writeCache(theme);
    if (theme !== 'system') return undefined;
    const unsubscribe = watchSystemThemeChanges(() => applyTheme('system'));
    return unsubscribe as () => void;
  }, [theme]);

  const setTheme = useCallback(
    (next: ThemePreference) => {
      if (!isTheme(next)) return;
      writeCache(next);
      applyTheme(next);
      // Fire-and-forget: usePreferences handles the encrypted PUT + store update.
      void setPreferences({ theme: next });
    },
    [setPreferences],
  );

  return { theme, setTheme };
}
