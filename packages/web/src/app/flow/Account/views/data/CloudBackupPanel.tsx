import { useState } from 'react';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { ChevronDownIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline';
import { CloudIcon } from '@heroicons/react/24/solid';

import type { CloudBackup } from '@nodea/shared';

import { usePreferences } from '@/core/auth/use-preferences';
import {
  CLOUD_PROVIDERS,
  getProvider,
  PROVIDER_NAMES,
} from '@/core/cloud-backup/registry';
import { useNodeaStore, selectMainKey, selectModules } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import { useConfirm } from '@/ui/dirk/confirm/confirm-context';

import { pushBackupToCloud } from './cloud-push';
import { isBackupPhraseConfirmed } from './phrase-gate';
import { tryAutoRestore } from './restore-backup';
import WebdavConnectForm from './WebdavConnectForm';

type ProviderId = (typeof CLOUD_PROVIDERS)[number];

/** Dropbox's official glyph (CC0, simple-icons), in its real brand blue. */
function DropboxGlyph({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="#0061FF" aria-hidden="true" className={className}>
      <path d="M6 1.807L0 5.629l6 3.822 6.001-3.822L6 1.807zM18 1.807l-6 3.822 6 3.822 6-3.822-6-3.822zM0 13.274l6 3.822 6.001-3.822L6 9.452l-6 3.822zM18 9.452l-6 3.822 6 3.822 6-3.822-6-3.822zM6 18.371l6.001 3.822 6-3.822-6-3.822L6 18.371z" />
    </svg>
  );
}

/** Nextcloud's official logo (CC0, simple-icons), in its real brand blue. */
function NextcloudGlyph({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="#0082C9" aria-hidden="true" className={className}>
      <path d="M12.018 6.537c-2.5 0-4.6 1.712-5.241 4.015-.56-1.232-1.793-2.105-3.225-2.105A3.569 3.569 0 0 0 0 12a3.569 3.569 0 0 0 3.552 3.553c1.432 0 2.664-.874 3.224-2.106.641 2.304 2.742 4.016 5.242 4.016 2.487 0 4.576-1.693 5.231-3.977.569 1.21 1.783 2.067 3.198 2.067A3.568 3.568 0 0 0 24 12a3.569 3.569 0 0 0-3.553-3.553c-1.416 0-2.63.858-3.199 2.067-.654-2.284-2.743-3.978-5.23-3.977zm0 2.085c1.878 0 3.378 1.5 3.378 3.378 0 1.878-1.5 3.378-3.378 3.378A3.362 3.362 0 0 1 8.641 12c0-1.878 1.5-3.378 3.377-3.378zm-8.466 1.91c.822 0 1.467.645 1.467 1.468s-.644 1.467-1.467 1.468A1.452 1.452 0 0 1 2.085 12c0-.823.644-1.467 1.467-1.467zm16.895 0c.823 0 1.468.645 1.468 1.468s-.645 1.468-1.468 1.468A1.452 1.452 0 0 1 18.98 12c0-.823.644-1.467 1.467-1.467z" />
    </svg>
  );
}

/** Per-provider button glyph in the brand colour. Dropbox + Nextcloud ship their
 *  real marks; pCloud has no clean, license-clear official glyph in our icon
 *  sets, so it's a cyan cloud STAND-IN (drop in pCloud's real SVG to swap it). */
function ProviderIcon({ id, className }: { id: ProviderId; className: string }) {
  if (id === 'dropbox') return <DropboxGlyph className={className} />;
  if (id === 'webdav') return <NextcloudGlyph className={className} />;
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
  const confirm = useConfirm();
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const cb = preferences.cloudBackup;
  // Backup (manual + auto) is gated on the phrase; CONNECT + restore are not.
  const phraseReady = isBackupPhraseConfirmed(preferences);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // Why the user should go restore manually, if at all:
  //  'manual'    — auto-decrypt failed (a different account/version sealed it),
  //  'partial'   — restore merged only partially, re-run to finish,
  //  'unchecked' — couldn't probe the destination, restore manually if needed.
  const [restoreHint, setRestoreHint] = useState<
    null | 'manual' | 'partial' | 'unchecked'
  >(null);
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

  /** Shared tail of every connect (OAuth popup OR WebDAV form). BEFORE persisting
   *  the credential — which would let the on-unlock auto-backup fire and
   *  overwrite the remote — check the destination for an existing backup and
   *  offer to restore it. Stamp `lastBackupAt` whenever a restore is wanted, so
   *  the first auto-backup can't clobber the remote before the user is done. */
  async function finishConnect(id: ProviderId, cred: CloudBackup): Promise<void> {
    setRestoreHint(null);
    // Probe the destination. CRITICAL: a thrown error is NOT "no backup" — the
    // remote state is UNKNOWN (token/network/CORS/rate-limit), so we must never
    // let the first auto-backup treat it as empty and overwrite a real backup.
    // Stamp lastBackupAt to defer the auto-push and point the user at the manual
    // restore (only a genuine not-found returns null → safe to start fresh).
    let remote: Uint8Array | null;
    try {
      remote = await getProvider(id).download(cred);
    } catch {
      await setPreferences({ cloudBackup: { ...cred, lastBackupAt: Date.now() } });
      setRestoreHint('unchecked');
      return;
    }
    let toSave: CloudBackup = cred;
    if (remote) {
      const wantRestore = await confirm({
        title: t('account.data.cloudBackup.restore.title'),
        message: t('account.data.cloudBackup.restore.message'),
        confirmLabel: t('account.data.cloudBackup.restore.confirmCta'),
        cancelLabel: t('account.data.cloudBackup.restore.cancelCta'),
      });
      if (wantRestore) {
        const version = preferences.backupPhraseVersion ?? 1;
        const { ok, hadFailures } = mainKey
          ? await tryAutoRestore(remote, mainKey, version, modules, t)
          : { ok: false, hadFailures: false };
        // Always stamp when a restore was wanted — defers the auto-push so it
        // can't overwrite the remote before the user has finished (incl.
        // re-running after a partial restore).
        toSave = { ...cred, lastBackupAt: Date.now() };
        setRestoreHint(!ok ? 'manual' : hadFailures ? 'partial' : null);
      }
      // Declined → no stamp: the first auto-backup replaces the remote (the user
      // chose to ignore it — decision B).
    }
    await setPreferences({ cloudBackup: toSave });
  }

  async function onWebdavConnected(cred: CloudBackup): Promise<void> {
    setWebdavOpen(false);
    await finishConnect('webdav', cred);
  }

  async function onConnect(id: ProviderId): Promise<void> {
    setBusy(true);
    setFailed(false);
    try {
      const cred = await getProvider(id).connect();
      await finishConnect(id, cred);
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
        <div
          className={`flex flex-col items-start gap-2${
            webdavOpen ? ' lg:col-span-2' : ''
          }`}
        >
          {cb ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onBackupNow}
                  disabled={pushState === 'saving' || !phraseReady}
                >
                  {pushState === 'saving'
                    ? t('account.data.cloudBackup.backingUp')
                    : t('account.data.cloudBackup.backupNowCta')}
                </Button>
                <Button variant="neutral" size="sm" onClick={onDisconnect}>
                  {t('account.data.cloudBackup.disconnectCta')}
                </Button>
              </div>
              {!phraseReady ? (
                <p role="status" className="text-[11.5px] text-muted">
                  {t('account.data.phraseGate.lockedHint')}
                </p>
              ) : null}
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
              {restoreHint ? (
                <p role="status" className="text-[11.5px] text-muted">
                  {t(`account.data.cloudBackup.restore.${restoreHint}Hint`)}
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
        {webdavOpen ? null : (
          <p className="text-[12px] leading-[1.55] text-muted">
            {cb
              ? t('account.data.cloudBackup.connectedDescription', {
                  values: { provider: PROVIDER_NAMES[cb.provider] },
                })
              : t('account.data.cloudBackup.description')}
          </p>
        )}
      </div>
    </section>
  );
}
