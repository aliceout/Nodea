import { useCallback, useEffect } from 'react';

import { usePreferences } from '@/core/auth/use-preferences';
import type { BackgroundShade, BackgroundShadeDark } from '@nodea/shared';

import {
  applyBackgroundShade,
  applyDarkBackgroundShade,
  BACKGROUND_SHADE_VALUES,
  BACKGROUND_SHADE_DARK_VALUES,
} from './themeManager.ts';

export type { BackgroundShade, BackgroundShadeDark };

const STORAGE_KEY = 'nodea:bg-shade';
const DARK_STORAGE_KEY = 'nodea:bg-shade-dark';
const DEFAULT_SHADE: BackgroundShade = 'cream';
const DEFAULT_DARK_SHADE: BackgroundShadeDark = 'graphite';

function isShade(v: unknown): v is BackgroundShade {
  return (
    typeof v === 'string' &&
    BACKGROUND_SHADE_VALUES.includes(v as BackgroundShade)
  );
}

function isDarkShade(v: unknown): v is BackgroundShadeDark {
  return (
    typeof v === 'string' &&
    BACKGROUND_SHADE_DARK_VALUES.includes(v as BackgroundShadeDark)
  );
}

function readCache<T>(key: string, guard: (v: unknown) => v is T, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = window.localStorage.getItem(key);
    if (guard(v)) return v;
  } catch {
    // storage disabled (private mode) — fall through
  }
  return fallback;
}

function writeCache(key: string, next: string): void {
  try {
    window.localStorage.setItem(key, next);
  } catch {
    // ignore
  }
}

/**
 * Background-shade hook, backed by the encrypted user-preferences blob.
 *
 * Authority chain mirrors `useTheme()` :
 *   1. The server-synced `preferences.backgroundShade(Dark)` (decrypted
 *      into the Zustand slice) wins once the user is authenticated.
 *   2. `localStorage` is a local cache so the initial paint and any
 *      logged-out browsing don't flash the default surface before the
 *      encrypted blob loads.
 *
 * Light and dark are two INDEPENDENT picks (`backgroundShade` +
 * `backgroundShadeDark`), persisted separately so flipping the theme
 * never overwrites the other. `themeManager` writes each onto its own
 * `<html>` attribute (`data-bg-shade` / `data-bg-shade-dark`) and
 * `dirk.css` keys per-shade overrides on them — only the attribute
 * matching the resolved theme actually paints (the cascade handles it,
 * so we apply both unconditionally here, no runtime theme check).
 */
export function useBackgroundShade(): {
  shade: BackgroundShade;
  setShade: (next: BackgroundShade) => void;
  darkShade: BackgroundShadeDark;
  setDarkShade: (next: BackgroundShadeDark) => void;
} {
  const { preferences, setPreferences } = usePreferences();

  const shade: BackgroundShade = isShade(preferences.backgroundShade)
    ? preferences.backgroundShade
    : readCache(STORAGE_KEY, isShade, DEFAULT_SHADE);
  const darkShade: BackgroundShadeDark = isDarkShade(
    preferences.backgroundShadeDark,
  )
    ? preferences.backgroundShadeDark
    : readCache(DARK_STORAGE_KEY, isDarkShade, DEFAULT_DARK_SHADE);

  useEffect(() => {
    applyBackgroundShade(shade);
    writeCache(STORAGE_KEY, shade);
  }, [shade]);

  useEffect(() => {
    applyDarkBackgroundShade(darkShade);
    writeCache(DARK_STORAGE_KEY, darkShade);
  }, [darkShade]);

  const setShade = useCallback(
    (next: BackgroundShade) => {
      if (!isShade(next)) return;
      writeCache(STORAGE_KEY, next);
      applyBackgroundShade(next);
      // Fire-and-forget: usePreferences handles the encrypted PUT + store update.
      void setPreferences({ backgroundShade: next });
    },
    [setPreferences],
  );

  const setDarkShade = useCallback(
    (next: BackgroundShadeDark) => {
      if (!isDarkShade(next)) return;
      writeCache(DARK_STORAGE_KEY, next);
      applyDarkBackgroundShade(next);
      void setPreferences({ backgroundShadeDark: next });
    },
    [setPreferences],
  );

  return { shade, setShade, darkShade, setDarkShade };
}
