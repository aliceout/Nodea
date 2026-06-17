import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as zxcvbnCommon from '@zxcvbn-ts/language-common';

import { isApiError } from '@/core/api/client';
import { freshenPasswordReauth } from '@/core/auth/opaque';
import { sealBackup } from '@/core/crypto/backup-crypto';
import { useNodeaStore, selectMainKey, selectModules } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { useDocumentTitle } from '@/lib/use-document-title';
import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import StrengthBar from '@/ui/atoms/auth/StrengthBar';
import AuthLayout from '@/ui/dirk/auth/AuthLayout';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';
import PasswordReauthForm from '@/ui/dirk/auth/PasswordReauthForm';

import { collectModules } from '@/app/flow/Account/views/data/collect-modules';
import { packBackup } from '@/app/flow/Account/views/data/backup-pack';

zxcvbnOptions.setOptions({
  dictionary: zxcvbnCommon.dictionary,
  graphs: zxcvbnCommon.adjacencyGraphs,
});

/** A passphrase is entropy, not character-classes — gate on the zxcvbn
 *  score (« block if < 3 ») plus a length floor; the account password's
 *  upper/digit/special rules would wrongly reject a strong 5-word
 *  passphrase. */
const MIN_PASSPHRASE_LENGTH = 10;
const MIN_ZXCVBN_SCORE = 3;

const BackupFormSchema = z
  .object({
    passphrase: z.string().min(MIN_PASSPHRASE_LENGTH).max(400),
    confirm: z.string().min(1).max(400),
  })
  .refine((v) => v.passphrase === v.confirm, { path: ['confirm'], message: 'mismatch' });
type BackupForm = z.infer<typeof BackupFormSchema>;

/**
 * Encrypted-backup tunnel (route `/backup`).
 *
 * Two-step ceremony reached from Settings → Données → « Sauvegarde
 * chiffrée » : (1) a fresh account-password proof (`freshenPasswordReauth`,
 * re-auth matrix) — same gate as every other sensitive action — then
 * (2) the export *encryption* passphrase that seals the portable `.age`
 * file. The passphrase is unrelated to the account password / main key:
 * that's what makes the backup survive the account ; the account proof
 * just confirms it's really you before producing it.
 */
type Stage = { kind: 'reauth' } | { kind: 'passphrase' } | { kind: 'done'; failed: string[] };

