/**
 * Backup-phrase gate predicate — the single source for "may this account ship a
 * backup yet?". True once the user has SEEN + transcribed the phrase that seals
 * every backup (the `/backup` quiz, recorded as `backupPhraseConfirmedVersion`).
 *
 * Only the OUTBOUND seal waits on it — manual export (`ExportPanel`), the manual
 * cloud push and the on-unlock auto push (`CloudBackupPanel` /
 * `useAutoCloudBackup`) — so a user can't create a backup they'd be unable to
 * decrypt. Restore AND the cloud CONNECT are NEVER gated (restore is input, and
 * the phrase is re-derivable from the key). Rotating the phrase bumps the
 * version and re-closes the gate until the new one is confirmed.
 */
import type { UserPreferencesPayload } from '@nodea/shared';

export function isBackupPhraseConfirmed(
  prefs: Pick<
    UserPreferencesPayload,
    'backupPhraseVersion' | 'backupPhraseConfirmedVersion'
  >,
): boolean {
  return prefs.backupPhraseConfirmedVersion === (prefs.backupPhraseVersion ?? 1);
}
