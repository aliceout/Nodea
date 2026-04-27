import { forwardRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FingerPrintIcon } from '@heroicons/react/24/outline';
import { LoginBodySchema, type LoginBody } from '@nodea/shared';
import { useSession } from '@/core/auth/use-session';
import { isApiError } from '@/core/api/client';
import { cn } from '@/lib/utils';
import AuthMarketingPanel, { PrivacyBody } from '@/ui/dirk/AuthMarketingPanel';
import Button from '@/ui/atoms/dirk/Button';

/**
 * Login — Direction K · Sauge.
 *
 * Pixel-precise port of `Design/design_handoff_nodea/source/dir-k.jsx
 * → K_Login`. Two columns: marketing panel on `bg-bg-2` left,
 * compact form on `bg-bg` right. The form uses the K house input
 * directly — 1px hairline border that flips to accent on focus
 * with a 3px accent-soft ring — rather than reaching for a
 * primitive that would smother the design intent.
 */
export default function LoginPage() {
  const session = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);
  // `?activated=1` lands here from `Activate.tsx` after a successful
  // magic-link click. We surface a one-shot success banner so the
  // user knows their account is ready to log in.
  const justActivated = params.get('activated') === '1';
  // `?password-changed=1` lands here from `ChangePassword.tsx` after
  // the OPAQUE re-registration succeeded — the server revoked every
  // session and we logged the client out, so the user has to type
  // their new password to continue. The banner confirms the rotation
  // happened so they don't think it failed silently.
  const justChangedPassword = params.get('password-changed') === '1';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginBody>({
    resolver: zodResolver(LoginBodySchema),
    defaultValues: { email: '', password: '' },
  });

  const [passkeyBusy, setPasskeyBusy] = useState(false);

  async function onSubmit(values: LoginBody): Promise<void> {
    setServerError(null);
    try {
      const result = await session.login(values);
      if (result.needsMfa) {
        navigate('/login/mfa', { replace: true });
      } else {
        navigate('/flow/home', { replace: true });
      }
    } catch (err) {
      if (isApiError(err)) {
        if (err.status === 403 && err.error === 'account_not_activated') {
          setServerError(
            'Ton compte n’est pas encore activé. Clique sur le lien envoyé par e-mail pour l’activer.',
          );
        } else if (err.status === 401) {
          setServerError('E-mail ou mot de passe incorrect.');
        } else {
          setServerError('Erreur de connexion. Réessaie.');
        }
      } else {
        setServerError('Erreur de connexion. Réessaie.');
        if (import.meta.env.DEV) console.warn('login failed', err);
      }
    }
  }

  /**
   * Drive a passkey-first login. The OS / browser surfaces a
   * credential picker — discoverable creds (resident keys) appear
   * even without an email. On a fully-unlocked PRF login the user
   * lands on /flow/home; on a non-PRF (or PRF deferred) login we
   * stay on the page so they can chain a password to finish the
   * unwrap.
   */
  async function onPasskeyClick(): Promise<void> {
    setServerError(null);
    setPasskeyBusy(true);
    try {
      const result = await session.loginWithPasskey({});
      if (result.needsMfa) {
        // Stepped MFA: the session is `mfa_pending`, the user
        // still needs TOTP (and possibly password for mode max).
        // The MFA page will drive the next factor.
        navigate('/login/mfa', { replace: true });
      } else if (result.fullyUnlocked) {
        navigate('/flow/home', { replace: true });
      } else {
        setServerError(
          'Cette passkey ne déchiffre pas tes données. Saisis ton mot de passe pour finaliser.',
        );
      }
    } catch (err) {
      if (isWebAuthnCancel(err)) {
        // User dismissed the picker — silent, no error.
      } else if (isApiError(err) && err.status === 401) {
        setServerError('Aucune passkey valide n’a répondu.');
      } else {
        setServerError('Échec de la connexion par passkey.');
        if (import.meta.env.DEV) console.warn('passkey login failed', err);
      }
    } finally {
      setPasskeyBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 bg-bg text-ink lg:grid-cols-[1fr_480px]">
      <AuthMarketingPanel headline="Là où personne ne lit.">
        <PrivacyBody />
      </AuthMarketingPanel>

      {/* Form panel */}
      <main className="flex items-center justify-center px-6 py-16 sm:px-14">
        <div className="animate-fade-up w-full max-w-[360px]">
          <p className="mb-1 text-[13px] text-muted">Connexion</p>
          <h2 className="mb-7 text-[24px] font-semibold tracking-[-0.02em] text-ink">
            Entre dans ton espace
          </h2>

          {justActivated ? (
            <div
              role="status"
              className="mb-4 border-l-2 border-accent bg-accent/5 px-3 py-2 text-[13px] text-accent-deep"
            >
              ✓ Compte activé. Connecte-toi avec ton e-mail et ton mot de passe.
            </div>
          ) : null}

          {justChangedPassword ? (
            <div
              role="status"
              className="mb-4 border-l-2 border-accent bg-accent/5 px-3 py-2 text-[13px] text-accent-deep"
            >
              ✓ Mot de passe mis à jour. Connecte-toi avec le nouveau.
            </div>
          ) : null}

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
              <div
                role="alert"
                className="mb-3 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[13px] text-danger"
              >
                {serverError}
              </div>
            ) : null}

            <Button
              variant="primary"
              size="lg"
              type="submit"
              disabled={isSubmitting || passkeyBusy}
              className="mt-2 w-full"
            >
              {isSubmitting ? 'Connexion…' : 'Se connecter'}
            </Button>

            {/* Passkey alternative — secondary affordance below the
                primary password submit. Hidden on browsers that don't
                support WebAuthn at all (older Firefox, very old
                browsers); on supported browsers, the OS prompt surfaces
                discoverable credentials so the user can pick without
                typing the email. */}
            {typeof window !== 'undefined' &&
              typeof window.PublicKeyCredential !== 'undefined' ? (
              <Button
                variant="neutral"
                size="lg"
                onClick={() => void onPasskeyClick()}
                disabled={isSubmitting || passkeyBusy}
                className="mt-2 w-full gap-2"
              >
                {passkeyBusy ? (
                  'Vérification…'
                ) : (
                  <>
                    <FingerPrintIcon className="h-4 w-4" aria-hidden="true" />
                    Se connecter avec une passkey
                  </>
                )}
              </Button>
            ) : null}

            <div className="mt-[18px] flex items-center justify-between text-[12.5px] text-muted">
              <Link
                to="/request-reset"
                className="cursor-pointer transition-colors hover:text-ink"
              >
                Mot de passe oublié
              </Link>
              <Link
                to="/register"
                className="cursor-pointer text-accent transition-colors hover:text-accent-deep hover:underline"
              >
                Créer un compte
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

/**
 * `navigator.credentials.get` rejects with `NotAllowedError` when
 * the user dismisses the picker or the operation times out. We
 * silence that case rather than nag — the user explicitly cancelled.
 */
function isWebAuthnCancel(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const name = (err as { name?: unknown }).name;
  return name === 'NotAllowedError' || name === 'AbortError';
}

interface FieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'children'> {
  label: string;
  error?: string | undefined;
}

const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, className, id, name, ...rest },
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
      {error ? (
        <p id={`${inputId}-error`} role="alert" className="mt-1 text-[11px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
});
