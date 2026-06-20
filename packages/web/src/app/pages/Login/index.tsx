import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRightIcon } from '@heroicons/react/24/outline';

import { PrivacyBody } from '@/ui/dirk/auth/AuthMarketingPanel';
import { useDocumentTitle } from '@/lib/use-document-title';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import AuthLayout from '@/ui/dirk/auth/AuthLayout';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';

import LoginForm from './LoginForm';
import PasskeyButton from './PasskeyButton';

/**
 * Login — Direction K · Sauge.
 *
 * Pixel-precise port of `Design/design_handoff_nodea/source/dir-k.jsx
 * → K_Login`. Two columns: marketing panel on `bg-bg-2` left,
 * compact form on `bg-bg` right.
 *
 * Split (REFACTO-12) :
 *   - `LoginForm.tsx` owns the email + password RHF form.
 *   - `PasskeyButton.tsx` owns the passkey alternative + its OS
 *     prompt dance.
 *   - This file orchestrates : doc title, the two one-shot success
 *     banners (`?activated=1` and `?password-changed=1`), the
 *     bottom links (forgot / register), and the AuthLayout wrap.
 */
export default function LoginPage() {
  const { t } = useI18n();
  useDocumentTitle(t('auth.login.title'));
  const [params] = useSearchParams();
  const [passkeyBusy, setPasskeyBusy] = useState(false);

  // `?activated=1` lands here from `Activate.tsx` after a successful
  // magic-link click. We surface a one-shot success banner so the
  // user knows their account is ready to log in.
  const justActivated = params.get('activated') === '1';
  // `?password-changed=1` lands here from `ChangePassword.tsx` after
  // the OPAQUE re-registration succeeded — the server revoked every
  // session and we logged the client out, so the user has to type
  // their new password to continue. The banner confirms the rotation
  // happened so they don't think it failed silently.
  const justChangedPassword = params.get('password-changed') === '1';
  // `?session-lost=1` lands here from the flow Layout when the in-memory
  // main key went missing (e.g. a page reload on a still-valid session):
  // the user was signed out and bounced here. Red banner asks them to
  // sign in again.
  const sessionLost = params.get('session-lost') === '1';

  return (
    <AuthLayout
      headline={t('auth.login.marketingHeadline')}
      marketing={
        <>
          <PrivacyBody />
          {/* Follow-through after the marketing copy: an explicit
              "next step" link for the curious reader. Pairs with
              the shorter "Sécurité" link in the panel footer (always
              reachable for skimmers) — the two entries are at
              different visual altitudes so they don't compete. */}
          <Link
            to="/docs/newbie"
            className="group inline-flex cursor-pointer items-center gap-1.5 pt-1 text-[15px] text-accent underline-offset-2 transition-colors hover:text-accent-deep hover:underline"
          >
            {t('auth.login.privacyLink')}
            <ArrowRightIcon
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </>
      }
    >
      <AuthPanelHeader
        eyebrow={t('auth.login.title')}
        title={t('auth.login.panelTitle')}
      />

      {sessionLost ? (
        <InlineAlert className="mb-4">
          {t('auth.login.sessionLostBanner')}
        </InlineAlert>
      ) : null}

      {justActivated ? (
        <InlineAlert tone="success" className="mb-4">
          ✓ {t('auth.login.activatedBanner')}
        </InlineAlert>
      ) : null}

      {justChangedPassword ? (
        <InlineAlert tone="success" className="mb-4">
          ✓ {t('auth.login.passwordChangedBanner')}
        </InlineAlert>
      ) : null}

      <LoginForm disabled={passkeyBusy} />

      <PasskeyButton onBusyChange={setPasskeyBusy} />

      <div className="mt-[18px] flex items-center justify-between text-[12.5px] text-muted">
        <Link
          to="/request-reset"
          className="cursor-pointer transition-colors hover:text-ink"
        >
          {t('auth.login.forgotPassword')}
        </Link>
        <Link
          to="/register"
          className="cursor-pointer text-accent transition-colors hover:text-accent-deep hover:underline"
        >
          {t('auth.login.createAccount')}
        </Link>
      </div>
    </AuthLayout>
  );
}
