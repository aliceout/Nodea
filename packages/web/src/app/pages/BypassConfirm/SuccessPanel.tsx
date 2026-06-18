import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';

/**
 * Success panel : the bypass request has been confirmed by the
 * user clicking the email link, and the 7-day countdown is now
 * running. Shows a live countdown to the moment the bypass becomes
 * applicable on the next login (REFACTO-12 split).
 *
 * `alreadyConfirmed = true` means the link was clicked twice (or
 * the React strict-mode double-mount snuck through the latch) ;
 * the countdown still works but the copy explains the timer
 * started earlier.
 */
export default function SuccessPanel({
  factor,
  earliestApplyAt,
  alreadyConfirmed,
}: {
  factor: 'totp' | 'passkey';
  earliestApplyAt: Date;
  alreadyConfirmed: boolean;
}) {
  const { t } = useI18n();
  const factorLabel =
    factor === 'totp'
      ? t('auth.bypass.success.factorTotp')
      : t('auth.bypass.success.factorPasskey');
  const sideEffect =
    factor === 'totp'
      ? t('auth.bypass.success.sideEffectTotp')
      : t('auth.bypass.success.sideEffectPasskey');

  return (
    <div>
      <AuthPanelHeader
        eyebrow={t('auth.bypass.success.eyebrow', { values: { factor: factorLabel } })}
        title={
          alreadyConfirmed
            ? t('auth.bypass.success.titleAlreadyConfirmed')
            : t('auth.bypass.success.title')
        }
        subtitle={
          alreadyConfirmed
            ? t('auth.bypass.success.subtitleAlreadyConfirmed', {
                values: { factor: factorLabel },
              })
            : t('auth.bypass.success.subtitle', {
                values: { factor: factorLabel, sideEffect },
              })
        }
      />

      <Countdown target={earliestApplyAt} />

      <p className="mt-6 text-[12.5px] leading-[1.5] text-muted">
        {t('auth.bypass.success.warningNotYouBefore')}{' '}
        <strong>{t('auth.bypass.success.warningNotYouStrong')}</strong>
        {t('auth.bypass.success.warningNotYouAfter', { values: { factor: factorLabel } })}
      </p>
      <p className="mt-3 text-[12.5px] leading-[1.5] text-muted">
        {t('auth.bypass.success.warningCompromised')}
      </p>

      <div className="mt-6 text-center text-[12.5px] text-muted">
        <Link
          to="/login"
          className="cursor-pointer transition-colors hover:text-ink"
        >
          {t('auth.bypass.success.backToLogin')}
        </Link>
      </div>
    </div>
  );
}

/**
 * Live countdown to the moment the bypass becomes applicable.
 *
 * Ticks at 1 Hz internally so the visible minute flips on time, but
 * the rendered text stays at minute precision — second-by-second
 * changes feel anxious. With a 7-day window we show « Jj HHh MMmin » ;
 * we drop the days segment once the remaining time is < 24 h so the
 * format degrades gracefully.
 *
 * Inline in this file (rather than a separate `Countdown.tsx`)
 * because `SuccessPanel` is the only consumer.
 */
function Countdown({ target }: { target: Date }) {
  const { t, language } = useI18n();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remainingMs = target.getTime() - now.getTime();
  const expired = remainingMs <= 0;

  if (expired) {
    return (
      <div className="rounded-md border border-accent bg-accent/5 px-4 py-4 text-center">
        <p className="mb-1 text-[12px] font-medium uppercase tracking-wide text-accent-deep">
          {t('auth.bypass.countdown.expiredLabel')}
        </p>
        <p className="text-[14px] text-ink-soft">
          {t('auth.bypass.countdown.expiredBody')}
        </p>
      </div>
    );
  }

  const totalMinutes = Math.ceil(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes - days * 60 * 24) / 60);
  const minutes = totalMinutes % 60;
  const targetText = target.toLocaleString(language === 'en' ? 'en-US' : 'fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="rounded-md border border-hair bg-bg-soft px-4 py-4 text-center">
      <p className="mb-1 text-[12px] font-medium uppercase tracking-wide text-muted">
        {t('auth.bypass.countdown.remainingLabel')}
      </p>
      <p className="font-mono text-[28px] font-semibold tracking-[0.02em] text-ink tabular-nums">
        {days > 0 ? (
          <>
            {days}
            <span className="px-1 text-muted">{t('auth.bypass.countdown.unitDays')}</span>
          </>
        ) : null}
        {String(hours).padStart(2, '0')}
        <span className="px-1 text-muted">{t('auth.bypass.countdown.unitHours')}</span>
        {String(minutes).padStart(2, '0')}
        <span className="pl-1 text-muted">{t('auth.bypass.countdown.unitMinutes')}</span>
      </p>
      <p className="mt-2 text-[12px] text-muted">
        {t('auth.bypass.countdown.targetPrefix', { values: { date: targetText } })}
      </p>
    </div>
  );
}
