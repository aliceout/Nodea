import type { FormEvent } from 'react';
import {
  PASSWORD_MIN_LENGTH,
  type PasswordRulesCheck,
} from '@nodea/shared';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import PasswordRulesList from '@/ui/atoms/auth/PasswordRulesList';
import StrengthBar from '@/ui/atoms/auth/StrengthBar';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';

interface PasswordPanelProps {
  password: string;
  setPassword: (next: string) => void;
  confirm: string;
  setConfirm: (next: string) => void;
  rules: PasswordRulesCheck;
  rulesOk: boolean;
  strength: { score: number; warning: string | null } | null;
  confirmMismatch: boolean;
  error: string | null;
  submitting: boolean;
  canSubmit: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
}

/**
 * Step 2 of the split recovery flow (issue #48) : pick a new
 * password once the (email, mnemonic) pair has been validated by
 * step 1. The PasswordRulesList + StrengthBar combo mirrors what
 * Register / ChangePassword show, so the password feedback
 * experience stays consistent across every surface that asks for
 * a password.
 */
export default function PasswordPanel(props: PasswordPanelProps) {
  const {
    password,
    setPassword,
    confirm,
    setConfirm,
    rules,
    rulesOk,
    strength,
    confirmMismatch,
    error,
    submitting,
    canSubmit,
    onSubmit,
    onBack,
  } = props;
  const { t } = useI18n();

  return (
    <>
      <AuthPanelHeader
        eyebrow={t('auth.recover.password.eyebrow', { defaultValue: 'Récupération · étape 2' })}
        title={t('auth.recover.password.title', { defaultValue: 'Choisis un nouveau mot de passe' })}
        subtitle={
          <>
            {t('auth.recover.password.subtitle', {
              defaultValue:
                'Ton code est validé. On va rechiffrer ta clé sous ce nouveau mot de passe sans toucher à tes entrées existantes.',
            })}
          </>
        }
      />

      <form onSubmit={onSubmit} noValidate>
        <Field
          label={t('auth.recover.form.newPasswordLabel')}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={PASSWORD_MIN_LENGTH}
          autoFocus
          required
        />
        <PasswordRulesList rules={rules} />
        {strength ? (
          <StrengthBar
            score={strength.score as 0 | 1 | 2 | 3 | 4}
            warning={strength.warning}
            rulesOk={rulesOk}
          />
        ) : null}

        <Field
          label={t('auth.recover.form.confirmPasswordLabel')}
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          error={
            confirmMismatch
              ? t('auth.recover.form.confirmMismatch')
              : undefined
          }
        />

        {error ? <InlineAlert className="mb-3">{error}</InlineAlert> : null}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={!canSubmit}
          className="mt-2 w-full"
        >
          {submitting
            ? t('auth.recover.form.submitting')
            : t('auth.recover.form.submit')}
        </Button>

        <div className="mt-4.5 text-center text-[12.5px] text-muted">
          <button
            type="button"
            onClick={onBack}
            className="cursor-pointer transition-colors hover:text-ink"
          >
            {t('auth.recover.password.back', {
              defaultValue: '← Changer de code',
            })}
          </button>
        </div>
      </form>
    </>
  );
}
