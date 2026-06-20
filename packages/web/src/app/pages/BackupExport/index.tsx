import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { isApiError } from '@/core/api/client';
import { deriveBackupPhrase } from '@/core/crypto/backup-phrase';
import { freshenPasswordReauth } from '@/core/auth/opaque';
import { sealBackup } from '@/core/crypto/backup-crypto';
import { useNodeaStore, selectMainKey, selectModules } from '@/core/store/nodea-store';
import { usePreferences } from '@/core/auth/use-preferences';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { useDocumentTitle } from '@/lib/use-document-title';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import RecoveryCodeDisplay from '@/ui/atoms/auth/RecoveryCodeDisplay';
import AuthLayout from '@/ui/dirk/auth/AuthLayout';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';
import PasswordReauthForm from '@/ui/dirk/auth/PasswordReauthForm';
import { useConfirm } from '@/ui/dirk/confirm/confirm-context';

import { collectModules } from '@/app/flow/Account/views/data/collect-modules';
import { packBackup } from '@/app/flow/Account/views/data/backup-pack';

/**
 * Encrypted-backup tunnel (route `/backup`).
 *
 * Ceremony reached from Settings → Données : (1) a fresh account-password
 * proof (`freshenPasswordReauth`) ; (2) the 12-word BIP39 phrase that
 * seals the `.age`, **derived** from the account key
 * (`deriveBackupPhrase`, versioned via `preferences.backupPhraseVersion`)
 * so it's STABLE — every export of a given version opens with the same
 * words. First export of a version: the words are shown + confirmed by the
 * transcription quiz, and the version is recorded as confirmed
 * (`backupPhraseConfirmedVersion`). Later exports: the words are NOT
 * re-shown — just a quiz to confirm the user still has them, plus a
 * « régénérer » escape hatch. (3) on quiz success the backup is sealed and
 * downloaded.
 *
 * Rotation : « régénérer » bumps the version → a fresh phrase for FUTURE
 * exports ; existing `.age` files keep the phrase of the version they were
 * sealed under. Portability holds because the user transcribes the words
 * and types them at restore (ADR-0016 amendment).
 */
type Stage =
  | { kind: 'reauth' }
  | { kind: 'phrase'; phrase: string; version: number; confirmed: boolean }
  | { kind: 'done'; failed: string[] };

