import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiErrorMessage } from '@/core/api/client';
import { useSession } from '@/core/auth/use-session';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { useDocumentTitle } from '@/lib/use-document-title';
import { useNodeaStore, selectUser } from '@/core/store/nodea-store';
import RecoveryCodeDisplay from '@/ui/atoms/auth/RecoveryCodeDisplay';
import AuthLayout from '@/ui/dirk/auth/AuthLayout';

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
 * buttons via the shared `RecoveryCodeDisplay` ; the user must then
 * re-type 3 randomly-chosen words (quiz, words hidden) before the
 * « Terminé » button fires — a real transcription check, not a
 * checkbox. After confirmation we navigate to `/flow` — the sidebar
 * warning disappears as soon as `/me` surfaces
 * `recoveryCodeSet: true`.
 */
type Stage =
  | { kind: 'form' }
  | { kind: 'displaying'; mnemonic: string; regenerated: boolean }
  | { kind: 'done' };

export default function RecoveryCodePage() {
  const { t } = useI18n();
  useDocumentTitle(t('auth.recoveryCode.docTitle'));
  const navigate = useNavigate();
  const session = useSession();
  const user = useNodeaStore(selectUser);
  const [stage, setStage] = useState<Stage>({ kind: 'form' });
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRegenerate = user?.recoveryCodeSet === true;

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!password) {
      setError(t('auth.recoveryCode.passwordRequired'));
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
      headline={t('auth.recoveryCode.headline')}
      maxWidth="420"
      marketing={
        <>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            {t('auth.recoveryCode.marketing.p1')}
          </p>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            {t('auth.recoveryCode.marketing.p2')}
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
          eyebrow={t('auth.recoveryCode.eyebrow')}
          title={
            stage.regenerated
              ? t('auth.recoveryCode.display.titleRegenerated')
              : t('auth.recoveryCode.display.title')
          }
          mnemonic={stage.mnemonic}
          doneLabel={t('auth.recoveryCode.display.doneLabel')}
          onDone={handleDone}
        />
      ) : null}
    </AuthLayout>
  );
}
