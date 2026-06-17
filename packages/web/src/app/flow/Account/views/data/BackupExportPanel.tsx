import { useNavigate } from 'react-router-dom';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';

/** « Sauvegarde chiffrée » panel on the Data tab — the entry point to
 *  the encrypted-backup tunnel (`/backup`). The account-password proof,
 *  the passphrase step (zxcvbn-gated) and the `.age` sealing now live on
 *  that dedicated page ; this panel is just a labelled launcher. */
export default function BackupExportPanel() {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <section className="py-[24px] first:pt-0 last:pb-0">
      <h3 className="mb-2 text-[16px] font-semibold text-ink">
        {t('account.data.backup.title')}
      </h3>
      {/* Same grid patron as Export / Import : content-width button left,
          description right. */}
      <div className="grid grid-cols-1 items-start gap-y-3 lg:grid-cols-[240px_1fr] lg:gap-x-6">
        <div>
          <Button variant="primary" size="sm" onClick={() => navigate('/backup')}>
            {t('account.data.backup.cta')}
          </Button>
        </div>
        <p className="text-[12px] leading-[1.55] text-muted">
          {t('account.data.backup.description')}
        </p>
      </div>
    </section>
  );
}
