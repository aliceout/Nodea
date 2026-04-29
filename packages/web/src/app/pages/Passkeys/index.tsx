import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PasskeyListItem } from '@nodea/shared';

import { apiPasskeyList, isApiError } from '@/core/api/client';
import { useSession } from '@/core/auth/use-session';
import AuthLayout from '@/ui/dirk/AuthLayout';

import AddView from './AddView';
import ListView from './ListView';
import RemoveView from './RemoveView';
import RenameView from './RenameView';

/**
 * Settings → Passkeys (Auth-Roadmap Phase 4, Auth-Spec §9).
 *
 * One page, four stages :
 *
 *   - **list** — show enrolled passkeys with Rename + Remove
 *     actions. Headline reflects PRF-capable count so the user
 *     understands which credentials can unlock data on their
 *     own.
 *   - **add** — collect a label + the current password (re-auth
 *     fresh per the matrice §6), then drive the WebAuthn
 *     registration ceremony via `useSession.enrollPasskey`.
 *   - **remove** — collect the password proof, then delete.
 *     The §6.1 mode-max downgrade auto runs server-side.
 *   - **rename** — relabel + password reauth (the label rides
 *     inside the encrypted envelope so the rotation needs the
 *     export key).
 *
 * Failures are surfaced inline rather than in a global toast
 * so the page stays self-contained. Architecture : this
 * orchestrator owns the stage machine + the list refresh ; each
 * view file owns its local form state and calls
 * `onSuccess` to ask the parent to refresh and return to
 * `list`.
 */
type Stage =
  | { kind: 'list' }
  | { kind: 'add' }
  | { kind: 'remove'; passkey: PasskeyListItem }
  | { kind: 'rename'; passkey: PasskeyListItem };

export default function PasskeysPage() {
  const navigate = useNavigate();
  const session = useSession();
  const [stage, setStage] = useState<Stage>({ kind: 'list' });
  const [passkeys, setPasskeys] = useState<PasskeyListItem[] | null>(null);
  const [prfCount, setPrfCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    try {
      const res = await apiPasskeyList();
      setPasskeys(res.passkeys);
      setPrfCount(res.prfCount);
    } catch (err) {
      if (isApiError(err) && err.status === 401) {
        navigate('/login', { replace: true });
        return;
      }
      setError('Impossible de charger tes passkeys.');
      if (import.meta.env.DEV) console.warn('passkey list failed', err);
    }
  }

  useEffect(() => {
    void refresh();
    // refresh runs on mount + after each mutation ; no other deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthLayout
      headline="Une passkey à la place du mot de passe."
      maxWidth="420"
      marketing={
        <>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            Une passkey, c’est l’empreinte de ton téléphone, le PIN de ta clé
            hardware, ou ton gestionnaire de mots de passe. Confirmer une
            connexion devient un geste — plus de mot de passe à retenir.
          </p>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            Une passkey compatible PRF (Touch ID, Face ID, Bitwarden, 1Password)
            peut aussi déchiffrer tes données — sinon elle te connecte mais te
            demandera ton mot de passe pour ouvrir tes entrées.
          </p>
        </>
      }
    >
      {stage.kind === 'list' ? (
        <ListView
          passkeys={passkeys}
          prfCount={prfCount}
          error={error}
          onAdd={() => setStage({ kind: 'add' })}
          onRename={(p) => setStage({ kind: 'rename', passkey: p })}
          onRemove={(p) => setStage({ kind: 'remove', passkey: p })}
        />
      ) : null}

      {stage.kind === 'add' ? (
        <AddView
          session={session}
          onCancel={() => setStage({ kind: 'list' })}
          onSuccess={async () => {
            setStage({ kind: 'list' });
            await refresh();
          }}
        />
      ) : null}

      {stage.kind === 'remove' ? (
        <RemoveView
          passkey={stage.passkey}
          session={session}
          onCancel={() => setStage({ kind: 'list' })}
          onSuccess={async () => {
            setStage({ kind: 'list' });
            await refresh();
          }}
        />
      ) : null}

      {stage.kind === 'rename' ? (
        <RenameView
          passkey={stage.passkey}
          session={session}
          onCancel={() => setStage({ kind: 'list' })}
          onSuccess={async () => {
            setStage({ kind: 'list' });
            await refresh();
          }}
        />
      ) : null}
    </AuthLayout>
  );
}
