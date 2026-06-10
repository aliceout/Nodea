import { useEffect } from 'react';
import {
  useNodeaStore,
  selectMainKey,
  selectIsAuthenticated,
} from '@/core/store/nodea-store';
import { loadDecryptedModulesConfig } from '@/core/api/modules-config-client';

/**
 * Hydrate the Zustand `modules` slice from the encrypted
 * `modules_config` blob as soon as we have both an authenticated
 * session and a main key.
 *
 * Historically this only ran inside `ModulesManager` (Settings page),
 * so anything else that relied on the modules runtime — notably the
 * Homepage quick-actions — rendered a stale/empty slice until the
 * user happened to open Settings. Mounting this hook in `Layout`
 * closes that gap.
 *
 * We deliberately do NOT dedup via a `useRef` sentinel. Combined with
 * React 18 StrictMode's intentional mount → cleanup → mount effect
 * cycle, the sentinel pattern would mark the slot as "hydrated" on
 * the first (doomed-to-be-cancelled) run, then skip the second run —
 * leaving the store empty. The effect deps (`isAuth`, `mainKey`)
 * already constrain how often we fetch; a double-fetch in dev is
 * cheap and always writes the same value.
 */
export function useModulesHydration(): void {
  const mainKey = useNodeaStore(selectMainKey);
  const isAuth = useNodeaStore(selectIsAuthenticated);
  const setModules = useNodeaStore((s) => s.setModules);

  useEffect(() => {
    if (!isAuth || !mainKey) return;
    let cancelled = false;
    loadDecryptedModulesConfig(mainKey.aesKey)
      .then((runtime) => {
        // `null` = blob present but unreadable (audit 2026-06 passe
        // 2). Do NOT push it into the store : keep whatever's there
        // (defaults). `ModulesManager` re-reads + refuses to write on
        // a null read, so the unreadable blob is never overwritten.
        if (!cancelled && runtime !== null) setModules(runtime);
      })
      .catch((err: unknown) => {
        if (import.meta.env.DEV) {
          console.warn('[useModulesHydration] load failed', err);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isAuth, mainKey, setModules]);
}
