import { useI18n } from '@/i18n/I18nProvider.jsx';

import BackupPhrasePanel from './data/BackupPhrasePanel';
import CloudBackupPanel from './data/CloudBackupPanel';
import CloudRestorePanel from './data/CloudRestorePanel';
import ExportPanel from './data/ExportPanel';
import ImportPanel from './data/ImportPanel';

/**
 * « Données » tab. The bidirectional cloud connection (auto-backup AND restore)
 * and the backup phrase that locks every backup sit at the top — neither belongs
 * to a single direction. Below them, two action groups:
 *   - SAUVEGARDER (out): manual export.
 *   - RESTAURER (in): import a file + restore from the connected cloud.
 * Same panels/wiring as before — only the layout changed. Everything runs
 * client-side; the server never sees plaintext.
 */
export default function DataTab() {
  const { t } = useI18n();
  return (
    <div className="max-w-[880px]">
      <div className="divide-y divide-hair">
        <CloudBackupPanel />
        <BackupPhrasePanel />
      </div>

      <h2 className="mb-1 mt-10 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
        {t('account.data.groups.backup')}
      </h2>
      <div className="divide-y divide-hair">
        <ExportPanel />
      </div>

      <h2 className="mb-1 mt-10 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
        {t('account.data.groups.restore')}
      </h2>
      <div className="divide-y divide-hair">
        <ImportPanel />
        <CloudRestorePanel />
      </div>
    </div>
  );
}
