import { useCallback, useState } from 'react';

const KEY = 'nodea:sidebar-collapsed';

/**
 * Persisted collapse state for the DESKTOP left sidebar — the user's
 * choice between the full 240 px sidebar and the 68 px icon rail on
 * `lg+`. (Below `lg` the rail is forced by layout — `md`–`lg` has no
 * room for the full column — and the phone keeps the drawer, so this
 * flag only matters on `lg+`.)
 *
 * Stored in `localStorage`, NOT the encrypted preferences blob: it is a
 * cosmetic, non-sensitive UI toggle (it reveals nothing about the user's
 * data or which modules they use), and keeping it out of the prefs blob
 * avoids coupling to the encrypted-prefs sync lifecycle. The `try/catch`
 * tolerates private-mode storage throwing.
 */
export function useSidebarCollapsed(): readonly [boolean, () => void] {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(KEY, next ? '1' : '0');
      } catch {
        // private mode / storage disabled — the toggle still works for
        // this session, it just won't be remembered. Acceptable.
      }
      return next;
    });
  }, []);

  return [collapsed, toggle] as const;
}
