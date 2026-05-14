import type { useSession } from '@/core/auth/use-session';

import PasswordPanel from './PasswordPanel';

interface DisableViewProps {
  session: ReturnType<typeof useSession>;
  onCancel: () => void;
  onDone: () => void;
}

/**
 * Confirmation panel for disabling TOTP. Ships through the
 * shared `PasswordPanel` ; the danger variant + body copy
 * surface the auto-downgrade behaviour : if the user's
 * `security_mode` requires TOTP (`maximum`) or no other 2nd factor
 * remains in `always_2fa`, the server-side downgrade to
 * `password_or_passkey` runs automatically inside `disableTotp`,
 * so the user doesn't land on a broken « 2FA requis mais aucun
 * facteur » state. With a passkey enrolled in `always_2fa`, the
 * mode stays — the passkey carries the 2nd factor (issue #72).
 */
export default function DisableView({ session, onCancel, onDone }: DisableViewProps) {
  return (
    <PasswordPanel
      title="Désactiver TOTP"
      body="Confirmer désactive ton TOTP. En mode maximum, ou en 2FA requis sans passkey enrôlée, le mode redescend automatiquement à Standard ; sinon la passkey continue de couvrir le 2ᵉ facteur."
      cta="Désactiver"
      destructive
      onCancel={onCancel}
      onSubmit={async (password) => {
        await session.disableTotp(password);
        onDone();
      }}
    />
  );
}
