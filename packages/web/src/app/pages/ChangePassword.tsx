import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as zxcvbnCommon from '@zxcvbn-ts/language-common';
import { useSession } from '@/core/auth/use-session';
import { isApiError } from '@/core/api/client';
import { useNodeaStore, selectUser } from '@/core/store/nodea-store';
import Input from '@/ui/atoms/form/Input';
import Button from '@/ui/atoms/base/Button';
import FormError from '@/ui/atoms/form/FormError';

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
 * Change-password page.
 *
 * `useSession.changePassword()` does the full dance: unwrap under the
 * current password (throws on wrong password before any server call),
 * rewrap under the new password, POST the envelope, re-derive the
 * main-key material, store it. This page is a thin form around it.
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

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="flex w-full max-w-md flex-col items-stretch gap-6">
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-4 rounded-lg bg-white p-8 shadow-sm dark:bg-slate-900 dark:shadow-none"
        >
          <h1 className="text-center text-lg font-semibold">Changer le mot de passe</h1>

          <Input
            label="Mot de passe actuel"
            type="password"
            autoComplete="current-password"
            required
            {...field('currentPassword')}
          />
          {errors.currentPassword ? (
            <p role="alert" className="-mt-2 text-xs text-rose-600">
              {errors.currentPassword.message}
            </p>
          ) : null}

          <Input
            label="Nouveau mot de passe (≥ 12 caractères)"
            type="password"
            autoComplete="new-password"
            required
            {...field('newPassword', { onChange: (e) => setNewPwd(e.target.value) })}
          />
          {errors.newPassword ? (
            <p role="alert" className="-mt-2 text-xs text-rose-600">
              {errors.newPassword.message}
            </p>
          ) : null}
          {strength ? (
            <p
              className={`-mt-2 text-xs ${
                strength.score >= 3 ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              Force : {strength.score} / 4
              {strength.warning ? ` — ${strength.warning}` : null}
            </p>
          ) : null}

          <Button type="submit" variant="primary" disabled={isSubmitting} className="mt-2">
            {isSubmitting ? 'Mise à jour…' : 'Mettre à jour'}
          </Button>

          {success ? (
            <p role="status" className="text-center text-sm text-emerald-700">
              Mot de passe mis à jour.
            </p>
          ) : null}
          {serverError ? <FormError message={serverError} /> : null}

          <Link
            to="/flow/account"
            onClick={(e) => {
              e.preventDefault();
              navigate(-1);
            }}
            className="text-center text-xs underline opacity-70"
          >
            ← Retour
          </Link>
        </form>
      </div>
    </div>
  );
}
