import { useState } from 'react';

import { usePreferences } from '@/core/auth/use-preferences';
import { connectDropbox } from '@/core/cloud-backup/dropbox-oauth';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';

/**
 * « Sauvegarde automatique » panel (Compte → Données). Phase 1: connect /
 * disconnect a Dropbox account for auto-backup. The OAuth handshake runs
 * entirely in the browser (popup → code → token); only the refresh token is
 * kept, sealed into the encrypted preferences (`cloudBackup`). No upload here
 * yet — the daily push lands in the next phase. Mirrors `ExportPanel`'s
 * section/grid layout so the Data tab reads as one consistent stack.
 */
export default function CloudBackupPanel() {
  const { t } = useI18n();
  const { preferences, setPreferences } = usePreferences();
  const connected = preferences.cloudBackup?.provider === 'dropbox';
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function onConnect(): Promise<void> {
    setBusy(true);
    setFailed(false);
    try {
      const { refreshToken } = await connectDropbox();
      await setPreferences({ cloudBackup: { provider: 'dropbox', refreshToken } });
    } catch {
      // User-deny, closed popup, blocked popup, or a failed exchange — all
      // surface as one actionable "try again" line; nothing here is secret.
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function onDisconnect(): Promise<void> {
    // ponytail: clearing the field disconnects. Dropbox tokens self-expire and
    // the app-folder confinement makes a stale token harmless, so a server-side
    // revocation round-trip isn't worth it for v1.
    await setPreferences({ cloudBackup: undefined });
  }

  return (
    <section className="py-[24px] first:pt-0 last:pb-0">
      <h3 className="mb-2 text-[16px] font-semibold text-ink">
        {t('account.data.cloudBackup.title')}
      </h3>
      <div className="grid grid-cols-1 items-start gap-y-3 lg:grid-cols-[240px_1fr] lg:gap-x-6">
        <div className="flex flex-col items-start gap-2">
          {connected ? (
            <Button variant="neutral" size="sm" onClick={onDisconnect}>
              {t('account.data.cloudBackup.disconnectCta')}
            </Button>
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
