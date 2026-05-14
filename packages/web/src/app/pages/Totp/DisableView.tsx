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
 * `security_mode` requires TOTP (`always_2fa` / `maximum`),
 * the server-side downgrade to `password_or_passkey` runs
 * automatically inside `disableTotp`, so the user doesn't
 * land on a broken « TOTP requis but TOTP off » state.
 */
export default function DisableView({ session, onCancel, onDone }: DisableViewProps) {
  return (
    <PasswordPanel
      title="Désactiver TOTP"
      body="Confirmer désactive la 2FA. Si ton mode de sécurité l’exige (always_2fa / maximum), il sera redescendu vers password_or_passkey."
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
