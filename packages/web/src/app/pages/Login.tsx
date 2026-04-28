import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FingerPrintIcon } from '@heroicons/react/24/outline';
import { LoginBodySchema, type LoginBody } from '@nodea/shared';
import { useSession } from '@/core/auth/use-session';
import { isApiError } from '@/core/api/client';
import { PrivacyBody } from '@/ui/dirk/AuthMarketingPanel';
import AuthLayout from '@/ui/dirk/AuthLayout';
import AuthPanelHeader from '@/ui/dirk/AuthPanelHeader';
import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';

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
    <AuthLayout headline="Un espace à soi" marketing={<PrivacyBody />}>
      <AuthPanelHeader eyebrow="Connexion" title="Entre dans ton espace" />

          {justActivated ? (
            <InlineAlert tone="success" className="mb-4">
              ✓ Compte activé. Connecte-toi avec ton e-mail et ton mot de passe.
            </InlineAlert>
          ) : null}

          {justChangedPassword ? (
            <InlineAlert tone="success" className="mb-4">
              ✓ Mot de passe mis à jour. Connecte-toi avec le nouveau.
            </InlineAlert>
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
              <InlineAlert className="mb-3">{serverError}</InlineAlert>
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
                className="mt-2 w-full gap-2 font-normal"
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
    </AuthLayout>
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

