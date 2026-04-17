import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as zxcvbnCommon from '@zxcvbn-ts/language-common';
import { useSession } from '@/core/auth/use-session';
import { isApiError } from '@/core/api/client';

zxcvbnOptions.setOptions({
  dictionary: zxcvbnCommon.dictionary,
  graphs: zxcvbnCommon.adjacencyGraphs,
});

/**
 * Form-only schema — the real RegisterBody (email/password/invite +
 * encryption envelope) is built by `useSession.register()` which
 * wraps the freshly generated main key before POSTing.
 */
const RegisterFormSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(12).max(200),
  inviteCode: z.string().min(1).max(128),
});
type RegisterForm = z.infer<typeof RegisterFormSchema>;

export default function RegisterPage() {
  const session = useSession();
  const [serverError, setServerError] = useState<string | null>(null);
  const [password, setPassword] = useState('');

  const strength = useMemo(() => {
    if (!password) return null;
    const { score, feedback } = zxcvbn(password);
    return { score, warning: feedback.warning ?? null };
  }, [password]);

  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(RegisterFormSchema),
    defaultValues: { email: '', password: '', inviteCode: '' },
  });

  async function onSubmit(values: RegisterForm): Promise<void> {
    setServerError(null);
    try {
      await session.register(values);
      window.location.href = '/flow/home';
    } catch (err) {
      if (isApiError(err) && err.status === 400) {
        setServerError(err.reason ?? 'Échec de l’inscription.');
      } else {
        setServerError('Erreur lors de l’inscription. Réessayez.');
        if (import.meta.env.DEV) console.warn('register failed', err);
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <h1 className="text-xl font-semibold">Inscription</h1>

      <label className="block">
        <span>E-mail</span>
        <input type="email" autoComplete="email" {...field('email')} className="w-full" />
        {errors.email ? <p role="alert">{errors.email.message}</p> : null}
      </label>

      <label className="block">
        <span>Mot de passe</span>
        <input
          type="password"
          autoComplete="new-password"
          {...field('password', { onChange: (e) => setPassword(e.target.value) })}
          className="w-full"
        />
        {errors.password ? <p role="alert">{errors.password.message}</p> : null}
        {strength ? (
          <p>
            Force : {strength.score} / 4
            {strength.warning ? ` — ${strength.warning}` : null}
          </p>
        ) : null}
      </label>

      <label className="block">
        <span>Code d’invitation</span>
        <input type="text" {...field('inviteCode')} className="w-full" />
        {errors.inviteCode ? <p role="alert">{errors.inviteCode.message}</p> : null}
      </label>

      {serverError ? <p role="alert">{serverError}</p> : null}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Inscription…' : 'Créer le compte'}
      </button>
    </form>
  );
}
