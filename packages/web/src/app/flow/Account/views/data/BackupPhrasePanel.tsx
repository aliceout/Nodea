import { useNavigate } from 'react-router-dom';

import { usePreferences } from '@/core/auth/use-preferences';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';

/**
 * Backup-phrase gate — top panel of Account → Données.
 *
 * WHAT  Gates every export/backup option (encrypted `.age`, plain `.json`, auto
 *       cloud) behind the 12-word phrase that seals every backup: `DataTab`
 *       unlocks those panels only when `backupPhraseConfirmedVersion ===
 *       backupPhraseVersion`. `ImportPanel` stays outside the gate (restore is
 *       input, not a backup).
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

  const version = preferences.backupPhraseVersion ?? 1;
  const confirmed = preferences.backupPhraseConfirmedVersion === version;

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
