import { forwardRef, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as zxcvbnCommon from '@zxcvbn-ts/language-common';
import { useSession } from '@/core/auth/use-session';
import { isApiError } from '@/core/api/client';
import { useNodeaStore, selectUser } from '@/core/store/nodea-store';
import { cn } from '@/lib/utils';
import AuthMarketingPanel from '@/ui/dirk/AuthMarketingPanel';

zxcvbnOptions.setOptions({
  dictionary: zxcvbnCommon.dictionary,
  graphs: zxcvbnCommon.adjacencyGraphs,
});

const ChangePasswordFormSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(12).max(200),
});
type ChangePasswordForm = z.infer<typeof ChangePasswordFormSchema>;

/**
 * Change-password page — Direction K · Sauge.
 *
 * `useSession.changePassword()` does the full dance: unwrap under the
 * current password (throws on wrong password before any server call),
 * rewrap under the new password, POST the envelope, re-derive the
 * main-key material, store it. This page is a thin form around it.
 *
 * Two-column shell mirrors Login / Register / Reset / Activate so
 * the auth surface stays one continuous design language. The
 * marketing panel here carries password-specific copy — re-using the
 * standard `<PrivacyBody />` would be off-tone (the user is already
 * inside Nodea, not deciding whether to sign up).
 */
export default function ChangePasswordPage() {
  const session = useSession();
  const user = useNodeaStore(selectUser);
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [newPwd, setNewPwd] = useState('');

  const strength = useMemo(() => {
    if (!newPwd) return null;
    const { score, feedback } = zxcvbn(newPwd);
    return { score, warning: feedback.warning ?? null };
  }, [newPwd]);

  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(ChangePasswordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  async function onSubmit(values: ChangePasswordForm): Promise<void> {
    setServerError(null);
    if (!user) {
      setServerError('Session absente — reconnecte-toi.');
      return;
    }
    try {
      await session.changePassword(values);
      setSuccess(true);
    } catch (err) {
      // AES-GCM auth-tag failure during unwrap = wrong current password.
      if (err instanceof Error && /decrypt|auth|OperationError/i.test(err.message)) {
        setServerError('Mot de passe actuel incorrect.');
        return;
      }
      if (isApiError(err) && err.status === 401) {
        setServerError('Mot de passe actuel incorrect.');
      } else if (isApiError(err) && err.status === 400) {
        setServerError(err.reason ?? 'Nouveau mot de passe refusé.');
      } else {
        setServerError('Erreur lors du changement de mot de passe.');
        if (import.meta.env.DEV) console.warn('change-password failed', err);
      }
    }
  }

  const newPasswordRegister = field('newPassword', {
    onChange: (e) => setNewPwd(e.target.value),
  });

  return (
    <div className="grid min-h-screen grid-cols-1 bg-bg text-ink lg:grid-cols-[1fr_480px]">
      <AuthMarketingPanel headline="Renouvelle ta clé.">
        <p className="text-[18px] leading-[1.5] text-ink-soft">
          Le mot de passe protège la clé qui chiffre tes données. Le changer
          rechiffre la clé localement — les données restent intactes.
        </p>
        <p className="text-[18px] leading-[1.5] text-ink-soft">
          Le serveur ne voit jamais l’ancien ni le nouveau mot de passe : tout
          se passe sur ton appareil avant l’envoi.
        </p>
      </AuthMarketingPanel>

      <main className="flex items-center justify-center px-6 py-16 sm:px-14">
        <div className="animate-fade-up w-full max-w-[360px]">
          <p className="mb-1 text-[13px] text-muted">Sécurité</p>
          <h2 className="mb-7 text-[24px] font-semibold tracking-[-0.02em] text-ink">
            Changer le mot de passe
          </h2>

          {success ? (
            <div
              role="status"
              className="mb-4 border-l-2 border-accent bg-accent/5 px-3 py-2 text-[13px] text-accent-deep"
            >
              ✓ Mot de passe mis à jour.
            </div>
          ) : null}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <Field
              label="Mot de passe actuel"
              type="password"
              autoComplete="current-password"
              required
              error={errors.currentPassword?.message}
              {...field('currentPassword')}
            />
            <Field
              label="Nouveau mot de passe (≥ 12 caractères)"
              type="password"
              autoComplete="new-password"
              required
              error={errors.newPassword?.message}
              legend={
                strength ? (
                  <span
                    className={cn(
                      strength.score >= 3 ? 'text-accent-deep' : 'text-muted',
                    )}
                  >
                    Force : {strength.score} / 4
                    {strength.warning ? ` — ${strength.warning}` : ''}
                  </span>
                ) : undefined
              }
              {...newPasswordRegister}
            />

            {serverError ? (
              <div
                role="alert"
                className="mb-3 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[13px] text-danger"
              >
                {serverError}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 w-full rounded-md bg-accent px-4 py-[11px] text-[14px] font-semibold text-white transition-[background-color,transform] hover:bg-accent-deep active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Mise à jour…' : 'Mettre à jour'}
            </button>

            <div className="mt-[18px] text-center text-[12.5px] text-muted">
              <Link
                to="/flow/account"
                onClick={(e) => {
                  e.preventDefault();
                  navigate(-1);
                }}
                className="cursor-pointer transition-colors hover:text-ink"
              >
                ← Retour
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

interface FieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'children'> {
  label: string;
  legend?: React.ReactNode;
  error?: string | undefined;
}

const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, legend, error, className, id, name, ...rest },
  ref,
) {
  const inputId = id ?? `field-${name ?? label.replace(/\W/g, '-').toLowerCase()}`;
  return (
    <div className="mb-3.5">
      <label htmlFor={inputId} className="mb-[5px] block text-[12px] font-medium text-muted">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={cn(
          'w-full rounded-md border border-hair bg-bg px-3 py-2.5 text-[14px] text-ink',
          'outline-none transition-[border-color,box-shadow]',
          'focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--color-k-accent-soft)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...rest}
      />
      {legend && !error ? (
        <p className="mt-1 text-[11px] text-muted">{legend}</p>
      ) : null}
      {error ? (
        <p id={`${inputId}-error`} role="alert" className="mt-1 text-[11px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
});
