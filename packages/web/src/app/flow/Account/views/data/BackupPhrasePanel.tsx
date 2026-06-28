import { useNavigate } from 'react-router-dom';

import { usePreferences } from '@/core/auth/use-preferences';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';

import { isBackupPhraseConfirmed } from './phrase-gate';

/**
 * Backup-phrase gate — top panel of Account → Données.
 *
 * WHAT  Launches the phrase ceremony; the GATE it controls lives in the backup
 *       actions themselves — `ExportPanel` (both `.age` + `.json`), the manual
 *       cloud push and the auto push (`CloudBackupPanel` / `useAutoCloudBackup`)
 *       each disable until `backupPhraseConfirmedVersion === backupPhraseVersion`
 *       (`isBackupPhraseConfirmed`). Restore + cloud CONNECT stay OUTSIDE the
 *       gate (input, and the phrase is re-derivable from the key).
 * WHERE Renders above `ExportPanel` / `CloudBackupPanel`.
 * WHY   Without the phrase a backup is unrecoverable; gating everything (incl.
 *       the plain JSON export) stops users quietly skipping it.
 * HOW   Like `SecurityTab` (2FA → `/totp`, password → `/change-password`), the
 *       button navigates to the EXISTING auth tunnel — `/backup` — which already
 *       does the password re-auth → reveal the 12 words → transcription quiz and
 *       records the confirmed version. No bespoke re-auth here.
 */
export default function BackupPhrasePanel() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { preferences } = usePreferences();

  const confirmed = isBackupPhraseConfirmed(preferences);

  return (
    <section className="py-[24px] first:pt-0 last:pb-0">
      <h3 className="mb-2 text-[16px] font-semibold text-ink">
        {t('account.data.phraseGate.title')}
      </h3>
      <div className="grid grid-cols-1 items-start gap-y-3 lg:grid-cols-[240px_1fr] lg:gap-x-6">
        <div>
          <Button variant="primary" size="sm" onClick={() => navigate('/backup?confirm')}>
            {confirmed
              ? t('account.data.phraseGate.resetCta')
              : t('account.data.phraseGate.setupCta')}
          </Button>
        </div>
        <p className="text-[12px] leading-[1.55] text-muted">
          {confirmed
            ? t('account.data.phraseGate.confirmedDescription')
            : t('account.data.phraseGate.intro')}
        </p>
      </div>
    </section>
  );
}
