import type { useSession } from '@/core/auth/use-session';

import BackupCodesPanel from './BackupCodesPanel';
import PasswordPanel from './PasswordPanel';
import type { Stage } from './types';

interface RegenFlowProps {
  session: ReturnType<typeof useSession>;
  stage: Extract<Stage, { kind: 'regen' }>;
  setStage: (s: Stage) => void;
  onCancel: () => void;
  onDone: () => void;
}

/** Two-step regeneration sequence : `password` (fresh reauth) →
 *  `display` (the new 10 codes, with the old lot already
 *  invalidated server-side). Same `BackupCodesPanel` as the
 *  initial setup, with regeneration-specific copy. */
export default function RegenFlow({
  session,
  stage,
  setStage,
  onCancel,
  onDone,
}: RegenFlowProps) {
  if (stage.sub === 'password') {
    return (
      <PasswordPanel
        title="Régénérer les codes de secours"
        body="Tape ton mot de passe. L’ancien lot de codes sera invalidé immédiatement — assure-toi de pouvoir noter le nouveau."
        cta="Régénérer"
        onCancel={onCancel}
        onSubmit={async (password) => {
          const codes = await session.regenerateTotpBackupCodes(password);
          setStage({ kind: 'regen', sub: 'display', codes });
        }}
      />
    );
  }

  if (stage.sub === 'display' && stage.codes) {
    return (
      <BackupCodesPanel
        eyebrow="Sécurité"
        title="Nouveaux codes de secours"
        alertBody={
          <>
            Ces 10 codes ne te seront jamais re-affichés. L’ancien lot est
            invalidé.
          </>
        }
        ackLabel="J’ai noté les 10 nouveaux codes."
        codes={stage.codes}
        onDone={onDone}
      />
    );
  }

  return null;
}
