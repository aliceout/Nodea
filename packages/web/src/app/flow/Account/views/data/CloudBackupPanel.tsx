import { useState } from 'react';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { ChevronDownIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline';
import { CloudIcon, ServerStackIcon } from '@heroicons/react/24/solid';

import type { CloudBackup } from '@nodea/shared';

import { usePreferences } from '@/core/auth/use-preferences';
import { CLOUD_PROVIDERS, getProvider } from '@/core/cloud-backup/registry';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';

import { pushBackupToCloud } from './cloud-push';
import WebdavConnectForm from './WebdavConnectForm';

type ProviderId = (typeof CLOUD_PROVIDERS)[number];

/** Display names — proper nouns, not translated. */
const PROVIDER_NAMES: Record<ProviderId, string> = {
  dropbox: 'Dropbox',
  pcloud: 'pCloud',
  // Protocol is WebDAV, but webapppassword makes it Nextcloud-only in practice —
  // so we surface the name users actually recognise.
  webdav: 'Nextcloud',
};

/** Dropbox's official glyph (CC0, simple-icons), in its real brand blue. */
function DropboxGlyph({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="#0061FF" aria-hidden="true" className={className}>
      <path d="M6 1.807L0 5.629l6 3.822 6.001-3.822L6 1.807zM18 1.807l-6 3.822 6 3.822 6-3.822-6-3.822zM0 13.274l6 3.822 6.001-3.822L6 9.452l-6 3.822zM18 9.452l-6 3.822 6 3.822 6-3.822-6-3.822zM6 18.371l6.001 3.822 6-3.822-6-3.822L6 18.371z" />
    </svg>
  );
}

/** Per-provider button glyph in the brand colour. Dropbox ships its real mark;
 *  pCloud has no clean, license-clear official glyph in our icon sets, so it's a
 *  cyan cloud STAND-IN (drop in pCloud's real SVG to swap it). */
function ProviderIcon({ id, className }: { id: ProviderId; className: string }) {
  if (id === 'dropbox') return <DropboxGlyph className={className} />;
  if (id === 'webdav') return <ServerStackIcon aria-hidden="true" className={className} />;
  return <CloudIcon aria-hidden="true" className={`${className} text-[#17BED0]`} />;
}

/**
 * « Sauvegarde automatique » panel (Compte → Données). Pick a cloud provider,
 * connect it (popup → token sealed into the encrypted prefs), trigger a manual
 * push, or disconnect. One provider at a time. The connect / upload / revoke
 * details live behind the provider registry, so this panel is identical for
 * Dropbox / pCloud / WebDAV. In-flight progress shows in the sidebar card
 * (`backupProgress` slice); this panel adds the manual button's success/error.
 */
export default function CloudBackupPanel() {
  const { t } = useI18n();
  const { preferences, setPreferences } = usePreferences();
  const cb = preferences.cloudBackup;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // WebDAV connects via a credentials form (no OAuth popup); this toggles it.
  const [webdavOpen, setWebdavOpen] = useState(false);
  const [pushState, setPushState] = useState<'idle' | 'saving' | 'done' | 'error'>(
    'idle',
  );

  /** Dropdown pick: OAuth providers open a popup immediately; credential
   *  providers (WebDAV) reveal the inline form instead. */
  function onPick(id: ProviderId): void {
    setFailed(false);
    if (getProvider(id).connectKind === 'credentials') {
      setWebdavOpen(true);
    } else {
      void onConnect(id);
    }
  }

  async function onWebdavConnected(cred: CloudBackup): Promise<void> {
    await setPreferences({ cloudBackup: cred });
    setWebdavOpen(false);
  }

  async function onConnect(id: ProviderId): Promise<void> {
    setBusy(true);
    setFailed(false);
    try {
      const cred = await getProvider(id).connect();
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
    // Best-effort revoke at the provider (Dropbox), then clear locally. pCloud /
    // WebDAV have no browser revoke, so we just forget the credential.
    if (cb) {
      try {
        await getProvider(cb.provider).revoke?.(cb);
      } catch {
        // Offline, or nothing to revoke — fall through and clear.
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
      // card has already cleared (pushBackupToCloud's finally).
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
          {cb ? (
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
          ) : webdavOpen ? (
            <WebdavConnectForm
              onConnected={onWebdavConnected}
              onCancel={() => setWebdavOpen(false)}
            />
          ) : (
            // Single split-button picker (same HeadlessUI Menu as ExportPanel):
            // one trigger, one menu item per provider — scales to N services and
            // sidesteps the unequal-width problem of stacked per-provider buttons.
            <Menu>
              <MenuButton as={Button} variant="primary" size="sm" disabled={busy}>
                <CloudArrowUpIcon className="h-4 w-4" aria-hidden="true" />
                {busy
                  ? t('account.data.cloudBackup.connecting')
                  : t('account.data.cloudBackup.connectCta')}
                <ChevronDownIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </MenuButton>
              <MenuItems
                anchor="bottom start"
                className="z-50 mt-1 min-w-[12rem] rounded-md border border-hair bg-bg p-1 shadow-md focus:outline-none"
              >
                {CLOUD_PROVIDERS.map((id) => (
                  <MenuItem key={id}>
                    <button
                      type="button"
                      onClick={() => onPick(id)}
                      className="flex w-full cursor-pointer items-center gap-2 rounded px-2.5 py-2 text-left data-[focus]:bg-bg-2"
                    >
                      <ProviderIcon id={id} className="h-4 w-4 shrink-0" />
                      <span className="text-[13px] font-medium text-ink">
                        {PROVIDER_NAMES[id]}
                      </span>
                    </button>
                  </MenuItem>
                ))}
              </MenuItems>
            </Menu>
          )}
          {failed ? (
            <p role="alert" className="text-[11.5px] text-danger">
              {t('account.data.cloudBackup.error')}
            </p>
          ) : null}
        </div>
        <p className="text-[12px] leading-[1.55] text-muted">
          {cb
            ? t('account.data.cloudBackup.connectedDescription', {
                values: { provider: PROVIDER_NAMES[cb.provider] },
              })
            : t('account.data.cloudBackup.description')}
        </p>
      </div>
    </section>
  );
}
