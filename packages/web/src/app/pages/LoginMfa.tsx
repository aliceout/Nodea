import { forwardRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { isApiError } from '@/core/api/client';
import { useSession } from '@/core/auth/use-session';
import { cn } from '@/lib/utils';
import AuthMarketingPanel, { PrivacyBody } from '@/ui/dirk/AuthMarketingPanel';

type Factor = 'totp' | 'passkey' | 'password';

/**
 * Stepped MFA — TOTP + passkey-as-second-factor (Auth-Roadmap
 * Phase 5C-D, Auth-Spec §7.4).
 *
 * Reached after a successful primary login (`/login` password OR the
 * passkey button) when `users.security_mode != 'password_or_passkey'`
 * and the server emits a `mfa_pending` session. The page steps the
 * user through whatever's still missing:
 *
 *   - TOTP form by default (mode `always_totp`, mode `maximum` after
 *     password-first).
 *   - Passkey button when the server reports `passkey` is still
 *     missing — typically mode `maximum` after the TOTP step
 *     succeeded.
 *
 * The page tracks a `step` state that flips to `'passkey'` when a
 * non-finalizing TOTP verify reports passkey as still pending.
 *
 * Reload safety: the `mfa_pending` cookie has a 5-min TTL. A user
 * who reloads / tabs back later will hit a 401 on submit; we surface
 * a "session expired, please re-login" message rather than crash.
 */
type LostState =
  | { kind: 'idle' }
  | { kind: 'confirm'; factor: 'totp' | 'passkey'; submitting: boolean }
  | { kind: 'sent'; factor: 'totp' | 'passkey'; earliestApplyAt: string };

export default function LoginMfaPage() {
  const session = useSession();
  const navigate = useNavigate();
  const [step, setStep] = useState<'totp' | 'passkey'>('totp');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lost, setLost] = useState<LostState>({ kind: 'idle' });

  async function startLost(factor: 'totp' | 'passkey'): Promise<void> {
    setError(null);
    setLost({ kind: 'confirm', factor, submitting: false });
  }

  async function confirmLost(): Promise<void> {
    if (lost.kind !== 'confirm') return;
    const factor = lost.factor;
    setLost({ kind: 'confirm', factor, submitting: true });
    try {
      const res = await session.requestMfaBypass(factor);
      setLost({ kind: 'sent', factor, earliestApplyAt: res.earliestApplyAt });
    } catch (err) {
      if (isApiError(err) && err.status === 409 && err.error === 'multi_factor_loss') {
        // §6.2 wall: the user has lost too much MFA in mode
        // `maximum`. Only path forward is the destructive reset.
        navigate('/request-reset', { replace: true });
      } else if (isApiError(err) && err.status === 409 && err.error === 'bypass_already_active') {
        setError('Une demande de récupération est déjà en cours.');
        setLost({ kind: 'idle' });
      } else if (isApiError(err) && err.status === 401) {
        setError('Session expirée. Reconnecte-toi.');
        window.setTimeout(() => navigate('/login', { replace: true }), 1500);
        setLost({ kind: 'idle' });
      } else {
        setError('Erreur. Réessaie.');
        if (import.meta.env.DEV) console.warn('mfa bypass request failed', err);
        setLost({ kind: 'idle' });
      }
    }
  }

  // Heuristic: a 6-digit numeric input is a TOTP code; anything
  // longer is treated as a backup code. The form accepts both —
  // server-side validation gates by length / format.
  const codeIsTotp = /^\d{6}$/.test(code.trim());
  const codeIsBackup = code.replace(/[^A-Za-z0-9]/g, '').length >= 24;
  const canSubmitTotp = !submitting && (codeIsTotp || codeIsBackup);

  function applyMissing(missing: ReadonlyArray<Factor>): void {
    if (missing.includes('passkey')) {
      setStep('passkey');
    } else {
      // Edge case: server reports something we don't have a UI
      // for (e.g. password-as-second-factor in passkey-first
      // maximum). Surface a generic message — the auth routes
      // never return only `password` in practice today.
      setError(
        `Vérification incomplète. Facteur(s) encore requis : ${missing.join(', ')}.`,
      );
    }
  }

  function handleApiError(err: unknown, fallback: string): void {
    if (isApiError(err)) {
      if (err.status === 401 && err.error === 'unauthenticated') {
        setError('Session expirée. Reconnecte-toi.');
        window.setTimeout(
          () => navigate('/login', { replace: true }),
          1500,
        );
      } else if (err.status === 401) {
        setError(fallback);
      } else if (err.status === 429) {
        setError('Trop de tentatives. Réessaie dans quelques minutes.');
      } else {
        setError('Erreur de vérification. Réessaie.');
        if (import.meta.env.DEV) console.warn('mfa verify failed', err);
      }
    } else if (
      typeof err === 'object' &&
      err !== null &&
      (err as { name?: unknown }).name === 'NotAllowedError'
    ) {
      setError('Confirmation passkey annulée.');
    } else {
      setError('Erreur de vérification. Réessaie.');
      if (import.meta.env.DEV) console.warn('mfa verify failed', err);
    }
  }

  async function onSubmitTotp(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!canSubmitTotp) return;
    setSubmitting(true);
    try {
      const result = await session.verifyMfaTotp(code.trim());
      if (result.finalized) {
        navigate('/flow/home', { replace: true });
      } else {
        applyMissing(result.missing);
      }
    } catch (err) {
      handleApiError(err, 'Code incorrect. Réessaie avec celui en cours.');
    } finally {
      setSubmitting(false);
    }
  }

  async function onPasskeyClick(): Promise<void> {
    setError(null);
    setSubmitting(true);
    try {
      const result = await session.verifyMfaPasskey();
      if (result.finalized) {
        navigate('/flow/home', { replace: true });
      } else {
        applyMissing(result.missing);
      }
    } catch (err) {
      handleApiError(err, 'Aucune passkey valide n’a répondu.');
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
          {step === 'totp' ? (
            <>
              <p className="mb-1 text-[13px] text-muted">Vérification 2FA</p>
              <h2 className="mb-3 text-[24px] font-semibold tracking-[-0.02em] text-ink">
                Code à six chiffres
              </h2>
              <p className="mb-6 text-[13.5px] leading-[1.5] text-ink-soft">
                Tape le code affiché par ton appli d’authentification, ou — si
                tu l’as perdue — un de tes 10 codes de secours (24 caractères,
                tirets optionnels).
              </p>

              <form onSubmit={onSubmitTotp} noValidate>
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
                  disabled={!canSubmitTotp}
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

              {lost.kind === 'idle' ? (
                <div className="mt-6 border-t border-hair pt-4 text-center text-[12px] text-muted">
                  <button
                    type="button"
                    onClick={() => void startLost('totp')}
                    className="cursor-pointer transition-colors hover:text-ink"
                  >
                    J’ai perdu mon TOTP → demander une récupération
                  </button>
                </div>
              ) : null}

              <LostFlow
                lost={lost}
                factor="totp"
                onConfirm={() => void confirmLost()}
              />
            </>
          ) : null}

          {step === 'passkey' ? (
            <>
              <p className="mb-1 text-[13px] text-muted">
                Vérification 2FA · 2/2
              </p>
              <h2 className="mb-3 text-[24px] font-semibold tracking-[-0.02em] text-ink">
                Confirme avec ta passkey
              </h2>
              <p className="mb-6 text-[13.5px] leading-[1.5] text-ink-soft">
                Ton mode de sécurité demande une passkey en plus du code TOTP.
                Confirme avec Touch ID, Face ID, Windows Hello ou ta clé
                hardware pour finaliser la connexion.
              </p>

              {error ? (
                <div
                  role="alert"
                  className="mb-3 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[13px] text-danger"
                >
                  {error}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => void onPasskeyClick()}
                disabled={submitting}
                className="mt-2 w-full cursor-pointer rounded-md bg-accent px-4 py-2.75 text-[14px] font-semibold text-white transition-[background-color,transform] hover:bg-accent-hover active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Vérification…' : 'Confirmer avec ma passkey'}
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

              {lost.kind === 'idle' ? (
                <div className="mt-6 border-t border-hair pt-4 text-center text-[12px] text-muted">
                  <button
                    type="button"
                    onClick={() => void startLost('passkey')}
                    className="cursor-pointer transition-colors hover:text-ink"
                  >
                    J’ai perdu ma passkey → demander une récupération
                  </button>
                </div>
              ) : null}

              <LostFlow
                lost={lost}
                factor="passkey"
                onConfirm={() => void confirmLost()}
              />
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}

/* ============================================================================
 * Lost-factor flow inline panel
 * ========================================================================== */

interface LostFlowProps {
  lost: LostState;
  /** Factor of the parent step. We render the flow only when
   *  `lost` matches this factor — the user never has two flows
   *  open simultaneously. */
  factor: 'totp' | 'passkey';
  onConfirm: () => void;
}

function LostFlow({ lost, factor, onConfirm }: LostFlowProps) {
  if (lost.kind === 'idle') return null;
  if (lost.factor !== factor) return null;

  if (lost.kind === 'confirm') {
    const verbose = factor === 'totp' ? 'TOTP' : 'passkey';
    const sideEffect =
      factor === 'totp'
        ? 'Ton TOTP sera désactivé et tes codes de secours invalidés.'
        : 'Toutes tes passkeys seront supprimées — tu pourras en réenrôler après le login.';
    return (
      <div className="mt-4 rounded-md border border-amber-500 bg-amber-500/10 px-4 py-3 dark:bg-amber-500/15">
        <p className="mb-2 text-[12.5px] font-semibold text-amber-700 dark:text-amber-200">
          Récupération de {verbose}
        </p>
        <p className="mb-3 text-[12.5px] leading-[1.45] text-ink-soft">
          On va t’envoyer un email avec un lien à confirmer. 48h après ta
          confirmation, ta prochaine connexion sera autorisée sans {verbose}.
          {' '}
          {sideEffect}
        </p>
        <button
          type="button"
          onClick={onConfirm}
          disabled={lost.submitting}
          className="w-full cursor-pointer rounded-md bg-accent px-3 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {lost.submitting ? 'Envoi…' : 'Envoyer l’email'}
        </button>
      </div>
    );
  }

  // sent
  const verboseSent = factor === 'totp' ? 'TOTP' : 'passkey';
  return (
    <div
      role="status"
      className="mt-4 rounded-md border border-accent bg-accent/5 px-4 py-3"
    >
      <p className="mb-1 text-[12.5px] font-semibold text-accent-deep">
        Email envoyé
      </p>
      <p className="text-[12.5px] leading-[1.45] text-ink-soft">
        Vérifie ta boîte mail. Confirme dans le lien — 48h après cette
        confirmation, tu pourras te reconnecter sans {verboseSent}.
      </p>
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
