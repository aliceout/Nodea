import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { isApiError } from '@/core/api/client';
import { useSession } from '@/core/auth/use-session';
import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import AuthMarketingPanel from '@/ui/dirk/AuthMarketingPanel';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';

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
  // Sub-mode of the TOTP step: enter the live 6-digit code, or a
  // 24-char single-use backup code (when the user lost the
  // authenticator app). Switching modes resets the input so a stale
  // value from one mode can't accidentally be submitted under the
  // other's regex.
  const [totpMode, setTotpMode] = useState<'code' | 'backup'>('code');
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

  // Validation depends on which sub-mode the user picked. The server
  // accepts either format on the same endpoint and disambiguates by
  // length / shape.
  const codeIsTotp = /^\d{6}$/.test(code.trim());
  const codeIsBackup = code.replace(/[^A-Za-z0-9]/g, '').length >= 24;
  const canSubmitTotp =
    !submitting && (totpMode === 'code' ? codeIsTotp : codeIsBackup);

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
        <p className="text-[18px] leading-[1.5] text-ink-soft">
          Le mot de passe seul ne suffit pas dans ton mode de sécurité.
          Confirme avec ton TOTP ou ta passkey pour finir d’ouvrir ta
          session.
        </p>
        <p className="text-[18px] leading-[1.5] text-ink-soft">
          Si tu n’as plus accès à ton facteur, tu peux demander une
          récupération par email — le délai de 7 jours te protège des
          demandes malveillantes.
        </p>
      </AuthMarketingPanel>

      <main className="flex items-center justify-center px-6 py-16 sm:px-14">
        <div className="animate-fade-up w-full max-w-[360px]">
          {step === 'totp' ? (
            <>
              {/* Header + form + escalation links are only visible
                  when the lost-factor flow is idle. As soon as the
                  user clicks "Demander une récupération par email",
                  the LostFlow panel below takes over the entire
                  panel — typing a code is no longer relevant. */}
              {lost.kind === 'idle' ? (
                <>
                  <p className="mb-1 text-[13px] text-muted">Vérification 2FA</p>
                  <h2 className="mb-3 text-[24px] font-semibold tracking-[-0.02em] text-ink">
                    {totpMode === 'code' ? 'Code à six chiffres' : 'Code de secours'}
                  </h2>
                  <p className="mb-6 text-[13.5px] leading-[1.5] text-ink-soft">
                    {totpMode === 'code'
                      ? 'Tape le code affiché par ton appli d’authentification (Bitwarden, Ente Auth, Aegis, Google Auth…). Le code change toutes les 30 secondes.'
                      : 'Tape un de tes 10 codes de secours (24 caractères, tirets optionnels). Chaque code n’est utilisable qu’une seule fois.'}
                  </p>

                  <form onSubmit={onSubmitTotp} noValidate>
                    {totpMode === 'code' ? (
                      <Field
                        key="totp-code"
                        label="Code TOTP"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        autoFocus
                        maxLength={6}
                        pattern="\d{6}"
                        value={code}
                        onChange={(e) =>
                          setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                        }
                        required
                      />
                    ) : (
                      <Field
                        key="totp-backup"
                        label="Code de secours"
                        inputMode="text"
                        autoComplete="one-time-code"
                        autoFocus
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        required
                      />
                    )}

                    {error ? (
                      <InlineAlert className="mb-3">{error}</InlineAlert>
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

                  {/* Escalation links — TOTP code → backup code →
                      email recovery. The user picks the path that
                      matches what they still have access to. */}
                  {totpMode === 'code' ? (
                    <div className="mt-6 border-t border-hair pt-4 text-center text-[12px] text-muted">
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setCode('');
                          setTotpMode('backup');
                        }}
                        className="cursor-pointer transition-colors hover:text-ink"
                      >
                        J’ai perdu mon TOTP → utiliser un code de secours
                      </button>
                    </div>
                  ) : null}

                  {totpMode === 'backup' ? (
                    <>
                      <div className="mt-3 text-center text-[12px] text-muted">
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setCode('');
                            setTotpMode('code');
                          }}
                          className="cursor-pointer transition-colors hover:text-ink"
                        >
                          ← Revenir au code TOTP
                        </button>
                      </div>

                      {/* Last-resort escalation — destructive (TOTP
                          will be wiped) so we keep it visually
                          distinct from the primary "Vérifier" CTA via
                          the danger-outline variant; the wording on
                          the button is explicit enough that the
                          previous amber "warning" callout was just
                          extra chrome around a link. */}
                      <Button
                        variant="danger-outline"
                        size="lg"
                        onClick={() => void startLost('totp')}
                        className="mt-6 w-full"
                      >
                        Demander une récupération par email
                      </Button>
                    </>
                  ) : null}
                </>
              ) : null}

              <LostFlow
                lost={lost}
                factor="totp"
                onConfirm={() => void confirmLost()}
                onCancel={() => setLost({ kind: 'idle' })}
              />
            </>
          ) : null}

          {step === 'passkey' ? (
            <>
              {lost.kind === 'idle' ? (
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
                    <InlineAlert className="mb-3">{error}</InlineAlert>
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

                  <Button
                    variant="danger-outline"
                    size="lg"
                    onClick={() => void startLost('passkey')}
                    className="mt-6 w-full"
                  >
                    Demander une récupération par email
                  </Button>
                </>
              ) : null}

              <LostFlow
                lost={lost}
                factor="passkey"
                onConfirm={() => void confirmLost()}
                onCancel={() => setLost({ kind: 'idle' })}
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
  /** Reset `lost` to `idle` so the parent's form re-appears. Used
   *  by the "← Annuler" link to back out of the panel without
   *  sending the email. Not exposed in the `sent` state since the
   *  email has already gone out. */
  onCancel: () => void;
}

function LostFlow({ lost, factor, onConfirm, onCancel }: LostFlowProps) {
  if (lost.kind === 'idle') return null;
  if (lost.factor !== factor) return null;

  const verbose = factor === 'totp' ? 'TOTP' : 'passkey';
  const sideEffect =
    factor === 'totp'
      ? 'Ton TOTP sera désactivé et tes codes de secours invalidés.'
      : 'Toutes tes passkeys seront supprimées — tu pourras en réenrôler après le login.';

  if (lost.kind === 'confirm') {
    return (
      <>
        <p className="mb-1 text-[13px] text-muted">Vérification 2FA</p>
        <h2 className="mb-3 text-[24px] font-semibold tracking-[-0.02em] text-ink">
          Récupération {verbose}
        </h2>
        <p className="mb-6 text-[13.5px] leading-[1.5] text-ink-soft">
          On va t’envoyer un email avec un lien à confirmer. 7 jours après ta
          confirmation, ta prochaine connexion sera autorisée sans {verbose}.{' '}
          {sideEffect}
        </p>

        <Button
          variant="primary"
          size="lg"
          onClick={onConfirm}
          disabled={lost.submitting}
          className="w-full"
        >
          {lost.submitting ? 'Envoi…' : 'Envoyer l’email'}
        </Button>

        <div className="mt-4.5 text-center text-[12.5px] text-muted">
          <button
            type="button"
            onClick={onCancel}
            disabled={lost.submitting}
            className="cursor-pointer transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            ← Annuler
          </button>
        </div>
      </>
    );
  }

  // sent
  return (
    <>
      <p className="mb-1 text-[13px] text-muted">Vérification 2FA</p>
      <h2 className="mb-3 text-[24px] font-semibold tracking-[-0.02em] text-ink">
        Email envoyé
      </h2>
      <p className="mb-6 text-[13.5px] leading-[1.5] text-ink-soft">
        Vérifie ta boîte mail. Confirme dans le lien — 7 jours après cette
        confirmation, tu pourras te reconnecter sans {verbose}.
      </p>
    </>
  );
}

