import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginBodySchema, type LoginBody } from '@nodea/shared';
import { useSession } from '@/core/auth/use-session';
import { isApiError } from '@/core/api/client';
import Input from '@/ui/atoms/form/Input';
import Button from '@/ui/atoms/base/Button';
import FormError from '@/ui/atoms/form/FormError';
import Logo from '@/ui/branding/LogoLong.jsx';

/**
 * Login page (new back, TSX).
 *
 * Card-centred form with the same visual rhythm as the legacy JSX
 * version: Logo at the top, two labelled inputs, primary button,
 * forgot-password link, and a "create account" footer outside the
 * card.
 */
export default function LoginPage() {
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
      await session.login(values);
      // Client-side nav: stay in the same JS process so the main key
      // we just derived survives. A full reload would wipe it and
      // force the KeyMissingModal for no reason. Security contract is
      // unchanged — the key is still only in non-extractable memory
      // and any real cold reload (F5, tab close) will still lose it.
      navigate('/flow/home', { replace: true });
    } catch (err) {
      if (isApiError(err) && err.status === 401) {
        setServerError('E-mail ou mot de passe incorrect.');
      } else {
        setServerError('Erreur de connexion. Réessayez.');
        if (import.meta.env.DEV) console.warn('login failed', err);
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
          <h1 className="text-center text-lg font-semibold">Connexion</h1>

          <Input
            label="E-mail"
            type="email"
            autoComplete="email"
            required
            {...register('email')}
          />
          {errors.email ? (
            <p role="alert" className="-mt-2 text-xs text-rose-600">
              {errors.email.message}
            </p>
          ) : null}

          <Input
            label="Mot de passe"
            type="password"
            autoComplete="current-password"
            required
            {...register('password')}
          />
          {errors.password ? (
            <p role="alert" className="-mt-2 text-xs text-rose-600">
              {errors.password.message}
            </p>
          ) : null}

          <Button type="submit" variant="primary" disabled={isSubmitting} className="mt-2">
            {isSubmitting ? 'Connexion…' : 'Se connecter'}
          </Button>

          {serverError ? <FormError message={serverError} /> : null}

          <Link to="/request-reset" className="text-center text-xs underline opacity-70">
            Mot de passe oublié ?
          </Link>
        </form>

        <p className="text-center text-sm">
          <span className="opacity-70">Pas de compte ?</span>{' '}
          <Link
            to="/register"
            className="text-nodea-sage underline hover:text-nodea-sage-dark"
          >
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}
