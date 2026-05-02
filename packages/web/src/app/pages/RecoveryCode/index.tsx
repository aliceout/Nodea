import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiErrorMessage } from '@/core/api/client';
import { useSession } from '@/core/auth/use-session';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { useDocumentTitle } from '@/lib/use-document-title';
import { useNodeaStore, selectUser } from '@/core/store/nodea-store';
import RecoveryCodeDisplay from '@/ui/atoms/auth/RecoveryCodeDisplay';
import AuthLayout from '@/ui/dirk/AuthLayout';

import FormPanel from './FormPanel';

/**
 * Settings → Recovery code KEK (Auth-Roadmap Phase 3,
 * Auth-Spec §7.7).
 *
 * One page, two modes :
 *   - **Setup** (`recoveryCodeSet === false`) : the user types
 *     their current password, we generate a fresh BIP39
 *     mnemonic, wrap their KEK under it, persist server-side.
 *     Mnemonic shown once.
 *   - **Regenerate** (`recoveryCodeSet === true`) : same flow,
 *     the server replaces the previous wrap blobs + hash.
 *
 * Both paths require the OPAQUE password proof — see
 * `useSession.setupRecoveryCode` for the orchestration.
 *
 * The mnemonic is shown ONCE in a 4×3 grid with copy / download
 * buttons via the shared `RecoveryCodeDisplay` (also used by
 * `Recover.tsx`'s post-recovery rotation) ; the user must check
 * « j'ai noté ce code » before the « Terminé » button enables.
 * After confirmation we navigate to `/flow` — the sidebar
 * warning disappears as soon as `/me` surfaces
 * `recoveryCodeSet: true`.
 */
type Stage =
  | { kind: 'form' }
  | { kind: 'displaying'; mnemonic: string; regenerated: boolean }
  | { kind: 'done' };

export default function RecoveryCodePage() {
  useDocumentTitle('Code de récupération');
  const { t } = useI18n();
  const navigate = useNavigate();
  const session = useSession();
  const user = useNodeaStore(selectUser);
  const [stage, setStage] = useState<Stage>({ kind: 'form' });
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const isRegenerate = user?.recoveryCodeSet === true;

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!password) {
      setError('Mot de passe requis.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await session.setupRecoveryCode(password);
      setStage({
        kind: 'displaying',
        mnemonic: result.mnemonic,
        regenerated: result.regenerated,
      });
      setPassword('');
    } catch (err) {
      setError(apiErrorMessage(err, t));
      if (import.meta.env.DEV) console.warn('recovery-code setup failed', err);
    } finally {
      setSubmitting(false);
    }
  }

  function handleDone(): void {
    setStage({ kind: 'done' });
    navigate('/flow', { replace: true });
  }

  return (
    <AuthLayout
      headline="Un filet de sécurité, sans backdoor."
      maxWidth="420"
      marketing={
        <>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            Le code de récupération est un mot de passe de secours, sous forme de 12
            mots simples à recopier. Il dérive une clé qui chiffre la même clé
            maître que ton mot de passe.
          </p>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            Si tu oublies ton mot de passe, ces 12 mots te permettent de récupérer
            ton compte sans perdre tes données. Sans eux, le seul recours est de
            tout effacer.
          </p>
        </>
      }
    >
      {stage.kind === 'form' ? (
        <FormPanel
          isRegenerate={isRegenerate}
          password={password}
          setPassword={setPassword}
          error={error}
          submitting={submitting}
          onSubmit={onSubmit}
        />
      ) : null}

      {stage.kind === 'displaying' ? (
        <RecoveryCodeDisplay
          eyebrow="Sécurité"
          title={stage.regenerated ? 'Nouveau code généré' : 'Ton code de récupération'}
          mnemonic={stage.mnemonic}
          acknowledged={acknowledged}
          setAcknowledged={setAcknowledged}
          doneLabel="Terminé"
          onDone={handleDone}
        />
      ) : null}
    </AuthLayout>
  );
}
