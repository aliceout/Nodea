import { Link } from 'react-router-dom';

import { useI18n } from '@/i18n/I18nProvider.jsx';

export type ErrorReason =
  | 'cancelled'
  | 'consumed'
  | 'expired'
  | 'unknown'
  | 'network';

/**
 * One panel for every non-success status the api can return :
 * `cancelled`, `consumed`, `expired`, `unknown`, plus the
 * client-side `network` fallback (REFACTO-12 split). Each one
 * frames « what happened, what to do next » so the user lands on
 * a clear message rather than a generic 404.
 */
export default function ErrorPanel({ reason }: { reason: ErrorReason }) {
  const { t } = useI18n();
  return (
    <div className="text-center">
      <h2 className="mb-2 text-[20px] font-semibold text-ink">
        {t(`auth.bypass.errors.${reason}.title`)}
      </h2>
      <p className="mb-6 text-[14px] text-ink-soft">
        {t(`auth.bypass.errors.${reason}.body`)}
      </p>
      <Link
        to="/login"
        className="inline-block rounded-md bg-accent-strong px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-accent-strong-hover"
      >
        {t('auth.bypass.goToLogin')}
      </Link>
    </div>
  );
}