export default function BackupExportPage() {
  const { t } = useI18n();
  useDocumentTitle(t('auth.backup.documentTitle'));
  const navigate = useNavigate();
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const { preferences, setPreferences } = usePreferences();
  const confirm = useConfirm();
  const setModule = useNodeaStore((s) => s.setModule);

  const [stage, setStage] = useState<Stage>({ kind: 'reauth' });
  const [reauthSubmitting, setReauthSubmitting] = useState(false);
  const [reauthError, setReauthError] = useState<string | null>(null);
  const [error, setError] = useState('');

  function back(): void {
    setModule('account');
    navigate('/flow');
  }

  /** Derive the phrase for `version` and switch to the phrase stage. */
  async function enterPhraseStage(version: number, confirmed: boolean): Promise<void> {
    if (!mainKey) return;
    const phrase = await deriveBackupPhrase(mainKey.hmacKey, version);
    setStage({ kind: 'phrase', phrase, version, confirmed });
  }

  async function onReauth(password: string): Promise<void> {
    setReauthError(null);
    if (!mainKey) {
      setReauthError(t('account.data.backup.noKey'));
      return;
    }
    setReauthSubmitting(true);
    try {
      await freshenPasswordReauth(password);
      const version = preferences.backupPhraseVersion ?? 1;
      const confirmed = preferences.backupPhraseConfirmedVersion === version;
      await enterPhraseStage(version, confirmed);
    } catch (err) {
      if (isApiError(err) && err.status === 401) {
        setReauthError(t('account.danger.wrongPassword'));
      } else {
        setReauthError(String((err as Error)?.message ?? err));
        if (import.meta.env.DEV) console.warn('backup reauth failed', err);
      }
    } finally {
      setReauthSubmitting(false);
    }
  }

  /** Quiz passed → record the version as confirmed (first time only) then
   *  collect + seal + download. */
  async function handleDone(): Promise<void> {
    if (stage.kind !== 'phrase') return;
    if (!stage.confirmed) {
      try {
        await setPreferences({ backupPhraseConfirmedVersion: stage.version });
      } catch (err) {
        // Best-effort: failing to persist the flag only means the next
        // export re-shows the words — the seal must still proceed.
        if (import.meta.env.DEV) console.warn('backup confirm-flag write failed', err);
      }
    }
    await onSeal(stage.phrase);
  }

  /** Rotate the derived phrase for FUTURE exports (e.g. on suspected
   *  exposure). Old `.age` files keep their old phrase. */
  async function handleRegenerate(): Promise<void> {
    if (stage.kind !== 'phrase' || !mainKey) return;
    const ok = await confirm({
      title: t('account.data.backup.regenerateTitle'),
      message: t('account.data.backup.regenerateConfirm'),
      confirmLabel: t('account.data.backup.regenerateCta'),
      tone: 'danger',
    });
    if (!ok) return;
    const next = stage.version + 1;
    try {
      await setPreferences({ backupPhraseVersion: next });
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
      return;
    }
    // New version → unconfirmed → the reveal shows the new words to note.
    await enterPhraseStage(next, false);
  }

  async function onSeal(phrase: string): Promise<void> {
    setError('');
    if (!mainKey) {
      setError(t('account.data.backup.noKey'));
      return;
    }
    try {
      const { out: modulesData, failed } = await collectModules(mainKey, modules, (key, err) => {
        if (import.meta.env.DEV) console.error(`backup ${key} failed:`, err);
      });
      if (Object.keys(modulesData).length === 0) {
        setError(t('account.data.backup.empty'));
        return;
      }
      const exportedAt = new Date().toISOString();
      const sealed = await sealBackup(packBackup(modulesData, exportedAt, failed), phrase);
      // `age` types its output as a generic Uint8Array the DOM BlobPart
      // rejects ; copy into a concrete ArrayBuffer-backed view.
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(sealed)], { type: 'application/octet-stream' }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = `nodea-backup-${exportedAt.slice(0, 10)}.age`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setStage({ kind: 'done', failed });
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    }
  }

  return (
    <AuthLayout
      headline={t('auth.backup.headline')}
      maxWidth="420"
      marketing={
        <>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            {t('auth.backup.marketing1Before')}
            <code>.age</code>
            {t('auth.backup.marketing1After')}
          </p>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            {t('auth.backup.marketing2')}
          </p>
        </>
      }
    >
      {stage.kind === 'reauth' ? (
        <>
          <AuthPanelHeader
            eyebrow={t('auth.backup.eyebrow')}
            title={t('auth.backup.panelTitle')}
            subtitle={t('auth.backup.subtitle')}
          />
          <PasswordReauthForm
            size="lg"
            canConfirm={mainKey != null}
            passwordLabel={t('auth.backup.passwordLabel')}
            confirmLabel={t('auth.backup.confirmCta')}
            submittingLabel={t('auth.backup.reauthLoading')}
            submitting={reauthSubmitting}
            error={reauthError ?? undefined}
            onConfirm={onReauth}
          />
        </>
      ) : null}

      {stage.kind === 'phrase' ? (
        <>
          <RecoveryCodeDisplay
            key={`${stage.version}:${stage.confirmed ? 'c' : 'r'}`}
            eyebrow={t('auth.backup.eyebrow')}
            title={t('account.data.backup.phraseTitle')}
            {...(stage.confirmed
              ? {}
              : { subtitle: t('account.data.backup.phraseSubtitle') })}
            mnemonic={stage.phrase}
            warningTitle={t('account.data.backup.phraseWarningTitle')}
            warningBody={t('account.data.backup.phraseWarningBody')}
            downloadFilename="nodea-backup-phrase.txt"
            verifyOnly={stage.confirmed}
            verifyOnlyMessage={t('account.data.backup.reusedMessage')}
            onRegenerate={() => void handleRegenerate()}
            regenerateLabel={t('account.data.backup.regenerate')}
            doneLabel={t('account.data.backup.cta')}
            onDone={() => void handleDone()}
          />
          {error ? <InlineAlert className="mt-3">{error}</InlineAlert> : null}
        </>
      ) : null}

      {stage.kind === 'done' ? (
        stage.failed.length > 0 ? (
          // Partial run must NOT read as « ✓ réussi » (audit 2026-06).
          <InlineAlert>
            {t('account.data.backup.partial', { values: { modules: stage.failed.join(', ') } })}
          </InlineAlert>
        ) : (
          <div role="status">
            <AuthPanelHeader eyebrow={t('auth.backup.eyebrow')} title={t('account.data.backup.success')} />
          </div>
        )
      ) : null}

      <div className="mt-4.5 text-center text-[12.5px] text-muted">
        <button
          type="button"
          onClick={back}
          className="cursor-pointer transition-colors hover:text-ink"
        >
          {t('auth.backup.back')}
        </button>
      </div>
    </AuthLayout>
  );
}
