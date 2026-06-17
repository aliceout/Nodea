import { useNavigate } from 'react-router-dom';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';

/** « Exporter » panel on the Data tab — the entry point to the export
 *  tunnel (`/export`). The re-auth proof + the client-side file
 *  generation now live on that dedicated page (same ceremony as
 *  `/recovery-code`), so this panel is just a labelled launcher. */
export default function ExportPanel() {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <section className="py-[24px] first:pt-0 last:pb-0">
      <h3 className="mb-2 text-[16px] font-semibold text-ink">
        {t('account.data.export.title')}
      </h3>
      <div className="grid grid-cols-1 items-start gap-y-3 lg:grid-cols-[240px_1fr] lg:gap-x-6">
        {/* Button wrapped so it sizes to its text, not the 240px grid
            cell — same structure as ImportPanel. */}
        <div>
          <Button variant="primary" size="sm" onClick={() => navigate('/export')}>
            {t('account.data.export.cta')}
          </Button>
        </div>
        <p className="text-[12px] leading-[1.55] text-muted">
          {t('account.data.export.description')}
        </p>
      </div>
    </section>
  );
}
