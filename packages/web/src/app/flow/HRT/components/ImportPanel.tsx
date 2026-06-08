/**
 * HRT · Import — the « Importer des analyses » panel in the Export sub-view.
 *
 * Scope : analyses only (doses are entered via the recurring/auto schedule
 * mode). The flow : download the personalised `.xlsx` template -> the user
 * pastes their analyses -> upload -> a dry-run review (per-marker mapping +
 * ignored rows) -> bulk create. Everything is client-side : the workbook is
 * generated / parsed in the browser via the lazy-loaded `lib/xlsx`, never
 * sent to the server.
 *
 * Why the typed client directly (not `useHrtLabResults`) : that hook
 * re-lists after every single create, which is wasteful for a bulk import.
 * We list once for the dedupe, create through `hrtLabResultsClient` in a
 * small concurrency pool, and the other views re-fetch on their next mount.
 */
import { useMemo, useState, type ChangeEvent } from 'react';

import { ArrowDownTrayIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';

import type { HrtLabResultPayload } from '@nodea/shared';
import { hrtLabResultsClient } from '@/core/api/modules/hrt';
import { useModuleClient } from '@/core/modules/use-module-client';
import Button from '@/ui/atoms/dirk/Button';

import {
  buildLabResultPayloads,
  dedupeLabResults,
  distinctMarkerNames,
  parseAnalyseRows,
  suggestMarkerMatch,
  type AnalyseCandidate,
  type RowError,
} from '../lib/import-model';
import { downloadImportTemplate, readImportWorkbook } from '../lib/xlsx';
import ImportReview from './ImportReview';

type Phase = 'idle' | 'review' | 'importing' | 'done';

interface ImportResult {
  imported: number;
  duplicates: number;
  skipped: number;
  failed: number;
}

/** How many records to create concurrently (each is a POST + a PATCH). */
const POOL = 4;
const plural = (n: number): string => (n > 1 ? 's' : '');

export default function ImportPanel() {
  const ctx = useModuleClient('hrt');
  const [preparing, setPreparing] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [candidates, setCandidates] = useState<AnalyseCandidate[]>([]);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [mapping, setMapping] = useState<Map<string, string>>(new Map());
  const [parseError, setParseError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  const markers = useMemo(() => distinctMarkerNames(candidates), [candidates]);

  async function getTemplate(): Promise<void> {
    setPreparing(true);
    try {
      await downloadImportTemplate();
    } catch (err) {
      if (import.meta.env.DEV) console.error('hrt: template download failed', err);
    } finally {
      setPreparing(false);
    }
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = ''; // let the same file be re-selected later
    if (!file) return;
    setParseError(null);
    setResult(null);
    try {
      const workbook = await readImportWorkbook(file);
      const parsed = parseAnalyseRows(workbook.analyses);
      if (parsed.candidates.length === 0 && parsed.errors.length === 0) {
        setParseError('Aucune analyse trouvée dans l’onglet « Analyses » du fichier.');
        setPhase('idle');
        return;
      }
      const next = new Map<string, string>();
      for (const name of distinctMarkerNames(parsed.candidates)) {
        next.set(name, suggestMarkerMatch(name)?.key ?? name);
      }
      setCandidates(parsed.candidates);
      setErrors(parsed.errors);
      setMapping(next);
      setProgress(0);
      setPhase('review');
    } catch (err) {
      if (import.meta.env.DEV) console.error('hrt: import parse failed', err);
      setParseError('Fichier illisible. Utilisez le modèle .xlsx fourni.');
      setPhase('idle');
    }
  }

  function setMarker(marker: string, value: string): void {
    setMapping((prev) => new Map(prev).set(marker, value));
  }

  async function runImport(): Promise<void> {
    if (!ctx) return;
    setPhase('importing');
    setProgress(0);
    const { payloads, skipped } = buildLabResultPayloads(candidates, mapping);

    // One list for the dedupe — re-importing the same file is then a no-op.
    let existing: HrtLabResultPayload[] = [];
    try {
      const records = await hrtLabResultsClient.list(ctx.moduleUserId, ctx.mainKey);
      existing = records.map((r) => r.payload);
    } catch (err) {
      if (import.meta.env.DEV) console.warn('hrt: dedupe list failed — importing all', err);
    }
    const { fresh, duplicates } = dedupeLabResults(payloads, existing);

    let failed = 0;
    let done = 0;
    let index = 0;
    const worker = async (): Promise<void> => {
      while (index < fresh.length) {
        const payload = fresh[index];
        index += 1;
        if (!payload) break;
        try {
          await hrtLabResultsClient.create(ctx.moduleUserId, ctx.mainKey, {
            ...payload,
            updatedAt: new Date().toISOString(),
          });
        } catch (err) {
          failed += 1;
          if (import.meta.env.DEV) console.warn('hrt: import create failed', err);
        }
        done += 1;
        setProgress(done);
      }
    };
    await Promise.all(Array.from({ length: Math.min(POOL, fresh.length) }, worker));

    setResult({
      imported: fresh.length - failed,
      duplicates: duplicates.length,
      skipped: skipped.length,
      failed,
    });
    setPhase('done');
  }

  function reset(): void {
    setPhase('idle');
    setCandidates([]);
    setErrors([]);
    setMapping(new Map());
    setParseError(null);
    setProgress(0);
    setResult(null);
  }

  return (
    <section className="mx-auto mt-10 max-w-5xl border-t border-hair pt-8">
      <h2 className="text-[14px] font-medium text-ink">Importer des analyses</h2>
      <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-muted">
        Téléchargez le modèle Excel, collez-y vos analyses dans l’onglet « Analyses », puis
        réimportez le fichier. Tout est traité dans votre navigateur — rien n’est envoyé au
        serveur. Les prises ne sont pas concernées : elles s’ajoutent via les prises récurrentes.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="neutral" size="sm" onClick={() => void getTemplate()} disabled={preparing}>
          <ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />
          {preparing ? 'Préparation…' : 'Télécharger le modèle'}
        </Button>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-hair px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:bg-bg-2 focus-within:outline focus-within:outline-2 focus-within:outline-accent">
          <ArrowUpTrayIcon className="h-4 w-4" aria-hidden="true" />
          Choisir un fichier .xlsx
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(e) => void onFile(e)}
          />
        </label>
      </div>

      {parseError && (
        <p className="mt-3 text-[12.5px] text-danger" role="alert">
          {parseError}
        </p>
      )}

      {(phase === 'review' || phase === 'importing') && (
        <ImportReview
          validCount={candidates.length}
          errors={errors}
          markers={markers}
          mapping={mapping}
          onMap={setMarker}
          onImport={() => void runImport()}
          importing={phase === 'importing'}
          progress={progress}
        />
      )}

      {phase === 'done' && result && (
        <div className="mt-5 rounded-lg border border-hair p-4" role="status">
          <p className="text-[13px] text-ink">
            <span className="font-semibold">{result.imported}</span> analyse{plural(result.imported)}{' '}
            importée{plural(result.imported)}.
            {result.duplicates > 0 && (
              <span className="text-muted">
                {' '}
                {result.duplicates} doublon{plural(result.duplicates)} ignoré{plural(result.duplicates)}.
              </span>
            )}
            {result.skipped > 0 && (
              <span className="text-muted">
                {' '}
                {result.skipped} sans unité ignorée{plural(result.skipped)}.
              </span>
            )}
            {result.failed > 0 && (
              <span className="text-danger">
                {' '}
                {result.failed} en échec.
              </span>
            )}
          </p>
          <div className="mt-3">
            <Button variant="neutral" size="sm" onClick={reset}>
              Importer un autre fichier
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
