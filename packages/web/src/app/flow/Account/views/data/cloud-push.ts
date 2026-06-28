/**
 * Cloud-backup orchestration — seal the account from the in-session key and
 * push it to the connected provider, reporting real progress along the way.
 *
 * WHERE App-layer glue: it depends on the account-data collectors
 * (`collect-modules`, `backup-pack`, siblings here) AND the core crypto +
 * the core cloud-backup provider registry. Core must never import the app
 * layer, so the orchestrator lives here — the dependency only ever points
 * app → core.
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
import { getProvider } from '@/core/cloud-backup/registry';
import { persistPreferencesPatch } from '@/core/auth/use-preferences';
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
 * Phase budget: collect 0 → 0.70 (one step per module — the real, granular
 * part), seal → 0.85, then `provider.upload` (which mints/uses its own token
 * internally) → 1. Only collect moves smoothly; the rest are honest jumps at
 * genuine milestones. The provider is resolved from `cloudBackup.provider`, so
 * this orchestrator is identical for Dropbox / pCloud / WebDAV.
 */
export async function pushBackupToCloud(): Promise<void> {
  const store = useNodeaStore.getState();
  const cb = store.preferences.cloudBackup;
  if (!cb) throw new Error('cloud backup: no provider connected');
  const provider = getProvider(cb.provider);

  const set = store.setBackupProgress;
  set(0);
  try {
    const bytes = await sealFromSession((done, total) => {
      set(0.7 * (total > 0 ? done / total : 1));
    });
    set(0.85);
    await provider.upload(cb, bytes);
    set(1);
    await stampLastBackupAt();
  } finally {
    set(null);
  }
}

/**
 * Record the successful-push time in the encrypted prefs so the on-unlock
 * auto-trigger knows when it last ran. Stamped here so BOTH the manual button
 * and the auto-trigger update it for free. Routed through `persistPreferencesPatch`
 * (the SAME serialised write chain as `setPreferences`) so it can't reorder past
 * a concurrent settings PUT and clobber it. Best-effort: a failed stamp is
 * swallowed — the `.age` is already uploaded; worst case the auto-trigger fires
 * once more next session.
 */
async function stampLastBackupAt(): Promise<void> {
  const s = useNodeaStore.getState();
  const cb = s.preferences.cloudBackup;
  const mainKey = s.crypto.main;
  if (!cb || !mainKey) return;
  try {
    await persistPreferencesPatch(mainKey.aesKey, {
      cloudBackup: { ...cb, lastBackupAt: Date.now() },
    });
  } catch {
    // non-fatal — see doc above
  }
}
