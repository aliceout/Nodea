import type { useSession } from '@/core/auth/use-session';

import BackupCodesPanel from './BackupCodesPanel';
import SecretPanel from './SecretPanel';
import type { Stage } from './types';

interface SetupFlowProps {
  session: ReturnType<typeof useSession>;
  stage: Extract<Stage, { kind: 'setup' }>;
  setStage: (s: Stage) => void;
  onCancel: () => void;
  onDone: () => void;
}

/** Two-step setup sequence : `secret` (QR + base32 + verify code)
 *  → `codes` (backup codes display + ack). Stage transition is
 *  driven by the parent ; this is just a router on `stage.sub`. */
export default function SetupFlow({
  session,
  stage,
  setStage,
  onCancel,
  onDone,
}: SetupFlowProps) {
  if (stage.sub === 'secret') {
    const data = stage.data;
    return (
      <SecretPanel
        data={data}
        session={session}
        onCancel={onCancel}
        onActivated={() => setStage({ kind: 'setup', sub: 'codes', data })}
      />
    );
  }

  if (stage.sub === 'codes') {
    return (
      <BackupCodesPanel
        eyebrow="Activation TOTP · 2/2"
        title="Codes de secours"
        alertBody={
          <>
            TOTP est activé. Ces 10 codes te dépanneront si tu perds l’accès à
            ton appli d’authentification. Single-use, ne te seront jamais
            re-affichés.
          </>
        }
        ackLabel="J’ai noté les 10 codes dans un endroit sûr."
        codes={stage.data.backupCodes}
        onDone={onDone}
      />
    );
  }

  return null;
}
