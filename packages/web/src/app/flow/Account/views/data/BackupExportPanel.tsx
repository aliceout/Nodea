import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as zxcvbnCommon from '@zxcvbn-ts/language-common';

import { useNodeaStore, selectMainKey, selectModules } from '@/core/store/nodea-store';
import { sealBackup } from '@/core/crypto/backup-crypto';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import StrengthBar from '@/ui/atoms/auth/StrengthBar';

import Feedback from '../../components/Feedback';
import { collectModules } from './collect-modules';
import { packBackup } from './backup-pack';

zxcvbnOptions.setOptions({
  dictionary: zxcvbnCommon.dictionary,
  graphs: zxcvbnCommon.adjacencyGraphs,
});

/** A passphrase is entropy, not character-classes — so we gate on the
 *  zxcvbn score (the agreed « block if < 3 ») plus a length floor, and
 *  deliberately skip the account password's upper/digit/special rules,
 *  which would wrongly reject a strong 5-word passphrase. */
const MIN_PASSPHRASE_LENGTH = 10;
const MIN_ZXCVBN_SCORE = 3;

const BackupFormSchema = z
  .object({
    passphrase: z.string().min(MIN_PASSPHRASE_LENGTH).max(400),
    confirm: z.string().min(1).max(400),
  })
  .refine((v) => v.passphrase === v.confirm, {
    path: ['confirm'],
    message: 'mismatch',
  });
type BackupForm = z.infer<typeof BackupFormSchema>;

/** « Sauvegarde chiffrée » panel on the Data tab.
 *
 * Gathers every module's decrypted entries (same client-side walk as the
 * plaintext export), packs them as one JSON per module + a manifest, and
 * seals the lot into a single opaque `age` file under a user-chosen
 * passphrase — a portable, account-independent backup re-importable into
 * any account. The passphrase never derives from (and is unrelated to)
 * the account password or the main key: that's what makes the backup
 * survive the account. Export is blocked below zxcvbn score 3 — a weak
 * passphrase would leave the backup brute-forceable offline. */
export default function BackupExportPanel() {
  const { t } = useI18n();
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [success, setSuccess] = useState('');
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

  async function onSubmit(values: BackupForm): Promise<void> {
    setError('');
    setSuccess('');
    if (!mainKey) {
      setError(t('account.data.backup.noKey'));
      return;
    }
    if (tooWeak) {
      setError(t('account.data.backup.tooWeak'));
      return;
    }
    try {
      const modulesData = await collectModules(mainKey, modules, (key, err) => {
        if (import.meta.env.DEV) console.error(`backup ${key} failed:`, err);
      });
      if (Object.keys(modulesData).length === 0) {
        setError(t('account.data.backup.empty'));
        return;
      }
      const exportedAt = new Date().toISOString();
      const sealed = await sealBackup(packBackup(modulesData, exportedAt), values.passphrase);
      // Copy into a concrete ArrayBuffer-backed view: `age` types its
      // output as the generic `Uint8Array<ArrayBufferLike>`, which the DOM
      // `BlobPart` type rejects (it could be SharedArrayBuffer-backed).
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(sealed)], { type: 'application/octet-stream' }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = `nodea-backup-${exportedAt.slice(0, 10)}.age`;
      a.click();
      URL.revokeObjectURL(url);
      setSuccess(t('account.data.backup.success'));
      // Never leave the passphrase lingering in state or the inputs after
      // the .age has downloaded — it's the key to an account-portable backup.
      reset();
      setPass('');
      setConfirm('');
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
    <section className="py-[24px] first:pt-0 last:pb-0">
      <h3 className="mb-2 text-[16px] font-semibold text-ink">
        {t('account.data.backup.title')}
      </h3>
      <p className="mb-3 max-w-[560px] text-[12px] leading-[1.55] text-muted">
        {t('account.data.backup.description')}
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-[420px]">
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

        <Button type="submit" variant="primary" size="sm" disabled={blocked}>
          {isSubmitting
            ? t('account.data.backup.ctaLoading')
            : t('account.data.backup.cta')}
        </Button>
      </form>

      {success ? <Feedback tone="success">{success}</Feedback> : null}
      {error ? <Feedback tone="error">{error}</Feedback> : null}
    </section>
  );
}
