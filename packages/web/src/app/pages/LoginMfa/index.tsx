import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { isApiError } from '@/core/api/client';
import { useSession } from '@/core/auth/use-session';
import { useDocumentTitle } from '@/lib/use-document-title';
import AuthLayout from '@/ui/dirk/AuthLayout';

import {
  isValidBackupCode,
  isValidTotpCode,
} from './lib/validation';
import { type LostState } from './LostFlow';
import PasskeyStep from './PasskeyStep';
import TotpStep from './TotpStep';

type Factor = 'totp' | 'passkey' | 'password';

/**
 * Stepped MFA — TOTP + passkey-as-second-factor (Auth-Roadmap
 * Phase 5C-D, Auth-Spec §7.4).
 *
 * Reached after a successful primary login (`/login` password
 * OR the passkey button) when `users.security_mode !=
 * 'password_or_passkey'` and the server emits a `mfa_pending`
 * session. The page steps the user through whatever's still
 * missing :
 *
 *   - TOTP form by default (mode `always_totp`, mode `maximum`
 *     after password-first).
 *   - Passkey button when the server reports `passkey` is still
 *     missing — typically mode `maximum` after the TOTP step
 *     succeeded.
 *
 * The page tracks a `step` state that flips to `'passkey'` when
 * a non-finalizing TOTP verify reports passkey as still pending.
 *
 * Reload safety : the `mfa_pending` cookie has a 5-min TTL. A
 * user who reloads / tabs back later will hit a 401 on submit ;
 * we surface a « session expired, please re-login » message
 * rather than crash.
 *
 * Architecture : this orchestrator owns the state and handles
 * the API errors centrally ; the visual surfaces live in
 * `TotpStep` / `PasskeyStep`, the recovery panel in `LostFlow`,
 * and the input validation in `lib/validation.ts` (with tests).
 */
export default function LoginMfaPage() {
  useDocumentTitle('Vérification 2FA');
  const session = useSession();
  const navigate = useNavigate();
  const [step, setStep] = useState<'totp' | 'passkey'>('totp');
  // Sub-mode of the TOTP step : enter the live 6-digit code, or
  // a 24-char single-use backup code (when the user lost the
  // authenticator app). Switching modes resets the input so a
  // stale value from one mode can't accidentally be submitted
  // under the other's regex.
  const [totpMode, setTotpMode] = useState<'code' | 'backup'>('code');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lost, setLost] = useState<LostState>({ kind: 'idle' });

  // Validation depends on which sub-mode the user picked. The
  // server accepts either format on the same endpoint and
  // disambiguates by length / shape.
  const canSubmitTotp =
    !submitting &&
    (totpMode === 'code' ? isValidTotpCode(code) : isValidBackupCode(code));

  function startLost(factor: 'totp' | 'passkey'): void {
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
        // §6.2 wall : the user has lost too much MFA in mode
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

  function applyMissing(missing: ReadonlyArray<Factor>): void {
    if (missing.includes('passkey')) {
      setStep('passkey');
    } else {
      // Edge case : server reports something we don't have a UI
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
        window.setTimeout(() => navigate('/login', { replace: true }), 1500);
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
        navigate('/flow', { replace: true });
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
        navigate('/flow', { replace: true });
      } else {
        applyMissing(result.missing);
      }
    } catch (err) {
      handleApiError(err, 'Aucune passkey valide n’a répondu.');
    } finally {
      setSubmitting(false);
    }
  }

  function onSwitchToBackup(): void {
    setError(null);
    setCode('');
    setTotpMode('backup');
  }

  return (
    <AuthLayout
      headline="Une dernière étape."
      marketing={
        <>
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
        </>
      }
    >
      {step === 'totp' ? (
        <TotpStep
          totpMode={totpMode}
          code={code}
          submitting={submitting}
          canSubmit={canSubmitTotp}
          error={error}
          lost={lost}
          onCodeChange={setCode}
          onSwitchToBackup={onSwitchToBackup}
          onSubmit={(e) => void onSubmitTotp(e)}
          onStartLost={() => startLost('totp')}
          onCancelLost={() => setLost({ kind: 'idle' })}
          onConfirmLost={() => void confirmLost()}
          onRestartLogin={() => navigate('/login', { replace: true })}
        />
      ) : null}

      {step === 'passkey' ? (
        <PasskeyStep
          submitting={submitting}
          error={error}
          lost={lost}
          onSubmit={() => void onPasskeyClick()}
          onStartLost={() => startLost('passkey')}
          onCancelLost={() => setLost({ kind: 'idle' })}
          onConfirmLost={() => void confirmLost()}
          onRestartLogin={() => navigate('/login', { replace: true })}
        />
      ) : null}
    </AuthLayout>
  );
}
