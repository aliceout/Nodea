/**
 * Cloud-backup orchestration — seal the account from the in-session key and
 * push it to the connected provider, reporting real progress along the way.
 *
 * WHERE App-layer glue: it depends on the account-data collectors
 * (`collect-modules`, `backup-pack`, siblings here) AND the core crypto +
 * core Dropbox client. Core must never import the app layer, so the orchestrator
 * lives here — the dependency only ever points app → core.
 *
 * ASSUMPTIONS (non-obvious)
 *   - **No re-auth.** The `/backup` page re-authenticates only as a UX gate,
 *     never as a crypto requirement — the in-session main key is all the seal
 *     needs, so a silent push works whenever the session is unlocked.
 *   - **The seal phrase never leaves this module.** It's the derived, stable
 *     ADR-0016 phrase; callers only need the bytes, so `sealFromSession`
 *     returns the blob and discards the phrase.
 *   - **Progress is real, not faked.** Only the collect phase exposes a
 *     granular signal (one step per module), so it owns the bulk of the bar;
 *     seal and the one-shot `fetch` upload can't be subdivided, so they land as
 *     honest single jumps rather than a synthetic creep.
 */
import { sealBackup } from '@/core/crypto/backup-crypto';
import { deriveBackupPhrase } from '@/core/crypto/backup-phrase';
import { refreshDropboxAccessToken } from '@/core/cloud-backup/dropbox-oauth';
import { uploadToDropbox } from '@/core/cloud-backup/dropbox-upload';
import { useNodeaStore } from '@/core/store/nodea-store';

import { collectModules } from './collect-modules';
import { packBackup } from './backup-pack';

/** Produce the sealed `.age` bytes from the current unlocked session. Reports
 *  per-module collection progress via {@link onModule}. Throws if there's no
 *  main key in session, or the backup would be empty. */
async function sealFromSession(
  onModule?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const state = useNodeaStore.getState();
  const mainKey = state.crypto.main;
  if (!mainKey) throw new Error('cloud backup: no main key in session');

  const { out, failed } = await collectModules(
    mainKey,
    state.modules,
    (key, err) => {
      if (import.meta.env.DEV) console.warn(`[cloud-backup] module ${key} failed`, err);
    },
    onModule,
  );
  if (Object.keys(out).length === 0) {
    throw new Error('cloud backup: nothing to back up');
  }

  const version = state.preferences.backupPhraseVersion ?? 1;
  const phrase = await deriveBackupPhrase(mainKey.hmacKey, version);
  const files = packBackup(out, new Date().toISOString(), failed);
  return sealBackup(files, phrase);
}

/**
 * Seal + upload to the connected cloud provider, driving the real `0..1`
 * progress bar and always clearing it to `null` (the `finally`). Throws on any
 * failure so the caller — the panel today, the on-unlock auto-trigger in
 * Phase 3 — can surface it.
 *
 * Phase budget: refresh 0 → 0.05, collect 0.05 → 0.70 (one step per module —
 * the real, granular part), seal → 0.85, upload → 1. Only collect moves
 * smoothly; the rest are honest jumps at genuine milestones.
 */
export async function pushBackupToCloud(): Promise<void> {
  const store = useNodeaStore.getState();
  const cb = store.preferences.cloudBackup;
  if (!cb) throw new Error('cloud backup: no provider connected');

  const set = store.setBackupProgress;
  set(0);
  try {
    const { accessToken } = await refreshDropboxAccessToken(cb.refreshToken);
    set(0.05);
    const bytes = await sealFromSession((done, total) => {
      set(0.05 + 0.65 * (total > 0 ? done / total : 1));
    });
    set(0.85);
    await uploadToDropbox(accessToken, bytes);
    set(1);
  } finally {
    set(null);
  }
}
