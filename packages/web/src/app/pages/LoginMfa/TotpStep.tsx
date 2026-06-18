import { type FormEvent } from 'react';

import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';

import { sanitizeTotpInput } from './lib/validation';
import LostFlow, { type LostState } from './LostFlow';

interface TotpStepProps {
  totpMode: 'code' | 'backup';
  code: string;
  submitting: boolean;
  canSubmit: boolean;
  error: string | null;
  lost: LostState;
  onCodeChange: (next: string) => void;
  onSwitchToBackup: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onStartLost: () => void;
  onCancelLost: () => void;
  onConfirmLost: () => void;
  onRestartLogin: () => void;
}

/**
 * TOTP verification surface — first step of the stepped MFA flow.
 *
 * Two sub-modes :
 *   - `code` : the 6-digit code from the authenticator app
 *     (sanitised on every keystroke to drop non-digits).
 *   - `backup` : a 24-character single-use code (when the user
 *     lost the authenticator). Switching modes resets the input.
 *
 * Three escalation levers, in increasing destructiveness :
 *   1. « J'ai perdu mon TOTP → utiliser un code de secours »
 *      flips the sub-mode without leaving the page.
 *   2. « Demander une récupération par email » (only in backup
 *      mode) opens the `LostFlow` panel — wipes TOTP after the
 *      7-day delay confirmation.
 *   3. « ← Recommencer la connexion » navigates back to /login.
 *
 * The lost-factor flow takes over the panel as soon as it goes
 * past `idle`, hiding the regular form ; both surfaces never
 * coexist.
 */
export default function TotpStep({
  totpMode,
  code,
  submitting,
  canSubmit,
  error,
  lost,
  onCodeChange,
  onSwitchToBackup,
  onSubmit,
  onStartLost,
  onCancelLost,
  onConfirmLost,
  onRestartLogin,
}: TotpStepProps) {
  return (
    <>
      {lost.kind === 'idle' ? (
        <>
          <AuthPanelHeader
            eyebrow="Vérification 2FA"
            title={totpMode === 'code' ? 'Code à six chiffres' : 'Code de secours'}
            subtitle={
              totpMode === 'code'
                ? 'Tape le code affiché par ton appli d’authentification (Bitwarden, Ente Auth, Aegis, Google Auth…). Le code change toutes les 30 secondes.'
                : 'Tape un de tes 10 codes de secours (24 caractères, tirets optionnels). Chaque code n’est utilisable qu’une seule fois.'
            }
          />

          <form onSubmit={onSubmit} noValidate>
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
                onChange={(e) => onCodeChange(sanitizeTotpInput(e.target.value))}
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
                onChange={(e) => onCodeChange(e.target.value)}
                required
              />
            )}

            {error ? <InlineAlert className="mb-3">{error}</InlineAlert> : null}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={!canSubmit}
              className="mt-2 w-full"
            >
              {submitting ? 'Vérification…' : 'Vérifier'}
            </Button>
          </form>

          {/* Escalation 1 : code → backup. Visible only in
              `code` mode ; once flipped, the user can come back
              by reloading the page. */}
          {totpMode === 'code' ? (
            <div className="mt-6 border-t border-hair pt-4 text-center text-[12px] text-muted">
              <button
                type="button"
                onClick={onSwitchToBackup}
                className="cursor-pointer transition-colors hover:text-ink"
              >
                J’ai perdu mon TOTP → utiliser un code de secours
              </button>
            </div>
          ) : null}

          {/* Escalation 2 : backup → email recovery. Destructive
              (TOTP wiped) so it carries the danger-outline
              variant ; the wording is explicit enough that the
              old amber « warning » callout was just chrome. */}
          {totpMode === 'backup' ? (
            <Button
              variant="danger-outline"
              size="lg"
              onClick={onStartLost}
              className="mt-6 w-full"
            >
              Demander une récupération par email
            </Button>
          ) : null}

          {/* Always-last fallback — sits below every escalation
              so the visual hierarchy reads « primary action →
              escalations → give up and start over ». */}
          <div className="mt-4.5 text-center text-[12.5px] text-muted">
            <button
              type="button"
              onClick={onRestartLogin}
              className="cursor-pointer transition-colors hover:text-ink"
            >
              ← Recommencer la connexion
            </button>
          </div>
        </>
      ) : null}

      <LostFlow
        lost={lost}
        factor="totp"
        onConfirm={onConfirmLost}
        onCancel={onCancelLost}
      />
    </>
  );
}
