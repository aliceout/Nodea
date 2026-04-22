import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginBodySchema, type LoginBody } from '@nodea/shared';
import { useSession } from '@/core/auth/use-session';
import { isApiError } from '@/core/api/client';

/**
 * Login page (new back, TSX).
 *
 * Difference vs. the legacy `Login.jsx`:
 *   - Posts to `/auth/login` on the new Hono API, not to PocketBase.
 *   - Validates the form with the shared Zod schema (single source of
 *     truth with the server).
 *   - No verbose `console.log`s in prod — any debug is gated to
 *     `import.meta.env.DEV`.
 *   - No PB-specific lookup (authStore); the session cookie is the
 *     only auth signal.
 */
export default function LoginPage() {
  const session = useSession();
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
      window.location.href = '/flow/home';
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
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <h1 className="text-xl font-semibold">Connexion</h1>

      <label className="block">
        <span>E-mail</span>
        <input
          type="email"
          autoComplete="email"
          {...register('email')}
          className="w-full"
        />
        {errors.email ? <p role="alert">{errors.email.message}</p> : null}
      </label>

      <label className="block">
        <span>Mot de passe</span>
        <input
          type="password"
          autoComplete="current-password"
          {...register('password')}
          className="w-full"
        />
        {errors.password ? <p role="alert">{errors.password.message}</p> : null}
      </label>

      {serverError ? <p role="alert">{serverError}</p> : null}

      <div className="flex items-center justify-between gap-3">
        <Link to="/request-reset" className="text-sm underline opacity-80">
          Mot de passe oublié ?
        </Link>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Connexion…' : 'Se connecter'}
        </button>
      </div>
    </form>
  );
}
