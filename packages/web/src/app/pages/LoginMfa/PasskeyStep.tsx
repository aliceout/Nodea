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
 * `session.verifyMfaPasskey`. Same escalation hierarchy as
 * `TotpStep` — destructive recovery (passkeys wiped) followed
 * by the « ← Recommencer la connexion » fallback.
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

          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="mt-2 w-full cursor-pointer rounded-md bg-accent px-4 py-2.75 text-[14px] font-semibold text-white transition-[background-color,transform] hover:bg-accent-hover active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Vérification…' : 'Confirmer avec ma passkey'}
          </button>

          <Button
            variant="danger-outline"
            size="lg"
            onClick={onStartLost}
            className="mt-6 w-full"
          >
            Demander une récupération par email
          </Button>

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
