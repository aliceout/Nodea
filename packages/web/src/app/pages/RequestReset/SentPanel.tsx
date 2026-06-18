import { Link } from 'react-router-dom';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';

import Warning from './Warning';

/**
 * Confirmation view shown after a successful POST to
 * `/auth/request-reset` (REFACTO-12 split).
 *
 * The server always returns 200 to avoid enumeration — this view
 * is identical whether or not the email is in the database, hence
 * the « si un compte est associé » phrasing.
 */
export default function SentPanel({ email }: { email: string }) {
  const { t } = useI18n();
  return (
    <>
      <AuthPanelHeader
        eyebrow={t('auth.requestReset.sent.eyebrow')}
        title={t('auth.requestReset.sent.title')}
        subtitle={
          <>
            {t('auth.requestReset.sent.subtitleBefore')}{' '}
            <strong className="font-semibold text-ink">{email}</strong>
            {t('auth.requestReset.sent.subtitleAfter')}
          </>
        }
      />

      <Warning title={t('auth.requestReset.sent.warningTitle')}>
        {t('auth.requestReset.sent.warningBody')}
      </Warning>

      <div className="mt-5 text-center text-[12.5px] text-muted">
        <Link to="/login" className="cursor-pointer transition-colors hover:text-ink">
          {t('auth.requestReset.backToLogin')}
        </Link>
      </div>
    </>
  );
}
