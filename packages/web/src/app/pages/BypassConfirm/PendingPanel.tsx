import { useI18n } from '@/i18n/I18nProvider.jsx';

/**
 * Loading panel rendered while the api call is in flight
 * (REFACTO-12 split). Tiny on purpose — the round trip is usually
 * sub-second so a long copy would feel anxious.
 */
export default function PendingPanel() {
  const { t } = useI18n();
  return (
    <div className="text-center">
      <h2 className="mb-2 text-[20px] font-semibold text-ink">
        {t('auth.bypass.pending.title')}
      </h2>
      <p className="text-[13px] text-muted">
        {t('auth.bypass.pending.body')}
      </p>
    </div>
  );
}