export default function BackupExportPage() {
  useDocumentTitle('Sauvegarde chiffrée');
  const { t } = useI18n();
  const navigate = useNavigate();
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const setModule = useNodeaStore((s) => s.setModule);

  const [stage, setStage] = useState<Stage>({ kind: 'reauth' });
  const [reauthSubmitting, setReauthSubmitting] = useState(false);
  const [reauthError, setReauthError] = useState<string | null>(null);

  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const strength = useMemo(() => {
    if (!pass) return null;
    const { score, feedback } = zxcvbn(pass);
    return { score, warning: feedback.warning ?? null };
  }, [pass]);
  const confirmMismatch = confirm.length > 0 && confirm !== pass;
  const tooWeak = (strength?.score ?? 0) < MIN_ZXCVBN_SCORE;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BackupForm>({
    resolver: zodResolver(BackupFormSchema),
    defaultValues: { passphrase: '', confirm: '' },
  });

  function back(): void {
    setModule('account');
    navigate('/flow');
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
      setStage({ kind: 'passphrase' });
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

  async function onSeal(values: BackupForm): Promise<void> {
    setError('');
    if (!mainKey) {
      setError(t('account.data.backup.noKey'));
      return;
    }
    if (tooWeak) {
      setError(t('account.data.backup.tooWeak'));
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
      const sealed = await sealBackup(packBackup(modulesData, exportedAt, failed), values.passphrase);
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
      // Never leave the passphrase lingering — it's the key to an
      // account-portable backup.
      reset();
      setPass('');
      setConfirm('');
      setStage({ kind: 'done', failed });
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    }
  }

  const passReg = register('passphrase', { onChange: (e) => setPass(e.target.value) });
  const confirmReg = register('confirm', { onChange: (e) => setConfirm(e.target.value) });
  const blocked =
    isSubmitting ||
    !mainKey ||
    tooWeak ||
    confirmMismatch ||
    pass !== confirm ||
    pass.length < MIN_PASSPHRASE_LENGTH;

  return (
    <AuthLayout
      headline="Une sauvegarde qui survit au compte."
      maxWidth="420"
      marketing={
        <>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            La sauvegarde chiffrée est un fichier <code>.age</code> portable, protégé
            par une phrase secrète que tu choisis — indépendant de ton compte,
            réimportable ailleurs.
          </p>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            D’abord ton mot de passe (c’est bien toi), puis la phrase secrète qui
            chiffre la sauvegarde. Cette phrase n’a rien à voir avec ton mot de
            passe : c’est ce qui rend le fichier indépendant.
          </p>
        </>
      }
    >
      {stage.kind === 'reauth' ? (
        <>
          <AuthPanelHeader
            eyebrow="Données"
            title="Sauvegarde chiffrée"
            subtitle="Tape ton mot de passe pour continuer."
          />
          <PasswordReauthForm
            size="lg"
            canConfirm={mainKey != null}
            passwordLabel="Mot de passe actuel"
            confirmLabel="Continuer"
            submittingLabel="…"
            submitting={reauthSubmitting}
            error={reauthError ?? undefined}
            onConfirm={onReauth}
          />
        </>
      ) : null}

      {stage.kind === 'passphrase' ? (
        <>
          <AuthPanelHeader
            eyebrow="Données"
            title={t('account.data.backup.title')}
            subtitle={t('account.data.backup.description')}
          />
          <form onSubmit={handleSubmit(onSeal)} noValidate>
            <Field
              label={t('account.data.backup.passphrase')}
              type="password"
              autoComplete="new-password"
              required
              error={errors.passphrase?.message === 'mismatch' ? undefined : errors.passphrase?.message}
              {...passReg}
            />
            {strength ? (
              <StrengthBar
                score={strength.score}
                warning={strength.warning}
                rulesOk={pass.length >= MIN_PASSPHRASE_LENGTH}
              />
            ) : null}
            <Field
              label={t('account.data.backup.confirm')}
              type="password"
              autoComplete="new-password"
              required
              error={confirmMismatch ? t('account.data.backup.mismatch') : undefined}
              {...confirmReg}
            />
            <p className="mb-3 text-[12px] leading-[1.5] text-low-deep">
              {t('account.data.backup.warning')}
            </p>
            <Button type="submit" variant="primary" size="lg" disabled={blocked} className="w-full">
              {isSubmitting ? t('account.data.backup.ctaLoading') : t('account.data.backup.cta')}
            </Button>
          </form>
          {error ? (
            <div
              role="alert"
              className="mt-3 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[12.5px] text-danger"
            >
              {error}
            </div>
          ) : null}
        </>
      ) : null}

      {stage.kind === 'done' ? (
        stage.failed.length > 0 ? (
          // Partial run must NOT read as « ✓ réussi » (audit 2026-06).
          <div
            role="alert"
            className="border-l-2 border-danger bg-danger/5 px-3 py-2 text-[13px] leading-[1.5] text-danger"
          >
            {t('account.data.backup.partial', { values: { modules: stage.failed.join(', ') } })}
          </div>
        ) : (
          <div role="status">
            <AuthPanelHeader eyebrow="Données" title={t('account.data.backup.success')} />
          </div>
        )
      ) : null}

      <div className="mt-4.5 text-center text-[12.5px] text-muted">
        <button
          type="button"
          onClick={back}
          className="cursor-pointer transition-colors hover:text-ink"
        >
          ← Retour
        </button>
      </div>
    </AuthLayout>
  );
}
