/**
 * Decrypt + merge a `.age` backup blob into the account. The one place both
 * entry points share — the manual file import (`ImportPanel`) and the cloud
 * restore (`CloudRestorePanel` / restore-on-connect) — so they run the exact
 * same idempotent, NON-DESTRUCTIVE pipeline: `openBackup` (decrypt) →
 * `unpackBackup` (unzip) → `restoreEnvelope` (dedup by each plugin's natural
 * key, add only what's missing, never overwrite).
 */
import { openBackup } from '@/core/crypto/backup-crypto';
import { deriveBackupPhrase } from '@/core/crypto/backup-phrase';
import type { MainKeyMaterial } from '@/core/crypto/key-material';

import { restoreEnvelope, type RestoreResult } from './restore-envelope';
import { unpackBackup } from './backup-pack';

export interface RestoredBackup extends RestoreResult {
  /** Module files that couldn't be parsed (corrupted) — the rest still merged. */
  failedModules: string[];
  /** True if anything didn't fully restore — a corrupted module file
   *  (`failedModules`) OR a mid-restore write failure (`failed`). Callers must
   *  not treat the account as fully restored (e.g. must not let an auto-backup
   *  overwrite the remote with an incomplete account). */
  hadFailures: boolean;
}

/**
 * Decrypt `bytes` with `phrase`, then merge the contents into the account.
 * Throws (from `openBackup`) on a wrong phrase or a tampered/corrupted blob —
 * which is exactly how the caller detects an auto-derived phrase that doesn't
 * match (different account/version) and falls back to asking for the 12 words.
 */
export async function restoreFromAgeBytes(
  bytes: Uint8Array,
  phrase: string,
  mainKey: MainKeyMaterial,
  slice: Parameters<typeof restoreEnvelope>[2],
  t: Parameters<typeof restoreEnvelope>[3],
): Promise<RestoredBackup> {
  // `phrase` is a JS string — immutable, so it can't be zeroed; it lingers in
  // the heap until GC (same limitation as the seal side; full purge =
  // location.reload). An attacker who can read the JS heap already has the main
  // key, so this isn't a new exposure (CLAUDE.md crypto rule 7).
  const files = await openBackup(bytes, phrase);
  const { modules, failedModules } = unpackBackup(files);
  const result = await restoreEnvelope(modules, mainKey, slice, t);
  return {
    ...result,
    failedModules,
    hadFailures: failedModules.length > 0 || result.failed.length > 0,
  };
}

/**
 * Restore the COMMON case from a cloud blob: re-derive THIS account's phrase for
 * `version` and merge. NEVER throws — returns `ok:false` when that phrase can't
 * open the blob (a backup from a different account/version), so the caller falls
 * back to asking for the 12 words. Shared by the connect-time auto-restore
 * (`CloudBackupPanel`) and the on-demand cloud restore (`CloudRestorePanel`).
 */
export async function tryAutoRestore(
  bytes: Uint8Array,
  mainKey: MainKeyMaterial,
  version: number,
  slice: Parameters<typeof restoreFromAgeBytes>[3],
  t: Parameters<typeof restoreFromAgeBytes>[4],
): Promise<{
  ok: boolean;
  hadFailures: boolean;
  count: number;
  parts: string[];
  skippedModules: number;
}> {
  try {
    const phrase = await deriveBackupPhrase(mainKey.hmacKey, version);
    const { count, parts, hadFailures, skippedModules } = await restoreFromAgeBytes(
      bytes,
      phrase,
      mainKey,
      slice,
      t,
    );
    return { ok: true, hadFailures, count, parts, skippedModules };
  } catch {
    return { ok: false, hadFailures: false, count: 0, parts: [], skippedModules: 0 };
  }
}
