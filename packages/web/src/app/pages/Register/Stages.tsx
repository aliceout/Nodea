import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';

/** Pre-form spinner — surfaced while the registration mode
 *  (`closed` / `invited` / `open`) is being resolved against
 *  the server. Plain text by design : the form below it loads
 *  fast enough that a fancy skeleton would feel like overkill. */
export function LoadingPanel() {
  const { t } = useI18n();
  return <p className="text-[13px] text-muted">{t('common.states.loading')}</p>;
}

/** Surface shown when registration is closed on this instance.
 *  No inline link to request an invite — invites are admin-side
 *  only ; the message tells the user to contact one. */
export function ClosedPanel() {
  const { t } = useI18n();
  return (
    <>
      <AuthPanelHeader
        eyebrow={t('auth.register.eyebrow')}
        title={t('auth.register.closed.title')}
        subtitle={t('auth.register.closed.subtitle')}
      />

      <div className="mt-2 text-[12.5px] text-muted">
        <span>{t('auth.register.hasAccountQuestion')}</span>{' '}
        <Link
          to="/login"
          className="cursor-pointer text-accent transition-colors hover:text-accent-deep hover:underline"
        >
          {t('auth.register.goToLogin')}
        </Link>
      </div>
    </>
  );
}

/** Surface shown when the `?token=…` invite code on the URL
 *  fails to validate (used, expired, or truncated during the
 *  copy). Invites the user to ask for a new link. */
export function InvalidInvitePanel() {
  const { t } = useI18n();
  return (
    <>
      <AuthPanelHeader
        eyebrow={t('auth.register.eyebrow')}
        title={t('auth.register.invalidInvite.title')}
        subtitle={t('auth.register.invalidInvite.subtitle')}
      />
      <p className="mb-6 text-[13px] text-muted">
        {t('auth.register.invalidInvite.askNewLink')}
      </p>

      <div className="mt-2 text-[12.5px] text-muted">
        <span>{t('auth.register.hasAccountQuestion')}</span>{' '}
        <Link
          to="/login"
          className="cursor-pointer text-accent transition-colors hover:text-accent-deep hover:underline"
        >
          {t('auth.register.goToLogin')}
        </Link>
      </div>
    </>
  );
}

/** Confirmation screen after a successful **open** registration.
 *  Open mode requires email verification — a 7-day-valid link
 *  is sent ; the user activates from there before being able to
 *  log in. */
export function CheckYourEmailCard({ email }: { email: string }) {
  const { t } = useI18n();
  return (
    <>
      <AuthPanelHeader
        eyebrow={t('auth.register.eyebrow')}
        title={t('auth.register.checkEmail.title')}
        subtitle={
          <>
            {t('auth.register.checkEmail.subtitleBefore')}
            <strong>{email}</strong>
            {t('auth.register.checkEmail.subtitleAfter')}
          </>
        }
      />
      <p className="mb-6 text-[12.5px] text-muted">
        {t('auth.register.checkEmail.linkValidity')}
      </p>

      <div className="mt-2 text-[12.5px] text-muted">
        <Link
          to="/login"
          className="cursor-pointer text-accent transition-colors hover:text-accent-deep hover:underline"
        >
          {t('auth.register.checkEmail.goToLoginPage')}
        </Link>
      </div>
    </>
  );
}

/**
 * Confirmation screen after a successful **invited** submit. The
 * invited path activates the account immediately so the user
 * can head straight to /login — we just show this card briefly
 * then auto-navigate after 1.2s.
 */
export function RedirectingToLoginCard({ email }: { email: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  useEffect(() => {
    const timer = setTimeout(
      () => navigate('/login?activated=1', { replace: true }),
      1200,
    );
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <AuthPanelHeader
      eyebrow={t('auth.register.eyebrow')}
      title={t('auth.register.created.title')}
      subtitle={
        <>
          <strong>{email}</strong>
          {t('auth.register.created.subtitleAfter')}
        </>
      }
    />
  );
}
