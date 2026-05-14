import { FingerPrintIcon, KeyIcon } from '@heroicons/react/24/outline';

import Button from '@/ui/atoms/dirk/Button';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';

interface FactorPickerProps {
  onPickTotp: () => void;
  onPickPasskey: () => void;
  onRestartLogin: () => void;
}

/**
 * 2nd-factor picker for `always_2fa` password-first (issue #72).
 *
 * Shown only when the primary login response listed BOTH `'totp'`
 * and `'passkey'` as acceptable alternatives — meaning the user has
 * both enrolled and either path completes the policy. After
 * picking, the parent flips `step` to the chosen sub-flow ; the
 * existing `TotpStep` / `PasskeyStep` then drive the verify call.
 *
 * Why a dedicated step rather than two buttons on the TOTP screen :
 * the choice is meaningful (« my phone is at home, use the
 * Yubikey » vs « passkey unavailable, fall back to the code ») and
 * mixing it with the TOTP form would push the form below the fold.
 * A clean picker keeps each path one tap deep.
 */
export default function FactorPicker({
  onPickTotp,
  onPickPasskey,
  onRestartLogin,
}: FactorPickerProps) {
  return (
    <>
      <AuthPanelHeader
        eyebrow="Vérification 2FA"
        title="Choisis ton 2ᵉ facteur"
        subtitle={
          <>
            Ton mode de sécurité accepte deux options. Prends celle
            qui est sous la main — les deux finalisent la connexion.
          </>
        }
      />

      <Button
        variant="primary"
        size="lg"
        onClick={onPickTotp}
        className="mt-2 w-full gap-2"
      >
        <KeyIcon className="h-4 w-4" aria-hidden="true" />
        Saisir mon code TOTP
      </Button>

      <Button
        variant="neutral"
        size="lg"
        onClick={onPickPasskey}
        className="mt-3 w-full gap-2"
      >
        <FingerPrintIcon className="h-4 w-4" aria-hidden="true" />
        Confirmer avec ma passkey
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
  );
}
