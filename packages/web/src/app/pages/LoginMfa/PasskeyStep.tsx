import Button from '@/ui/atoms/dirk/Button';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';

import LostFlow, { type LostState } from './LostFlow';

interface PasskeyStepProps {
  submitting: boolean;
  error: string | null;
  lost: LostState;
  onSubmit: () => void;
  onStartLost: () => void;
  onCancelLost: () => void;
  onConfirmLost: () => void;
  onRestartLogin: () => void;
}

/**
 * Passkey verification surface — second step of the stepped
 * MFA flow. Reached only in mode `maximum` after the TOTP step
 * succeeded but the server still reports `passkey` as missing.
 *
 * No form here ; one CTA that triggers the WebAuthn prompt via
 * `session.verifyMfaPasskey`. The WebAuthn ceremony can't
 * auto-trigger on mount — browsers require a user gesture
 * local to the destination page, Safari blocks the silent
 * call outright — so the explicit button click IS that gesture.
 *
 * Escalation hierarchy mirrors `TotpStep` so the two surfaces
 * read the same :
 *   1. Discreet text link « J'ai perdu ma passkey → demander
 *      une récupération par email ». Same styling as TOTP's
 *      « J'ai perdu mon TOTP » lever — passkey has no backup-
 *      code intermediate (no equivalent of TOTP's 24-char
 *      single-use codes) so the link triggers the LostFlow
 *      directly. The LostFlow panel carries its own destructive
 *      visuals after the user has explicitly opted in ; the
 *      trigger doesn't need a danger-outline button upfront.
 *   2. « ← Recommencer la connexion » always-last fallback.
 */
export default function PasskeyStep({
  submitting,
  error,
  lost,
  onSubmit,
  onStartLost,
  onCancelLost,
  onConfirmLost,
  onRestartLogin,
}: PasskeyStepProps) {
  return (
    <>
      {lost.kind === 'idle' ? (
        <>
          <AuthPanelHeader
            eyebrow="Vérification 2FA · 2/2"
            title="Confirme avec ta passkey"
            subtitle={
              <>
                Ton mode de sécurité demande une passkey en plus du code TOTP.
                Confirme avec Touch ID, Face ID, Windows Hello ou ta clé
                hardware pour finaliser la connexion.
              </>
            }
          />

          {error ? <InlineAlert className="mb-3">{error}</InlineAlert> : null}

          <Button
            variant="primary"
            size="lg"
            onClick={onSubmit}
            disabled={submitting}
            className="mt-2 w-full"
          >
            {submitting ? 'Vérification…' : 'Confirmer avec ma passkey'}
          </Button>

          {/* Escalation : direct → email recovery. Same discreet
              link styling as TOTP's « J'ai perdu mon TOTP » lever
              (border-t separator + 12 px muted text) so the two
              MFA surfaces read identically. The destructive
              visuals show up downstream in `LostFlow` once the
              user has opted in. */}
          <div className="mt-6 border-t border-hair pt-4 text-center text-[12px] text-muted">
            <button
              type="button"
              onClick={onStartLost}
              className="cursor-pointer transition-colors hover:text-ink"
            >
              J’ai perdu ma passkey → demander une récupération par email
            </button>
          </div>

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
        factor="passkey"
        onConfirm={onConfirmLost}
        onCancel={onCancelLost}
      />
    </>
  );
}
