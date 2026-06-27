import { Link } from 'react-router-dom';

import { useI18n } from '@/i18n/I18nProvider.jsx';

/** Confirmation screen after a successful reset. The server has
 *  purged the old encrypted data, the new credentials are in
 *  place, the only path forward is `/login` with the new
 *  password — no auto-login from this surface (the local
 *  session was never authenticated to begin with, the user
 *  arrived at `/reset` from an email link). */
export default function DonePanel() {
  const { t } = useI18n();
  return (
    <>
      <div
        aria-hidden="true"
        className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-strong text-white"
      >
        ✓
      </div>
      <h2 className="mb-2 text-[24px] font-semibold tracking-[-0.02em] text-ink">
        {t('auth.reset.done.title')}
      </h2>
      <p className="mb-6 text-[14px] text-ink-soft">
        {t('auth.reset.done.body')}
      </p>
      <Link
        to="/login"
        className="inline-block rounded-md bg-accent-strong px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-accent-strong-hover"
      >
        {t('auth.reset.done.loginCta')}
      </Link>
    </>
  );
}
