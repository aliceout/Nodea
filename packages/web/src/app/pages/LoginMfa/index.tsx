import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { isApiError } from '@/core/api/client';
import { useSession } from '@/core/auth/use-session';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { useDocumentTitle } from '@/lib/use-document-title';
import AuthLayout from '@/ui/dirk/auth/AuthLayout';

import ChooseFactorStep from './ChooseFactorStep';
import {
  isValidBackupCode,
  isValidTotpCode,
} from './lib/validation';
import { type LostState } from './LostFlow';
import PasskeyStep from './PasskeyStep';
import PasswordStep from './PasswordStep';
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
 *   - Combined TOTP-field + passkey-button screen (`ChooseFactorStep`)
 *     when issue #72 applies (mode `always_2fa` password-first with
 *     BOTH TOTP and a passkey enrolled — verifying EITHER finalizes).
 *     The server signals this by listing both `'totp'` and `'passkey'`
 *     in `factorsNeeded` ; the page forwards that hint via the
 *     navigation state from `/login`.
 *   - TOTP form by default (mode `always_2fa` TOTP-only, mode
 *     `maximum` after password-first).
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
 * rather than crash. The picker hint is lost on reload too —
 * the page falls back to the TOTP form, which is still a valid
 * path (server-side both factors satisfy the policy).
 *
 * Architecture : this orchestrator owns the state and handles
 * the API errors centrally ; the visual surfaces live in
 * `ChooseFactorStep` / `TotpStep` / `PasskeyStep`, the recovery panel
 * in `LostFlow`, and the input validation in `lib/validation.ts`
 * (with tests).
 */
interface LoginMfaLocationState {
  factorsNeeded?: ReadonlyArray<'totp' | 'passkey' | 'password'>;
  /**
   * Issue #72 discriminator forwarded from `/login` and
   * `/passkeys/login`. True when the listed factors are
   * alternatives (verifying any ONE finalizes — `always_2fa`
   * password-first with both enrolled). False / absent when
   * the listed factors are mandatory in turn (`maximum`).
   */
  secondFactorChoice?: boolean;
}

