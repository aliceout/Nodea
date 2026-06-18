import { Link, useNavigate } from 'react-router-dom';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import { useDocumentTitle } from '@/lib/use-document-title';
import AuthLayout from '@/ui/dirk/auth/AuthLayout';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';

import ChangePasswordForm from './ChangePasswordForm';

/**
 * Change-password page — Direction K · Sauge.
 *
 * Two-column shell mirrors Login / Register / Reset / Activate so
 * the auth surface stays one continuous design language.
 *
 * Split (REFACTO-12) :
 *   - `ChangePasswordForm.tsx` owns the RHF + zxcvbn UX and the
 *     submit-then-logout dance.
 *   - This file is the AuthLayout wrap + back link.
 */
export default function ChangePasswordPage() {
  const { t } = useI18n();
  useDocumentTitle(t('auth.changePassword.documentTitle'));
  const navigate = useNavigate();

  return (
    <AuthLayout
      headline={t('auth.changePassword.headline')}
      marketing={
        <>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            {t('auth.changePassword.marketing.p1')}
          </p>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            {t('auth.changePassword.marketing.p2')}
          </p>
        </>
      }
    >
      <AuthPanelHeader
        eyebrow={t('auth.changePassword.eyebrow')}
        title={t('auth.changePassword.pageTitle')}
      />

      <ChangePasswordForm />

      <div className="mt-[18px] text-center text-[12.5px] text-muted">
        <Link
          to="/flow"
          onClick={(e) => {
            e.preventDefault();
            navigate(-1);
          }}
          className="cursor-pointer transition-colors hover:text-ink"
        >
          {t('auth.back')}
        </Link>
      </div>
    </AuthLayout>
  );
}
