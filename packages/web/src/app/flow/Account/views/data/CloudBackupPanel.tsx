import { useState } from 'react';

import { usePreferences } from '@/core/auth/use-preferences';
import { getProvider } from '@/core/cloud-backup/registry';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';

import { pushBackupToCloud } from './cloud-push';

/**
 * « Sauvegarde automatique » panel (Compte → Données). Connect / disconnect a
 * Dropbox account for auto-backup, and trigger a manual push. The OAuth
 * handshake runs entirely in the browser (popup → code → token); only the
 * refresh token is kept, sealed into the encrypted preferences (`cloudBackup`).
 * The manual push reuses the same seal pipeline as the `/backup` export and
 * uploads the `.age` to the Dropbox app folder. The in-flight progress shows
 * globally in the sidebar card (driven by the `backupProgress` slice); this
 * panel adds the local success/error feedback for the manual button. Mirrors
 * `ExportPanel`'s section/grid layout so the Data tab reads as one stack.
 */
export default function CloudBackupPanel() {
  const { t } = useI18n();
  const { preferences, setPreferences } = usePreferences();
  const connected = !!preferences.cloudBackup;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pushState, setPushState] = useState<'idle' | 'saving' | 'done' | 'error'>(
    'idle',
  );

  async function onConnect(): Promise<void> {
    setBusy(true);
    setFailed(false);
    try {
      const cred = await getProvider('dropbox').connect();
      await setPreferences({ cloudBackup: cred });
    } catch {
      // User-deny, closed popup, blocked popup, or a failed exchange — all
      // surface as one actionable "try again" line; nothing here is secret.
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function onDisconnect(): Promise<void> {
    // Revoke at Dropbox FIRST so "disconnect" actually severs access — the
    // offline refresh token is long-lived and does NOT self-expire, so merely
    // dropping it locally would leave a valid token alive on Dropbox's side.
    // Best-effort: if the revoke is unreachable, still clear locally.
    const cb = preferences.cloudBackup;
    if (cb) {
      try {
        await getProvider(cb.provider).revoke?.(cb);
      } catch {
        // Offline, or nothing to revoke (pCloud/WebDAV) — fall through and clear.
      }
    }
    await setPreferences({ cloudBackup: undefined });
    setPushState('idle');
  }

  async function onBackupNow(): Promise<void> {
    setPushState('saving');
    try {
      await pushBackupToCloud();
      setPushState('done');
    } catch {
      // Seal / refresh / upload failure — one "try again" line. The sidebar
      // pill has already flipped back to idle (pushBackupToCloud's finally).
      setPushState('error');
    }
  }

  return (
    <section className="py-[24px] first:pt-0 last:pb-0">
      <h3 className="mb-2 text-[16px] font-semibold text-ink">
        {t('account.data.cloudBackup.title')}
      </h3>
      <div className="grid grid-cols-1 items-start gap-y-3 lg:grid-cols-[240px_1fr] lg:gap-x-6">
        <div className="flex flex-col items-start gap-2">
          {connected ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onBackupNow}
                  disabled={pushState === 'saving'}
                >
                  {pushState === 'saving'
                    ? t('account.data.cloudBackup.backingUp')
                    : t('account.data.cloudBackup.backupNowCta')}
                </Button>
                <Button variant="neutral" size="sm" onClick={onDisconnect}>
                  {t('account.data.cloudBackup.disconnectCta')}
                </Button>
              </div>
              {pushState === 'done' ? (
                <p role="status" className="text-[11.5px] text-muted">
                  {t('account.data.cloudBackup.backupDone')}
                </p>
              ) : null}
              {pushState === 'error' ? (
                <p role="alert" className="text-[11.5px] text-danger">
                  {t('account.data.cloudBackup.backupError')}
                </p>
              ) : null}
            </>
          ) : (
            <Button variant="primary" size="sm" onClick={onConnect} disabled={busy}>
              {busy
                ? t('account.data.cloudBackup.connecting')
                : t('account.data.cloudBackup.connectCta')}
            </Button>
          )}
          {failed ? (
            <p role="alert" className="text-[11.5px] text-danger">
              {t('account.data.cloudBackup.error')}
            </p>
          ) : null}
        </div>
        <p className="text-[12px] leading-[1.55] text-muted">
          {connected
            ? t('account.data.cloudBackup.connectedDescription')
            : t('account.data.cloudBackup.description')}
        </p>
      </div>
    </section>
  );
}
