import { useCallback, useEffect, useState } from 'react';
import { applyTheme, watchSystemThemeChanges } from './themeManager.ts';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'nodea:theme';

function readInitial(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // ignore (private mode / storage disabled)
  }
  return 'system';
}

/**
 * Lightweight theme hook — no Zustand, no PB persistence.
 *
 * State lives in `localStorage` (key `nodea:theme`) and is applied to
 * `<html>` via the existing `themeManager`. When the preference is
 * `system`, we subscribe to the OS colour scheme so toggling dark
 * mode at the OS level repaints Nodea without a reload.
 */
export function useTheme(): { theme: ThemePreference; setTheme: (next: ThemePreference) => void } {
  const [theme, setThemeState] = useState<ThemePreference>(readInitial);

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
    if (theme !== 'system') return undefined;
    const unsubscribe = watchSystemThemeChanges(() => applyTheme('system'));
    return unsubscribe as () => void;
  }, [theme]);

  const setTheme = useCallback((next: ThemePreference) => {
    if (next !== 'light' && next !== 'dark' && next !== 'system') return;
    setThemeState(next);
  }, []);

  return { theme, setTheme };
}
