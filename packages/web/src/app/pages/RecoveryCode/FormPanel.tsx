import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';

interface FormPanelProps {
  isRegenerate: boolean;
  password: string;
  setPassword: (next: string) => void;
  error: string | null;
  submitting: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

/**
 * Password-prompt panel for the recovery-code KEK setup. Two
 * almost-identical surfaces : « Configurer un code » when the
 * user hasn't set one yet, « Régénérer le code » when they have.
 * Differs only in eyebrow / heading / submit label / subtitle —
 * everything else (the password field, the « ← Retour » link,
 * the submit gating) stays the same.
 */
export default function FormPanel({
  isRegenerate,
  password,
  setPassword,
  error,
  submitting,
  onSubmit,
}: FormPanelProps) {
  const { t } = useI18n();
  return (
    <>
      <AuthPanelHeader
        eyebrow={t('auth.recoveryCode.eyebrow')}
        title={
          isRegenerate
            ? t('auth.recoveryCode.form.titleRegenerate')
            : t('auth.recoveryCode.form.titleSetup')
        }
        subtitle={
          isRegenerate
            ? t('auth.recoveryCode.form.subtitleRegenerate')
            : t('auth.recoveryCode.form.subtitleSetup')
        }
      />

      <form onSubmit={onSubmit} noValidate>
        <Field
          label={t('auth.recoveryCode.form.passwordLabel')}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error ? <InlineAlert className="mb-3">{error}</InlineAlert> : null}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={submitting || !password}
          className="mt-2 w-full"
        >
          {submitting
            ? t('auth.recoveryCode.form.submitting')
            : isRegenerate
              ? t('auth.recoveryCode.form.submitRegenerate')
              : t('auth.recoveryCode.form.submitSetup')}
        </Button>

        <div className="mt-4.5 text-center text-[12.5px] text-muted">
          <Link
            to="/flow"
            className="cursor-pointer transition-colors hover:text-ink"
          >
            {t('auth.recoveryCode.form.back')}
          </Link>
        </div>
      </form>
    </>
  );
}
