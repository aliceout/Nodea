import { useNavigate } from 'react-router-dom';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';

/** « Suppression du compte » tab — the entry point to the deletion
 *  tunnel (`/delete-account`). The three gates (retype email + fresh
 *  password proof + in-app confirm) and the irreversible delete now live
 *  on that dedicated page ; this tab is just a labelled launcher. */
export default function DangerTab() {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <div className="grid max-w-[1100px] grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
      <div className="max-w-90">
        <div className="mb-2 text-[12px] font-semibold tracking-[0.02em] text-danger">
          {t('account.danger.heading')}
        </div>
        <Button variant="danger" size="sm" onClick={() => navigate('/delete-account')}>
          {t('account.danger.cta')}
        </Button>
      </div>
      <p className="text-[13px] leading-[1.55] text-muted">
        {t('account.danger.explanation')}
      </p>
    </div>
  );
}
