import { useEffect, useRef, useState, type ChangeEvent } from 'react';

import { useNodeaStore, selectMainKey, selectModules } from '@/core/store/nodea-store';
import { openBackup } from '@/core/crypto/backup-crypto';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';

import { restoreEnvelope } from './restore-envelope';
import { unpackBackup } from './backup-pack';

/** age's binary format opens with this ASCII line — the cheapest reliable
 *  way to tell an encrypted backup (`.age`) from a plaintext JSON export
 *  without trusting the file extension. */
const AGE_MAGIC = 'age-encryption.org/v1';

/** « Importer » panel on the Data tab.
 *
 * Accepts three shapes, auto-detected from the bytes (not the extension):
 *   - the versioned JSON envelope produced by `ExportPanel` (one bucket
 *     per module),
 *   - a legacy NDJSON / array that pre-dates the unified format (Mood only),
 *   - an encrypted backup (`.age`, from `BackupExportPanel`) — detected by
 *     the age magic header, then decrypted in-browser with a passphrase.
 *
 * All three converge on `restoreEnvelope`, so per-record idempotency
 * (each plugin's `getNaturalKey`) makes a re-import a no-op rather than a
 * duplicator. */
export default function ImportPanel() {
  const { t } = useI18n();
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const passInputRef = useRef<HTMLInputElement | null>(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Bytes of a picked `.age` file held while we prompt for its passphrase.
  const [pendingBackup, setPendingBackup] = useState<Uint8Array | null>(null);
  const [backupPass, setBackupPass] = useState('');

  // When a backup is detected the trigger button goes disabled, so move
  // focus to the freshly revealed passphrase field — keyboard / screen
  // reader users would otherwise be stranded on a dead control.
  useEffect(() => {
    if (pendingBackup !== null) passInputRef.current?.focus();
  }, [pendingBackup]);

  function reportResult(count: number, parts: string[]): void {
    setSuccess(
      t('account.data.import.successPrefix', {
        values: { count, parts: parts.join(' ; ') },
      }),
    );
  }

  async function handleFile(evt: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = evt.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (!mainKey) throw new Error(t('account.data.import.noKey'));
      const bytes = new Uint8Array(await file.arrayBuffer());
      const header = new TextDecoder('latin1').decode(bytes.subarray(0, AGE_MAGIC.length));
      if (header === AGE_MAGIC) {
        // Encrypted backup — stash the bytes and switch to the passphrase
        // prompt; nothing is decrypted until the user supplies one.
        setPendingBackup(bytes);
        return;
      }

      const text = new TextDecoder().decode(bytes).trim();
      if (text.startsWith('{')) {
        const root = JSON.parse(text) as { modules?: Record<string, unknown[]> };
        if (!root?.modules) throw new Error(t('account.data.import.invalidJson'));
        const { count, parts } = await restoreEnvelope(root.modules, mainKey, modules, t);
        reportResult(count, parts);
      } else if (text.startsWith('[')) {
        // Legacy Mood-only array.
        const arr = JSON.parse(text) as unknown[];
        const { count, parts } = await restoreEnvelope({ mood: arr }, mainKey, modules, t);
        reportResult(count, parts);
      } else {
        throw new Error(t('account.data.import.unknownFormat'));
      }
    } catch (err) {
      setError(t('account.data.import.errorPrefix') + ((err as Error)?.message ?? ''));
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleRestoreBackup(): Promise<void> {
    if (!pendingBackup) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (!mainKey) throw new Error(t('account.data.import.noKey'));
      let files;
      try {
        files = await openBackup(pendingBackup, backupPass);
      } catch {
        // Wrong passphrase or tampered file — keep the prompt so the user
        // can retry without re-picking the file.
        setError(t('account.data.import.backupWrongPassphrase'));
        return;
      }
      const { modules: modulesObj, failedModules } = unpackBackup(files);
      const { count, parts } = await restoreEnvelope(modulesObj, mainKey, modules, t);
      reportResult(count, parts);
      if (failedModules.length > 0) {
        // The backup was partially corrupted — restore the modules we
        // could read, but warn the user that one or more module files
        // were unreadable. The success path above already counted what
        // landed ; the warning is additive, not a replacement.
        setError(
          t('account.data.import.partialBackupWarning', {
            values: { modules: failedModules.join(', ') },
            defaultValue: `Modules non importés (fichiers corrompus) : ${failedModules.join(', ')}`,
          }),
        );
      }
      setPendingBackup(null);
      setBackupPass('');
    } catch (err) {
      setError(t('account.data.import.errorPrefix') + ((err as Error)?.message ?? ''));
    } finally {
      setLoading(false);
    }
  }

  function cancelBackup(): void {
    setPendingBackup(null);
    setBackupPass('');
    setError('');
  }

  return (
    <section className="py-[24px] first:pt-0 last:pb-0">
      <h3 className="mb-2 text-[16px] font-semibold text-ink">{t('account.data.import.title')}</h3>
      <div className="grid grid-cols-1 items-start gap-y-3 lg:grid-cols-[240px_1fr] lg:gap-x-6">
        <div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={loading || !mainKey || pendingBackup !== null}
          >
            {loading ? t('account.data.import.ctaLoading') : t('account.data.import.cta')}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json,.ndjson,.age"
            onChange={handleFile}
            className="hidden"
          />
        </div>
        <p className="text-[12px] leading-[1.55] text-muted">
          {t('account.data.import.description')}
        </p>
      </div>

      {pendingBackup !== null ? (
        <div className="mt-3 max-w-[420px] rounded-[var(--radius-control)] border border-hair bg-bg-2/40 p-3">
          <p role="status" className="mb-2 text-[12px] leading-[1.5] text-ink-soft">
            {t('account.data.import.backupDetected')}
          </p>
          <Field
            ref={passInputRef}
            label={t('account.data.import.backupPassphrase')}
            type="password"
            autoComplete="off"
            value={backupPass}
            onChange={(e) => setBackupPass(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleRestoreBackup}
              disabled={loading || backupPass.length === 0}
            >
              {loading
                ? t('account.data.import.backupRestoreLoading')
                : t('account.data.import.backupRestoreCta')}
            </Button>
            <Button variant="neutral" size="sm" onClick={cancelBackup} disabled={loading}>
              {t('account.data.import.backupCancel')}
            </Button>
          </div>
        </div>
      ) : null}

      {success ? (
        <InlineAlert tone="success" className="mt-3">
          {success}
        </InlineAlert>
      ) : null}
      {error ? <InlineAlert className="mt-3">{error}</InlineAlert> : null}
    </section>
  );
}
