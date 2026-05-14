import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { LoginBodySchema, type LoginBody } from '@nodea/shared';

import { useSession } from '@/core/auth/use-session';
import { apiErrorMessage } from '@/core/api/client';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';

/**
 * Email + password login form (REFACTO-12 split).
 *
 * Owns its own RHF state — the parent `Login/index.tsx` only
 * orchestrates the surrounding banners, the passkey alternative,
 * and the AuthLayout wrap. Splitting was warranted by the original
 * Login.tsx crossing the 200-LOC threshold (CLAUDE.md § Page-level
 * file organisation).
 *
 * Submit handler calls `useSession().login` and navigates either
 * to `/login/mfa` (stepped MFA branch) or `/flow` (direct full
 * session). On error, the helper `apiErrorMessage` resolves the
 * api code to the localised string ; we never differentiate
 * « unknown email » vs « wrong password » in the UI (anti-enum).
 *
 * `disabled` lets the parent disable the form while the passkey
 * button is busy — pressing both at the same time would race.
 */
export default function LoginForm({ disabled = false }: { disabled?: boolean }) {
  const { t } = useI18n();
  const session = useSession();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginBody>({
    resolver: zodResolver(LoginBodySchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: LoginBody): Promise<void> {
    setServerError(null);
    try {
      const result = await session.login(values);
      if (result.needsMfa) {
        // Forward the OR-set hint (issue #72) via navigation state
        // so `/login/mfa` knows whether to surface a picker (both
        // TOTP and passkey accepted) or default straight to the
        // TOTP form. Lost on page reload, which is fine : the
        // page already handles that fallback.
        navigate('/login/mfa', {
          replace: true,
          state: { factorsNeeded: result.factorsNeeded },
        });
      } else {
        navigate('/flow', { replace: true });
      }
    } catch (err) {
      // Single source of truth for the FR / EN message — see
      // `core/api/error-message.ts` + `errors.json`. The previous
      // inline switch fell out of sync with the API codes ; this
      // helper resolves any known code, falls back to the generic
      // « unknown » entry for anything new, and the « network »
      // entry when the catch fired on a non-ApiError shape (fetch
      // refused, JSON parse threw, etc.).
      setServerError(apiErrorMessage(err, t));
      if (import.meta.env.DEV) console.warn('login failed', err);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Field
        label="E-mail"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register('email')}
      />
      <Field
        label="Mot de passe"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register('password')}
      />

      {serverError ? (
        <InlineAlert className="mb-3">{serverError}</InlineAlert>
      ) : null}

      <Button
        variant="primary"
        size="lg"
        type="submit"
        disabled={isSubmitting || disabled}
        className="mt-2 w-full"
      >
        {isSubmitting ? 'Connexion…' : 'Se connecter'}
      </Button>
    </form>
  );
}
