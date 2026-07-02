/**
 * Cycle → « Importer des données » (Clue for now).
 *
 * A mini trigger styled like `ModuleSettingsTrigger` (so it sits naturally
 * under « Paramètre du module » in the sidebar) that opens a Modal : pick the
 * Clue export (the raw password-protected `.zip`, or an already-extracted
 * `measurements.json`), decrypt + preview, then bulk-create the days that
 * aren't already logged (dedupe by date — we never clobber an existing day).
 *
 * File reading + zip decryption live in `lib/read-clue-file`, parsing in the
 * pure `lib/import-clue` ; this file is the file-pick + password + preview +
 * `createMany` wiring.
 */
import { useRef, useState } from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

import { cycleClient } from '@/core/api/modules/cycle';
import type { ModuleClient } from '@/core/modules/use-module-client';
import { intlLocale, parseLocalDate } from '@/core/i18n/date-format';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import { Modal } from '@/ui/atoms/layout/Modal';
import { parseClueExport, type ClueParseResult } from '../lib/import-clue';
import { readClueMeasurements } from '../lib/read-clue-file';

interface Props {
  ctx: ModuleClient | null;
  /** Dates already logged — imported days matching one are skipped. */
  existingDates: ReadonlySet<string>;
  /** Called after a successful import so the page reloads its records. */
  onImported: () => void;
}

type StatusError =
  | 'invalid_json'
  | 'unrecognized_clue_format'
  | 'empty'
  | 'wrong_password'
  | 'no_measurements'
  | 'read_failed';

export default function CycleImport({ ctx, existingDates, onImported }: Props) {
  const { t, language } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [parsed, setParsed] = useState<ClueParseResult | null>(null);
  const [error, setError] = useState<StatusError | null>(null);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  if (!ctx) return null;

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(intlLocale(language), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(parseLocalDate(iso));

  const fresh = parsed
    ? parsed.entries.filter((e) => !existingDates.has(e.date))
    : [];
  const skipped = parsed ? parsed.entries.length - fresh.length : 0;

  function reset(): void {
    setFileName(null);
    setPendingFile(null);
    setNeedsPassword(false);
    setPassword('');
    setParsed(null);
    setError(null);
    setBusy(false);
    setImporting(false);
    setImportError(false);
    setDone(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  function close(): void {
    setOpen(false);
    reset();
  }

  /** Read (decrypt if needed) + parse. Called on file pick and on unlock. */
  async function ingest(file: File, pw?: string): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const text = await readClueMeasurements(file, pw);
      const result = parseClueExport(text);
      if (result.entries.length === 0) {
        setError('empty');
      } else {
        setParsed(result);
        setNeedsPassword(false);
      }
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code === 'needs_password') {
        setNeedsPassword(true);
      } else if (code === 'wrong_password') {
        setError('wrong_password');
      } else if (code === 'no_measurements') {
        setError('no_measurements');
      } else if (code === 'invalid_json') {
        setError('invalid_json');
      } else if (code === 'unrecognized_clue_format') {
        setError('unrecognized_clue_format');
      } else {
        setError('read_failed');
      }
    } finally {
      setBusy(false);
    }
  }

  function onFile(file: File): void {
    reset();
    setFileName(file.name);
    setPendingFile(file);
    void ingest(file);
  }

  async function runImport(): Promise<void> {
    if (!ctx || fresh.length === 0) return;
    setImporting(true);
    setImportError(false);
    try {
      await cycleClient.createMany(ctx.moduleUserId, ctx.mainKey, fresh);
      setDone(fresh.length);
      onImported();
    } catch (err) {
      setImportError(true);
      if (import.meta.env.DEV) console.warn('cycle import failed', err);
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 self-start text-[12px] font-medium text-muted transition-colors hover:text-ink focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <ArrowDownTrayIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {t('cycle.import.trigger')}
      </button>

      <Modal open={open} onClose={close} size="md">
        <div className="flex flex-col gap-4 p-6">
          <div>
            <h2 className="text-[16px] font-semibold text-ink">{t('cycle.import.title')}</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
              {t('cycle.import.help')}
            </p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".zip,.json,.cluedata,application/zip,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />

          {done === null ? (
            <Button
              type="button"
              variant="neutral"
              size="md"
              onClick={() => inputRef.current?.click()}
              disabled={busy || importing}
              className="self-start"
            >
              {fileName ?? t('cycle.import.choose')}
            </Button>
          ) : null}

          {/* Encrypted zip → ask for the one-time Clue password. */}
          {needsPassword && !parsed && done === null ? (
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (pendingFile && password) void ingest(pendingFile, password);
              }}
            >
              <div className="flex-1">
                <Field
                  dense
                  type="password"
                  autoFocus
                  label={t('cycle.import.passwordLabel')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  {...(error === 'wrong_password'
                    ? { error: t('cycle.import.errors.wrong_password') }
                    : {})}
                />
              </div>
              <Button type="submit" variant="primary" size="md" disabled={busy || !password}>
                {busy ? t('cycle.import.importing') : t('cycle.import.unlock')}
              </Button>
            </form>
          ) : null}

          {error && !(error === 'wrong_password' && needsPassword) ? (
            <InlineAlert>{t(`cycle.import.errors.${error}`)}</InlineAlert>
          ) : null}

          {parsed && done === null ? (
            <div className="rounded-[var(--radius-control)] border border-hair bg-bg-2 p-3.5 text-[12.5px]">
              <p className="text-ink">
                {t('cycle.import.summary', {
                  values: { days: parsed.days, withFlow: parsed.withFlow },
                })}
              </p>
              {parsed.from && parsed.to ? (
                <p className="mt-0.5 text-muted">
                  {t('cycle.import.range', {
                    values: { from: fmtDate(parsed.from), to: fmtDate(parsed.to) },
                  })}
                </p>
              ) : null}
              <p className="mt-2 font-medium text-ink">
                {t('cycle.import.newDays', { values: { count: fresh.length } })}
                {skipped > 0
                  ? ` · ${t('cycle.import.skipped', { values: { count: skipped } })}`
                  : ''}
              </p>
            </div>
          ) : null}

          {importError ? <InlineAlert>{t('cycle.import.errors.failed')}</InlineAlert> : null}

          {done !== null ? (
            <p className="text-[13px] font-medium text-accent-deep">
              {t('cycle.import.done', { values: { count: done } })}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            {parsed && done === null && fresh.length > 0 ? (
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => void runImport()}
                disabled={importing}
              >
                {importing
                  ? t('cycle.import.importing')
                  : t('cycle.import.cta', { values: { count: fresh.length } })}
              </Button>
            ) : null}
            <Button type="button" variant="neutral" size="md" onClick={close}>
              {t(done !== null ? 'cycle.import.close' : 'common.actions.cancel')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
