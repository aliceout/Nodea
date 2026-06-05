import { useCallback, useEffect } from 'react';

import { usePreferences } from '@/core/auth/use-preferences';
import type { BackgroundShade } from '@nodea/shared';

import {
  applyBackgroundShade,
  BACKGROUND_SHADE_VALUES,
} from './themeManager.ts';

export type { BackgroundShade };

const STORAGE_KEY = 'nodea:bg-shade';
const DEFAULT_SHADE: BackgroundShade = 'cream';

function isShade(v: unknown): v is BackgroundShade {
  return (
    typeof v === 'string' &&
    BACKGROUND_SHADE_VALUES.includes(v as BackgroundShade)
  );
}

function readCache(): BackgroundShade {
  if (typeof window === 'undefined') return DEFAULT_SHADE;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (isShade(v)) return v;
  } catch {
    // storage disabled (private mode) — fall through
  }
  return DEFAULT_SHADE;
}

function writeCache(next: BackgroundShade): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // ignore
  }
}

/**
 * Background-shade hook, backed by the encrypted user-preferences blob.
 *
 * Authority chain mirrors `useTheme()` :
 *   1. The server-synced `preferences.backgroundShade` (decrypted into
 *      the Zustand slice) wins once the user is authenticated.
 *   2. `localStorage` ("nodea:bg-shade") is a local cache so the
 *      initial paint and any logged-out browsing don't flash the
 *      default surface before the encrypted blob loads.
 *
 * Light-mode only — `themeManager.applyBackgroundShade` writes to
 * `<html>`'s `data-bg-shade`, and `dirk.css` keys per-shade overrides
 * on that attribute. The `.dark[data-bg-shade]` rule in `dirk.css`
 * neutralises the attribute when dark mode is active, so we don't
 * need a runtime check here — the shade selection persists across
 * a temporary trip into dark mode and re-takes effect when the user
 * comes back to light.
 */
export function useBackgroundShade(): {
  shade: BackgroundShade;
  setShade: (next: BackgroundShade) => void;
} {
  const { preferences, setPreferences } = usePreferences();
  const shade: BackgroundShade = isShade(preferences.backgroundShade)
    ? preferences.backgroundShade
    : readCache();

  useEffect(() => {
    applyBackgroundShade(shade);
    writeCache(shade);
  }, [shade]);

  const setShade = useCallback(
    (next: BackgroundShade) => {
      if (!isShade(next)) return;
      writeCache(next);
      applyBackgroundShade(next);
      // Fire-and-forget: usePreferences handles the encrypted PUT + store update.
      void setPreferences({ backgroundShade: next });
    },
    [setPreferences],
  );

  return { shade, setShade };
}
