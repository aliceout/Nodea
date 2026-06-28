import { useNavigate } from 'react-router-dom';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { ArrowDownTrayIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import { usePreferences } from '@/core/auth/use-preferences';

import { isBackupPhraseConfirmed } from './phrase-gate';

/**
 * « Exporter » panel on the Data tab — a single split-button that merges
 * the two former, confusingly-separate exports into one choice :
 *
 *   - encrypted backup (`.age`, → `/backup`) — recommended, survives
 *     losing the account ;
 *   - plain export (`.json`, → `/export`) — GDPR portability, unencrypted.
 *
 * Both targets are full ceremony pages (re-auth + client-side generation);
 * this panel is just the launcher. Built on HeadlessUI's accessible `Menu`
 * (keyboard nav + click-outside), trigger reused from the `Button` atom —
 * same pattern as HRT's `ExportMenuButton`.
 *
 * Gated by the backup phrase: BOTH exports stay disabled until the phrase is
 * confirmed (`isBackupPhraseConfirmed`) — incl. the plain JSON, so users can't
 * sidestep recording the phrase by reaching for the unencrypted option.
 */
export default function ExportPanel() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { preferences } = usePreferences();
  const locked = !isBackupPhraseConfirmed(preferences);
  return (
    <section className="py-[24px] first:pt-0 last:pb-0">
      <h3 className="mb-2 text-[16px] font-semibold text-ink">
        {t('account.data.export.title')}
      </h3>
      <div className="grid grid-cols-1 items-start gap-y-3 lg:grid-cols-[240px_1fr] lg:gap-x-6">
        <div>
          {locked ? (
            <Button variant="primary" size="sm" disabled>
              <ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />
              {t('account.data.export.cta')}
            </Button>
          ) : (
            <Menu>
              <MenuButton as={Button} variant="primary" size="sm">
                <ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />
                {t('account.data.export.cta')}
                <ChevronDownIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </MenuButton>
              <MenuItems
                anchor="bottom start"
                className="z-50 mt-1 min-w-[16rem] rounded-md border border-hair bg-bg p-1 shadow-md focus:outline-none"
              >
                <MenuItem>
                  <button
                    type="button"
                    onClick={() => navigate('/backup')}
                    className="flex w-full cursor-pointer flex-col items-start rounded px-2.5 py-2 text-left data-[focus]:bg-bg-2"
                  >
                    <span className="text-[13px] font-medium text-ink">
                      {t('account.data.export.encryptedOption')}
                    </span>
                    <span className="text-[11.5px] text-muted">
                      {t('account.data.export.encryptedHint')}
                    </span>
                  </button>
                </MenuItem>
                <MenuItem>
                  <button
                    type="button"
                    onClick={() => navigate('/export')}
                    className="flex w-full cursor-pointer flex-col items-start rounded px-2.5 py-2 text-left data-[focus]:bg-bg-2"
                  >
                    <span className="text-[13px] font-medium text-ink">
                      {t('account.data.export.plainOption')}
                    </span>
                    <span className="text-[11.5px] text-muted">
                      {t('account.data.export.plainHint')}
                    </span>
                  </button>
                </MenuItem>
              </MenuItems>
            </Menu>
          )}
        </div>
        <p className="text-[12px] leading-[1.55] text-muted">
          {locked
            ? t('account.data.phraseGate.lockedHint')
            : t('account.data.export.description')}
        </p>
      </div>
    </section>
  );
}
