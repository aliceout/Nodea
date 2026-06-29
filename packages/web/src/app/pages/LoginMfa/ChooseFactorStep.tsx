import { type FormEvent } from 'react';
import { FingerPrintIcon } from '@heroicons/react/24/outline';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';

import { sanitizeTotpInput } from './lib/validation';
import LostFlow, { type LostState } from './LostFlow';

/** Discreet text-link control styling — carries a visible focus-visible ring
 *  (the global reset strips the native outline on `<button>`; only the Button
 *  atom otherwise restores one) and a disabled state so it can't be clicked
 *  mid-verify. */
const LINK_CLASS =
  'cursor-pointer rounded-sm transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60';

interface ChooseFactorStepProps {
  totpMode: 'code' | 'backup';
  code: string;
  /** True while ANY factor's verify is in flight (gates every control). */
  submitting: boolean;
  /** Which factor is actually running — drives the « Vérification… » label on
   *  the right button only, so a TOTP submit doesn't make the passkey button
   *  read as busy (and vice versa). */
  pendingFactor: 'totp' | 'passkey' | 'password' | null;
  /** `canSubmitTotp` from the orchestrator (gates the TOTP submit). */
  canSubmit: boolean;
  error: string | null;
  lost: LostState;
  onCodeChange: (next: string) => void;
  onSwitchToBackup: () => void;
  onSubmitTotp: (e: FormEvent<HTMLFormElement>) => void;
  onPasskey: () => void;
  onStartLostTotp: () => void;
  onStartLostPasskey: () => void;
  onCancelLost: () => void;
  onConfirmLost: () => void;
  onRestartLogin: () => void;
}

/**
 * Combined 2nd-factor screen for the OR case — mode `always_2fa`, password-first,
 * with BOTH TOTP and a passkey enrolled, where verifying EITHER one finalizes the
 * login (issue #72, Auth-Spec §7.4). Replaces the old two-button picker + its
 * separate TOTP / passkey sub-screens: the TOTP field is right here, and
 * « Confirmer avec ma passkey » triggers WebAuthn on the same screen — one fewer
 * click than the old dedicated picker. Order: the passkey button sits at the top,
 * then the « ou » divider, then the TOTP field + Vérifier; recovery links stack
 * under each factor and « Recommencer » closes the panel.
 *
 * Scope: ONLY the alternatives case. The stepped `maximum` flow (TOTP THEN
 * passkey, both mandatory in turn) still uses the separate `TotpStep` /
 * `PasskeyStep` — those aren't alternatives, they're a sequence, so they can't be
 * collapsed onto one screen.
 *
 * Recovery levers are unchanged, just co-located: « J'ai perdu mon TOTP » keeps
 * the two-stage escalation (→ backup code, then → email recovery) and « J'ai
 * perdu ma passkey » triggers the email recovery directly. Both run through the
 * shared `LostFlow`, which takes over the whole panel once engaged. EVERY control
 * (incl. the recovery levers + « Recommencer ») is disabled while a verify is in
 * flight, so a still-pending WebAuthn ceremony can't be swapped out from under.
 *
 * No security change: the server still verifies each factor independently
 * (`/auth/mfa/{totp,passkey}/verify`); this only co-locates the two entry points.
 */
export default function ChooseFactorStep({
  totpMode,
  code,
  submitting,
  pendingFactor,
  canSubmit,
  error,
  lost,
  onCodeChange,
  onSwitchToBackup,
  onSubmitTotp,
  onPasskey,
  onStartLostTotp,
  onStartLostPasskey,
  onCancelLost,
  onConfirmLost,
  onRestartLogin,
}: ChooseFactorStepProps) {
  const { t } = useI18n();

  return (
    <>
      {lost.kind === 'idle' ? (
        <>
          <AuthPanelHeader
            eyebrow={t('auth.mfa.eyebrow')}
            title={t('auth.mfa.combined.title')}
            subtitle={<>{t('auth.mfa.combined.subtitle')}</>}
          />

          {error ? <InlineAlert className="mb-3">{error}</InlineAlert> : null}

          {/* Passkey alternative first (verifying it also finalizes the
              login — « l'un des deux suffit »). */}
          <Button
            variant="secondary"
            size="lg"
            onClick={onPasskey}
            disabled={submitting}
            className="w-full gap-2"
          >
            {pendingFactor === 'passkey' ? (
              t('common.states.verifying')
            ) : (
              <>
                <FingerPrintIcon className="h-4 w-4" aria-hidden="true" />
                {t('auth.mfa.combined.passkeyCta')}
              </>
            )}
          </Button>

          <div className="mt-3 text-center text-[12px] text-muted">
            <button
              type="button"
              onClick={onStartLostPasskey}
              disabled={submitting}
              className={LINK_CLASS}
            >
              {t('auth.mfa.passkey.lostPasskey')}
            </button>
          </div>

          {/* — ou — the TOTP path. Whole separator hidden from AT: the subtitle
              already says « l'un des deux suffit », so the lone « ou » would
              just be an orphan word for screen readers. */}
          <div
            className="mt-6 flex items-center gap-3 text-[12px] text-muted"
            aria-hidden="true"
          >
            <span className="h-px flex-1 bg-hair" />
            {t('auth.mfa.combined.or')}
            <span className="h-px flex-1 bg-hair" />
          </div>

          <form onSubmit={onSubmitTotp} noValidate className="mt-4">
            {totpMode === 'code' ? (
              <Field
                key="totp-code"
                label={t('auth.mfa.totp.codeLabel')}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                pattern="\d{6}"
                value={code}
                onChange={(e) => onCodeChange(sanitizeTotpInput(e.target.value))}
                required
              />
            ) : (
              <Field
                key="totp-backup"
                label={t('auth.mfa.totp.backupLabel')}
                inputMode="text"
                autoComplete="one-time-code"
                autoFocus
                value={code}
                onChange={(e) => onCodeChange(e.target.value)}
                required
              />
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={!canSubmit}
              className="mt-2 w-full"
            >
              {pendingFactor === 'totp'
                ? t('common.states.verifying')
                : t('common.actions.verify')}
            </Button>
          </form>

          {/* « J'ai perdu mon TOTP » — escalation 1 (code → backup) inline ; once
              in backup mode the destructive email-recovery button replaces it.
              Disabled mid-verify so it can't swap the panel out. */}
          {totpMode === 'code' ? (
            <div className="mt-3 text-center text-[12px] text-muted">
              <button
                type="button"
                onClick={onSwitchToBackup}
                disabled={submitting}
                className={LINK_CLASS}
              >
                {t('auth.mfa.totp.switchToBackup')}
              </button>
            </div>
          ) : (
            <Button
              variant="danger-outline"
              size="lg"
              onClick={onStartLostTotp}
              disabled={submitting}
              className="mt-3 w-full"
            >
              {t('auth.mfa.requestEmailRecovery')}
            </Button>
          )}

          <div className="mt-4.5 text-center text-[12.5px] text-muted">
            <button
              type="button"
              onClick={onRestartLogin}
              disabled={submitting}
              className={LINK_CLASS}
            >
              {t('auth.mfa.restartLogin')}
            </button>
          </div>
        </>
      ) : null}

      {/* Either recovery flow takes over the panel; each renders only when
          `lost.factor` matches, so they never both show. */}
      <LostFlow lost={lost} factor="totp" onConfirm={onConfirmLost} onCancel={onCancelLost} />
      <LostFlow lost={lost} factor="passkey" onConfirm={onConfirmLost} onCancel={onCancelLost} />
    </>
  );
}