export default function LoginMfaPage() {
  useDocumentTitle('Vérification 2FA');
  const { t } = useI18n();
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state as LoginMfaLocationState | null) ?? null;
  const factorsNeeded = navState?.factorsNeeded;
  // Picker only shows when the server explicitly flagged
  // `secondFactorChoice` AND the wire still lists both
  // alternatives. Reload → navState is null → fall back to
  // TOTP (still a valid path : the server accepts either).
  const initialStep: 'picker' | 'totp' | 'passkey' | 'password' =
    navState?.secondFactorChoice === true &&
    factorsNeeded !== undefined &&
    factorsNeeded.includes('totp') &&
    factorsNeeded.includes('passkey')
      ? 'picker'
      : 'totp';
  const [step, setStep] = useState<'picker' | 'totp' | 'passkey' | 'password'>(
    initialStep,
  );
  // Sub-mode of the TOTP step : enter the live 6-digit code, or
  // a 24-char single-use backup code (when the user lost the
  // authenticator app). Switching modes resets the input so a
  // stale value from one mode can't accidentally be submitted
  // under the other's regex.
  const [totpMode, setTotpMode] = useState<'code' | 'backup'>('code');
  const [code, setCode] = useState('');
  // Password-as-second-factor input (mode `maximum`, passkey-first).
  const [password, setPassword] = useState('');
  // Which factor's verify is in flight (null = idle). Drives the shared
  // `submitting` guard AND per-button « Vérification… » feedback on the merged
  // ChooseFactorStep, so only the factor actually running shows the busy label.
  const [pendingFactor, setPendingFactor] = useState<Factor | null>(null);
  const submitting = pendingFactor !== null;
  const [error, setError] = useState<string | null>(null);
  const [lost, setLost] = useState<LostState>({ kind: 'idle' });

  // Validation depends on which sub-mode the user picked. The
  // server accepts either format on the same endpoint and
  // disambiguates by length / shape.
  const canSubmitTotp =
    !submitting &&
    (totpMode === 'code' ? isValidTotpCode(code) : isValidBackupCode(code));
  const canSubmitPassword = !submitting && password.length > 0;

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
        setError(t('auth.mfa.errors.bypassAlreadyActive'));
        setLost({ kind: 'idle' });
      } else if (isApiError(err) && err.status === 401) {
        setError(t('auth.mfa.errors.sessionExpired'));
        window.setTimeout(() => navigate('/login', { replace: true }), 1500);
        setLost({ kind: 'idle' });
      } else {
        setError(t('auth.mfa.errors.generic'));
        if (import.meta.env.DEV) console.warn('mfa bypass request failed', err);
        setLost({ kind: 'idle' });
      }
    }
  }

  function applyMissing(missing: ReadonlyArray<Factor>): void {
    // Route to whichever step has UI for the remaining factor.
    // Order matters when several are missing (e.g. `maximum`
    // after the picker fired and the user picked TOTP first :
    // post-verify the server reports `['passkey']`, post-passkey
    // it reports `['totp']`). We prefer the step the user isn't
    // already on, to avoid a no-op transition.
    if (missing.includes('passkey') && step !== 'passkey') {
      setStep('passkey');
      return;
    }
    if (missing.includes('password') && step !== 'password') {
      setStep('password');
      return;
    }
    if (missing.includes('totp') && step !== 'totp') {
      setStep('totp');
      return;
    }
    // Fallback : the server reported a factor we have no UI for. With
    // password (mode `maximum` passkey-first), totp and passkey all
    // handled, this should be unreachable — surface a generic message
    // rather than strand the user silently.
    setError(
      t('auth.mfa.errors.incompleteFactors', {
        values: { factors: missing.join(', ') },
      }),
    );
  }

  function handleApiError(err: unknown, fallback: string): void {
    if (isApiError(err)) {
      if (err.status === 401 && err.error === 'unauthenticated') {
        setError(t('auth.mfa.errors.sessionExpired'));
        window.setTimeout(() => navigate('/login', { replace: true }), 1500);
      } else if (err.status === 401) {
        setError(fallback);
      } else if (err.status === 429) {
        setError(t('auth.mfa.errors.tooManyAttempts'));
      } else {
        setError(t('auth.mfa.errors.verifyFailed'));
        if (import.meta.env.DEV) console.warn('mfa verify failed', err);
      }
    } else if (
      typeof err === 'object' &&
      err !== null &&
      (err as { name?: unknown }).name === 'NotAllowedError'
    ) {
      setError(t('auth.mfa.errors.passkeyCancelled'));
    } else {
      setError(t('auth.mfa.errors.verifyFailed'));
      if (import.meta.env.DEV) console.warn('mfa verify failed', err);
    }
  }

  async function onSubmitTotp(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!canSubmitTotp) return;
    setPendingFactor('totp');
    try {
      const result = await session.verifyMfaTotp(code.trim());
      if (result.finalized) {
        navigate('/flow', { replace: true });
      } else {
        applyMissing(result.missing);
      }
    } catch (err) {
      handleApiError(err, t('auth.mfa.errors.wrongTotpCode'));
    } finally {
      setPendingFactor(null);
    }
  }

  async function onPasskeyClick(): Promise<void> {
    setError(null);
    setPendingFactor('passkey');
    try {
      const result = await session.verifyMfaPasskey();
      if (result.finalized) {
        navigate('/flow', { replace: true });
      } else {
        applyMissing(result.missing);
      }
    } catch (err) {
      handleApiError(err, t('auth.mfa.errors.noValidPasskey'));
    } finally {
      setPendingFactor(null);
    }
  }

  async function onSubmitPassword(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!canSubmitPassword) return;
    setPendingFactor('password');
    try {
      const result = await session.verifyMfaPassword(password);
      if (result.finalized) {
        navigate('/flow', { replace: true });
      } else {
        applyMissing(result.missing);
      }
    } catch (err) {
      handleApiError(err, t('auth.mfa.errors.wrongPassword'));
    } finally {
      setPendingFactor(null);
    }
  }

  function onSwitchToBackup(): void {
    setError(null);
    setCode('');
    setTotpMode('backup');
  }

  return (
    <AuthLayout
      headline={t('auth.mfa.layout.headline')}
      marketing={
        <>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            {t('auth.mfa.layout.marketing1')}
          </p>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            {t('auth.mfa.layout.marketing2')}
          </p>
        </>
      }
    >
      {step === 'picker' ? (
        <ChooseFactorStep
          totpMode={totpMode}
          code={code}
          submitting={submitting}
          pendingFactor={pendingFactor}
          canSubmit={canSubmitTotp}
          error={error}
          lost={lost}
          onCodeChange={setCode}
          onSwitchToBackup={onSwitchToBackup}
          onSubmitTotp={(e) => void onSubmitTotp(e)}
          onPasskey={() => void onPasskeyClick()}
          onStartLostTotp={() => startLost('totp')}
          onStartLostPasskey={() => startLost('passkey')}
          onCancelLost={() => setLost({ kind: 'idle' })}
          onConfirmLost={() => void confirmLost()}
          onRestartLogin={() => navigate('/login', { replace: true })}
        />
      ) : null}

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

      {step === 'password' ? (
        <PasswordStep
          password={password}
          submitting={submitting}
          canSubmit={canSubmitPassword}
          error={error}
          onPasswordChange={setPassword}
          onSubmit={(e) => void onSubmitPassword(e)}
          onRestartLogin={() => navigate('/login', { replace: true })}
        />
      ) : null}
    </AuthLayout>
  );
}
