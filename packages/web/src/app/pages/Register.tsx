import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as zxcvbnCommon from '@zxcvbn-ts/language-common';
import { useSession } from '@/core/auth/use-session';
import { isApiError } from '@/core/api/client';
import Input from '@/ui/atoms/form/Input';
import Button from '@/ui/atoms/base/Button';
import FormError from '@/ui/atoms/form/FormError';
import Logo from '@/ui/branding/LogoLong.jsx';

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
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="flex w-full max-w-md flex-col items-stretch gap-6">
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-4 rounded-lg bg-white p-8 shadow-sm dark:bg-slate-900 dark:shadow-none"
        >
          <Logo className="mx-auto mb-2 w-1/2" />
          <h1 className="text-center text-lg font-semibold">Créer un compte</h1>

          <Input label="E-mail" type="email" autoComplete="email" required {...field('email')} />
          {errors.email ? (
            <p role="alert" className="-mt-2 text-xs text-rose-600">
              {errors.email.message}
            </p>
          ) : null}

          <Input
            label="Mot de passe (≥ 12 caractères)"
            type="password"
            autoComplete="new-password"
            required
            {...field('password', { onChange: (e) => setPassword(e.target.value) })}
          />
          {errors.password ? (
            <p role="alert" className="-mt-2 text-xs text-rose-600">
              {errors.password.message}
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

          <Input
            label="Code d'invitation"
            type="text"
            required
            {...field('inviteCode')}
          />
          {errors.inviteCode ? (
            <p role="alert" className="-mt-2 text-xs text-rose-600">
              {errors.inviteCode.message}
            </p>
          ) : null}

          <Button type="submit" variant="primary" disabled={isSubmitting} className="mt-2">
            {isSubmitting ? 'Inscription…' : 'Créer le compte'}
          </Button>

          {serverError ? <FormError message={serverError} /> : null}
        </form>

        <p className="text-center text-sm">
          <span className="opacity-70">Déjà un compte ?</span>{' '}
          <Link to="/login" className="text-nodea-sage underline hover:text-nodea-sage-dark">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
