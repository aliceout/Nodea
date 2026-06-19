import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  PASSWORD_MIN_LENGTH,
  UsernameField,
  checkPasswordRules,
  passwordRulesPassed,
} from '@nodea/shared';

import { zxcvbn } from '@/core/auth/password-strength';

import { apiErrorMessage, isApiError } from '@/core/api/client';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import PasswordRulesList from '@/ui/atoms/auth/PasswordRulesList';
import StrengthBar from '@/ui/atoms/auth/StrengthBar';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';

const RegisterFormSchema = z
  .object({
    username: UsernameField,
    password: z.string().min(PASSWORD_MIN_LENGTH).max(200),
    confirmPassword: z.string().min(1).max(200),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    // Stable sentinel translated at render time via i18n; the Zod
    // schema runs outside the React tree so `t` isn't available here.
    message: 'password_mismatch',
  });
type RegisterForm = z.infer<typeof RegisterFormSchema>;

interface RegisterFormProps {
  mode: { kind: 'invited'; email: string; token: string } | { kind: 'open' };
  onSubmitted: (email: string) => void;
  submitRegistration: (input: {
    email: string;
    username: string;
    password: string;
    inviteToken?: string;
  }) => Promise<{ activated: boolean; email?: string }>;
}

/**
 * The actual « créer un compte » form — handles both `invited`
 * (email locked, token shipped along) and `open` (email is a
 * regular field) modes through a single discriminated union.
 *
 * Live password feedback (rules + zxcvbn strength bar) mirrors
 * what `Recover` and `ChangePassword` show ; gating reads
 * `passwordRulesPassed` from `@nodea/shared` so the front +
 * server stay in lockstep.
 *
 * Server errors are mapped to per-status FR messages — `400
 * weak_password`, `400 email_mismatch`, `401 invalid token`,
 * `403 closed`, `429 rate-limit`. The fallback covers anything
 * unexpected.
 */
export default function RegisterFormView({
  mode,
  onSubmitted,
  submitRegistration,
}: RegisterFormProps) {
  const { t } = useI18n();
  const [serverError, setServerError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  // Open mode lets the user type their email ; invited mode
  // pre-fills it from the invite (read-only, locked).
  const [emailInput, setEmailInput] = useState(
    mode.kind === 'invited' ? mode.email : '',
  );

  const rules = useMemo(() => checkPasswordRules(password), [password]);
  const rulesOk = passwordRulesPassed(rules);
  const strength = useMemo(() => {
    if (!password) return null;
    const { score, feedback } = zxcvbn(password);
    return { score, warning: feedback.warning ?? null };
  }, [password]);
  const confirmMismatch = confirm.length > 0 && confirm !== password;
  const emailLooksValid = /\S+@\S+\.\S+/.test(emailInput);

  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(RegisterFormSchema),
    defaultValues: { username: '', password: '', confirmPassword: '' },
  });

  async function onSubmit(values: RegisterForm): Promise<void> {
    setServerError(null);
    if (!rulesOk) {
      setServerError(t('auth.register.form.passwordRulesUnmet'));
      return;
    }
    if (mode.kind === 'open' && !emailLooksValid) {
      setServerError(t('auth.register.form.emailInvalid'));
      return;
    }
    try {
      const input: {
        email: string;
        username: string;
        password: string;
        inviteToken?: string;
      } = {
        email: emailInput,
        username: values.username,
        password: values.password,
      };
      if (mode.kind === 'invited') input.inviteToken = mode.token;
      const result = await submitRegistration(input);
      onSubmitted(result.email ?? emailInput);
    } catch (err) {
      // Page-specific override : the api ships
      // `{ error: 'register_failed', reason: 'email_mismatch' }`
      // when the invite was issued for a different e-mail. The
      // generic helper would translate to « inscription a échoué »
      // which masks the actionable copy. Catch the reason here and
      // inline the bilingual message.
      if (isApiError(err) && err.reason === 'email_mismatch') {
        setServerError(
          t('errors.register.emailMismatch', {
            defaultValue:
              'L’e-mail ne correspond pas à celui de l’invitation.',
          }),
        );
      } else {
        setServerError(apiErrorMessage(err, t));
        if (import.meta.env.DEV) console.warn('register submit failed', err);
      }
    }
  }

  return (
    <>
      <AuthPanelHeader
        eyebrow={t('auth.register.eyebrow')}
        title={t('auth.register.form.title')}
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field
          label={t('auth.register.form.emailLabel')}
          type="email"
          autoComplete="email"
          value={emailInput}
          readOnly={mode.kind === 'invited'}
          onChange={(e) =>
            mode.kind === 'open'
              ? setEmailInput(e.currentTarget.value)
              : undefined
          }
        />
        {mode.kind === 'invited' ? (
          <p className="-mt-2 mb-3.5 text-[11.5px] text-muted">
            {t('auth.register.form.emailLockedHint')}
          </p>
        ) : null}

        <Field
          label={t('auth.register.form.usernameLabel')}
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          error={
            errors.username?.message === 'invalid_username'
              ? t('auth.register.form.usernameInvalid')
              : errors.username?.message
          }
          {...field('username')}
        />
        <p className="-mt-2 mb-3.5 text-[11.5px] text-muted">
          {t('auth.register.form.usernameHint')}
        </p>

        <Field
          label={t('auth.register.form.passwordLabel')}
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...field('password', {
            onChange: (e) => setPassword(e.target.value),
          })}
        />

        <PasswordRulesList rules={rules} />
        {strength ? (
          <StrengthBar
            score={strength.score}
            warning={strength.warning}
            rulesOk={rulesOk}
          />
        ) : null}

        <Field
          label={t('auth.register.form.confirmPasswordLabel')}
          type="password"
          autoComplete="new-password"
          error={
            confirmMismatch || errors.confirmPassword?.message === 'password_mismatch'
              ? t('auth.register.form.passwordMismatch')
              : errors.confirmPassword?.message
          }
          {...field('confirmPassword', {
            onChange: (e) => setConfirm(e.target.value),
          })}
        />

        {serverError ? (
          <InlineAlert className="mb-3">{serverError}</InlineAlert>
        ) : null}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={
            isSubmitting ||
            !rulesOk ||
            confirmMismatch ||
            password !== confirm ||
            (mode.kind === 'open' && !emailLooksValid)
          }
          className="mt-2 w-full"
        >
          {isSubmitting
            ? t('common.states.submitting')
            : t('auth.register.form.submit')}
        </Button>

        {/*
         * « Déjà un compte ? Se connecter » only makes sense in
         * the open registration path. Invited users got here
         * from an email link ; they're being onboarded onto
         * THIS instance specifically and don't have an account
         * on it yet (the admin route enforces
         * `user_already_exists` 409 before sending the invite).
         * Showing a « log in » detour here would distract them
         * from completing their inscription.
         */}
        {mode.kind === 'open' ? (
          <div className="mt-[18px] flex items-center justify-between text-[12.5px] text-muted">
            <span>{t('auth.register.hasAccountQuestion')}</span>
            <Link
              to="/login"
              className="cursor-pointer text-accent transition-colors hover:text-accent-deep hover:underline"
            >
              {t('auth.register.goToLogin')}
            </Link>
          </div>
        ) : null}
      </form>
    </>
  );
}
