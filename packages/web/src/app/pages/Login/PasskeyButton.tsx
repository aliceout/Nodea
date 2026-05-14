import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FingerPrintIcon } from '@heroicons/react/24/outline';

import { useSession } from '@/core/auth/use-session';
import { apiErrorMessage } from '@/core/api/client';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';

/**
 * Passkey-first login alternative below the password form
 * (REFACTO-12 split). Hidden on browsers without WebAuthn support.
 *
 * Drives `session.loginWithPasskey({})` — the OS / browser surfaces
 * a credential picker. Discoverable creds (resident keys) appear
 * even without the user typing their email. Three outcomes :
 *
 *   - **Stepped MFA** (`needsMfa`) : the session is `mfa_pending`,
 *     the user still needs TOTP (and possibly password for mode
 *     `maximum`). We navigate to `/login/mfa` to drive the next
 *     factor.
 *   - **Fully unlocked** (PRF surfaced + KEK unwrapped) : navigate
 *     to `/flow`.
 *   - **Login-only** (no PRF) : the cookie is set but the KEK is
 *     unreachable from this credential alone. We surface a notice
 *     so the user finishes the unlock by typing their password
 *     into the main form.
 *
 * `onBusyChange` lets the parent disable the password form while
 * the OS prompt is up — pressing both at the same time would race.
 */
export default function PasskeyButton({
  disabled = false,
  onBusyChange,
}: {
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { t } = useI18n();
  const session = useSession();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hide entirely on browsers that don't support WebAuthn at all
  // (older Firefox, very old browsers). On supported browsers, the
  // OS prompt does the rest.
  if (typeof window === 'undefined' || typeof window.PublicKeyCredential === 'undefined') {
    return null;
  }

  function setBusyAndNotify(next: boolean): void {
    setBusy(next);
    onBusyChange?.(next);
  }

  async function onClick(): Promise<void> {
    setError(null);
    setBusyAndNotify(true);
    try {
      const result = await session.loginWithPasskey({});
      if (result.needsMfa) {
        // Forward the OR-set hint (issue #72) via navigation state.
        navigate('/login/mfa', {
          replace: true,
          state: { factorsNeeded: result.factorsNeeded },
        });
      } else if (result.fullyUnlocked) {
        navigate('/flow', { replace: true });
      } else {
        setError(
          'Cette passkey ne déchiffre pas tes données. Saisis ton mot de passe pour finaliser.',
        );
      }
    } catch (err) {
      if (isWebAuthnCancel(err)) {
        // User dismissed the picker — silent, no error.
      } else {
        setError(apiErrorMessage(err, t));
        if (import.meta.env.DEV) console.warn('passkey login failed', err);
      }
    } finally {
      setBusyAndNotify(false);
    }
  }

  return (
    <>
      <Button
        variant="neutral"
        size="lg"
        onClick={() => void onClick()}
        disabled={busy || disabled}
        className="mt-2 w-full gap-2 font-normal"
      >
        {busy ? (
          'Vérification…'
        ) : (
          <>
            <FingerPrintIcon className="h-4 w-4" aria-hidden="true" />
            Se connecter avec une passkey
          </>
        )}
      </Button>
      {error ? <InlineAlert className="mt-3">{error}</InlineAlert> : null}
    </>
  );
}

/**
 * `navigator.credentials.get` rejects with `NotAllowedError` when
 * the user dismisses the picker or the operation times out. We
 * silence that case rather than nag — the user explicitly cancelled.
 */
function isWebAuthnCancel(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const name = (err as { name?: unknown }).name;
  return name === 'NotAllowedError' || name === 'AbortError';
}
