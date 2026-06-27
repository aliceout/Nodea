import { Link } from 'react-router-dom';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';

/** Surface shown when the user lands on `/reset` without a
 *  `?token=…` query param (or with a malformed one). The token
 *  arrives via the recovery email ; if it's missing the user
 *  needs to redo the « j'ai perdu mon mot de passe » flow. */
export default function InvalidLinkPanel() {
  const { t } = useI18n();
  return (
    <>
      <AuthPanelHeader
        eyebrow={t('auth.reset.invalidLink.eyebrow')}
        title={t('auth.reset.invalidLink.title')}
        subtitle={t('auth.reset.invalidLink.subtitle')}
      />
      <Link
        to="/request-reset"
        className="inline-block rounded-md bg-accent-strong px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-accent-strong-hover"
      >
        {t('auth.reset.invalidLink.requestAgainCta')}
      </Link>
    </>
  );
}
