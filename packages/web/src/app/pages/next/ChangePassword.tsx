import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as zxcvbnCommon from '@zxcvbn-ts/language-common';
import { useSession } from '@/core/auth/use-session';
import { isApiError } from '@/core/api/client';
import { useNodeaStore, selectUser } from '@/core/store/nodea-store';

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
  const [serverError, setServerError] = useState<string | null>(null);
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
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <h1 className="text-xl font-semibold">Changer le mot de passe</h1>

      <label className="block">
        <span>Mot de passe actuel</span>
        <input
          type="password"
          autoComplete="current-password"
          {...field('currentPassword')}
          className="w-full"
        />
        {errors.currentPassword ? <p role="alert">{errors.currentPassword.message}</p> : null}
      </label>

      <label className="block">
        <span>Nouveau mot de passe</span>
        <input
          type="password"
          autoComplete="new-password"
          {...field('newPassword', { onChange: (e) => setNewPwd(e.target.value) })}
          className="w-full"
        />
        {errors.newPassword ? <p role="alert">{errors.newPassword.message}</p> : null}
        {strength ? (
          <p>
            Force : {strength.score} / 4
            {strength.warning ? ` — ${strength.warning}` : null}
          </p>
        ) : null}
      </label>

      {serverError ? <p role="alert">{serverError}</p> : null}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Mise à jour…' : 'Mettre à jour'}
      </button>
    </form>
  );
}
