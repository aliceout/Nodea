import { type FormEvent } from 'react';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';

interface PasswordStepProps {
  password: string;
  submitting: boolean;
  canSubmit: boolean;
  error: string | null;
  onPasswordChange: (next: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onRestartLogin: () => void;
}

/**
 * Password verification surface — the password-as-second-factor step
 * for mode `maximum` entered passkey-first (remaining factors =
 * password + totp). Reached after the TOTP step when the server still
 * reports `password` as missing.
 *
 * Proves the OPAQUE password on the pending session
 * (`session.verifyMfaPassword`). It is also where the main key is
 * derived when the passkey used to enter was non-PRF — that detail
 * lives in `core/auth/session/login.ts`; here it's just a password form.
 *
 * No lost-factor lever (unlike TOTP / passkey): a forgotten *password*
 * isn't a per-factor MFA bypass — it's the destructive account reset,
 * reachable from the login page after « Recommencer la connexion ».
 */
export default function PasswordStep({
  password,
  submitting,
  canSubmit,
  error,
  onPasswordChange,
  onSubmit,
  onRestartLogin,
}: PasswordStepProps) {
  const { t } = useI18n();

  return (
    <>
      <AuthPanelHeader
        eyebrow={t('auth.mfa.eyebrow')}
        title={t('auth.mfa.password.title')}
        subtitle={<>{t('auth.mfa.password.subtitle')}</>}
      />

      <form onSubmit={onSubmit} noValidate>
        <Field
          label={t('auth.mfa.password.label')}
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          required
        />

        {error ? <InlineAlert className="mb-3">{error}</InlineAlert> : null}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={!canSubmit}
          className="mt-2 w-full"
        >
          {submitting ? t('common.states.verifying') : t('common.actions.verify')}
        </Button>
      </form>

      <div className="mt-4.5 text-center text-[12.5px] text-muted">
        <button
          type="button"
          onClick={onRestartLogin}
          className="cursor-pointer transition-colors hover:text-ink"
        >
          {t('auth.mfa.restartLogin')}
        </button>
      </div>
    </>
  );
}
