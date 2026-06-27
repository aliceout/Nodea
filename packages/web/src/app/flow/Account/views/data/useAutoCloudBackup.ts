/**
 * Auto cloud backup — on unlock, push a fresh `.age` if the last one is stale.
 *
 * WHERE Mounted once in `Layout` (the unlocked /flow shell), beside the other
 * session-lifecycle hooks. It can't live in `core/` because it drives the
 * app-layer `pushBackupToCloud`; it sits next to that orchestrator.
 *
 * WHY THIS SHAPE (ADR-0017)
 *   - The server holds no key, so it can't schedule a backup — "auto" can only
 *     mean "while the session is unlocked". The unlock is the one honest
 *     trigger, so we check staleness here rather than run a timer or a cron.
 *   - Gated on the modules config being hydrated: firing on an empty `modules`
 *     slice would collect nothing (or a subset) and overwrite the single
 *     rolling file with an incomplete backup. We wait for the config first.
 *   - Once per session (latch). A failure isn't retried this session — it just
 *     runs next time; nothing surfaces beyond the sidebar card that
 *     `pushBackupToCloud` drives.
 */
import { useEffect } from 'react';

import {
  useNodeaStore,
  selectIsAuthenticated,
  selectMainKey,
} from '@/core/store/nodea-store';

import { pushBackupToCloud } from './cloud-push';

/** 24 h staleness window (ADR-0017). */
const STALE_MS = 24 * 60 * 60 * 1000;

/** Fires at most once per session; the module-level latch is wiped by the
 *  full-reload logout (which drops the whole JS heap). */
let firedThisSession = false;

export function useAutoCloudBackup(): void {
  const isAuth = useNodeaStore(selectIsAuthenticated);
  const mainKey = useNodeaStore(selectMainKey);
  const cloudBackup = useNodeaStore((s) => s.preferences.cloudBackup);
  const modulesReady = useNodeaStore((s) => Object.keys(s.modules).length > 0);

  useEffect(() => {
    if (firedThisSession) return;
    if (!isAuth || !mainKey) return;
    if (!cloudBackup?.refreshToken) return; // Dropbox not connected
    if (!modulesReady) return; // wait for the config to hydrate
    const last = cloudBackup.lastBackupAt;
    if (last && Date.now() - last < STALE_MS) return; // backed up recently

    firedThisSession = true;
    void pushBackupToCloud().catch((err: unknown) => {
      // Silent for an auto run (no panel to surface it); retried next session.
      if (import.meta.env.DEV) console.warn('[cloud-backup] auto push failed', err);
    });
  }, [isAuth, mainKey, cloudBackup, modulesReady]);
}
