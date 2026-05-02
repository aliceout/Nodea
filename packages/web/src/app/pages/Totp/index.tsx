import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useSession } from '@/core/auth/use-session';
import { useDocumentTitle } from '@/lib/use-document-title';
import { useNodeaStore, selectUser } from '@/core/store/nodea-store';
import AuthLayout from '@/ui/dirk/AuthLayout';

import DisableView from './DisableView';
import ListView from './ListView';
import RegenFlow from './RegenFlow';
import SetupFlow from './SetupFlow';
import type { Stage } from './types';

/**
 * Settings → TOTP (Auth-Roadmap Phase 5B, Auth-Spec §8).
 *
 * One page, four stages depending on the user's current TOTP
 * state and what they're trying to do :
 *
 *   - **list (TOTP enabled)** — backup-codes-remaining count +
 *     two actions, « Régénérer les codes de secours » and
 *     « Désactiver ».
 *   - **list (TOTP disabled)** — single CTA « Activer ».
 *   - **setup** — collect the password proof, drive the
 *     enrollment-start round-trip, render the QR + base32
 *     secret + 10 backup codes for one-shot display, ask for
 *     the verify code + the « j'ai noté mes codes » ack
 *     before flipping `enabled_at`.
 *   - **disable / regen** — small confirm screens that collect
 *     the password and ship the proof.
 *
 * Failures are surfaced inline rather than in a global toast
 * so the page stays self-contained (mirror of `/passkeys` and
 * `/recovery-code`).
 */
export default function TotpPage() {
  useDocumentTitle('Authentification à deux facteurs');
  const navigate = useNavigate();
  const session = useSession();
  const user = useNodeaStore(selectUser);
  const [stage, setStage] = useState<Stage>({ kind: 'list' });

  const totpEnabled = user?.totpEnabled === true;
  const backupCodesRemaining = user?.totpBackupCodesRemaining ?? 0;

  return (
    <AuthLayout
      headline="Un code à six chiffres en plus."
      maxWidth="420"
      marketing={
        <>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            Le TOTP (mot de passe à usage unique basé sur le temps) ajoute une
            deuxième couche : à chaque connexion, ton appli d’authentification
            (Bitwarden, Ente Auth, Aegis, Google Auth…) génère un code de 6
            chiffres valide 30 secondes.
          </p>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            Une fuite de ton mot de passe ne suffit alors plus à entrer — il
            faut aussi avoir ton téléphone ou ta clé hardware sous la main.
          </p>
        </>
      }
    >
      {stage.kind === 'list' ? (
        <ListView
          totpEnabled={totpEnabled}
          backupCodesRemaining={backupCodesRemaining}
          onActivate={async (password) => {
            const data = await session.startTotpEnrollment(password);
            setStage({ kind: 'setup', sub: 'secret', data });
          }}
          onRegen={() => setStage({ kind: 'regen', sub: 'password' })}
          onDisable={() => setStage({ kind: 'disable' })}
        />
      ) : null}

      {stage.kind === 'setup' ? (
        <SetupFlow
          session={session}
          stage={stage}
          setStage={setStage}
          onCancel={() => setStage({ kind: 'list' })}
          onDone={() => setStage({ kind: 'list' })}
        />
      ) : null}

      {stage.kind === 'regen' ? (
        <RegenFlow
          session={session}
          stage={stage}
          setStage={setStage}
          onCancel={() => setStage({ kind: 'list' })}
          onDone={() => setStage({ kind: 'list' })}
        />
      ) : null}

      {stage.kind === 'disable' ? (
        <DisableView
          session={session}
          onCancel={() => setStage({ kind: 'list' })}
          onDone={() => navigate('/flow', { replace: true })}
        />
      ) : null}
    </AuthLayout>
  );
}
