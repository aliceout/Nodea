import { forwardRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { isApiError } from '@/core/api/client';
import { useSession } from '@/core/auth/use-session';
import { cn } from '@/lib/utils';
import AuthMarketingPanel, { PrivacyBody } from '@/ui/dirk/AuthMarketingPanel';

/**
 * Stepped MFA — TOTP step (Auth-Roadmap Phase 5C, Auth-Spec §7.4).
 *
 * Reached after a successful primary login (`/login` password OR the
 * passkey button) when `users.security_mode != 'password_or_passkey'`
 * and the server emits a `mfa_pending` session. The page collects a
 * TOTP code OR a 24-char backup code in the same field — the server
 * disambiguates by format. On success the server promotes the
 * session to `full` and the client navigates to `/flow/home`.
 *
 * Phase 5D adds the passkey-as-second-factor route for mode
 * `maximum`. When `verifyMfaTotp` returns `finalized: false`, the
 * `missing` array points the user to the next step (currently we
 * just surface a "more factors needed" error — Phase 5D wires the
 * actual route).
 *
 * Reload safety: the `mfa_pending` cookie has a 5-min TTL. A user
 * who reloads / tabs back later will hit a 401 on submit; we surface
 * a "session expired, please re-login" message rather than crash.
 */
export default function LoginMfaPage() {
  const session = useSession();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Heuristic: a 6-digit numeric input is a TOTP code; anything
  // longer is treated as a backup code. The form accepts both —
  // server-side validation gates by length / format.
  const codeIsTotp = /^\d{6}$/.test(code.trim());
  const codeIsBackup = code.replace(/[^A-Za-z0-9]/g, '').length >= 24;
  const canSubmit = !submitting && (codeIsTotp || codeIsBackup);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const result = await session.verifyMfaTotp(code.trim());
      if (result.finalized) {
        navigate('/flow/home', { replace: true });
      } else {
        // Phase 5C ships TOTP only — additional factors land in
        // Phase 5D (passkey-as-second-factor for mode `maximum`).
        // Until that route exists we surface an explicit message.
        setError(
          `Vérification incomplète. Facteur(s) encore requis : ${result.missing.join(', ')}.`,
        );
      }
    } catch (err) {
      if (isApiError(err)) {
        if (err.status === 401 && err.error === 'unauthenticated') {
          setError('Session expirée. Reconnecte-toi.');
          // Drop back to login after a beat so the user reads the
          // message before being redirected.
          window.setTimeout(
            () => navigate('/login', { replace: true }),
            1500,
          );
        } else if (err.status === 401) {
          setError('Code incorrect. Réessaie avec celui en cours.');
        } else if (err.status === 429) {
          setError('Trop de tentatives. Réessaie dans quelques minutes.');
        } else {
          setError('Erreur de vérification. Réessaie.');
          if (import.meta.env.DEV) console.warn('mfa totp verify failed', err);
        }
      } else {
        setError('Erreur de vérification. Réessaie.');
        if (import.meta.env.DEV) console.warn('mfa totp verify failed', err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 bg-bg text-ink lg:grid-cols-[1fr_480px]">
      <AuthMarketingPanel headline="Une dernière étape.">
        <PrivacyBody />
      </AuthMarketingPanel>

      <main className="flex items-center justify-center px-6 py-16 sm:px-14">
        <div className="animate-fade-up w-full max-w-[360px]">
          <p className="mb-1 text-[13px] text-muted">Vérification 2FA</p>
          <h2 className="mb-3 text-[24px] font-semibold tracking-[-0.02em] text-ink">
            Code à six chiffres
          </h2>
          <p className="mb-6 text-[13.5px] leading-[1.5] text-ink-soft">
            Tape le code affiché par ton appli d’authentification, ou — si tu
            l’as perdue — un de tes 10 codes de secours (24 caractères, tirets
            optionnels).
          </p>

          <form onSubmit={onSubmit} noValidate>
            <Field
              label="Code TOTP ou code de secours"
              inputMode="text"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />

            {error ? (
              <div
                role="alert"
                className="mb-3 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[13px] text-danger"
              >
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={!canSubmit}
              className="mt-2 w-full cursor-pointer rounded-md bg-accent px-4 py-2.75 text-[14px] font-semibold text-white transition-[background-color,transform] hover:bg-accent-hover active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Vérification…' : 'Vérifier'}
            </button>

            <div className="mt-4.5 text-center text-[12.5px] text-muted">
              <button
                type="button"
                onClick={() => navigate('/login', { replace: true })}
                className="cursor-pointer transition-colors hover:text-ink"
              >
                ← Recommencer la connexion
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
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
      <label htmlFor={inputId} className="mb-1.25 block text-[12px] font-medium text-muted">
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
