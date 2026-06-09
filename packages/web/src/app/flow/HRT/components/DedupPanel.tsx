/**
 * HRT · Dedup — one-shot cleanup of duplicate admin-log occurrences.
 *
 * The schedule materialiser (`use-schedule-materialization.ts`) had a
 * window — closed in the same PR as this panel — where a 429-tripped
 * partial pass could leave the schedule's `materializedThrough`
 * stale, so the next mount re-created the same dates. Some users
 * accumulated 2-3 copies of every materialised dose before the fix
 * landed. This panel detects + deletes those duplicates so the
 * historical data stays clean.
 *
 * Scope :
 *   - Only entries with a non-empty `scheduleId` are considered.
 *     Manual logs with identical (date/time/product/dose) are left
 *     alone — they might be intentional (e.g. two morning doses).
 *   - Grouping key is `(scheduleId, date, time, product, dose)` ;
 *     within each group of size >1 we keep the oldest by
 *     `payload.updatedAt` and delete the rest.
 *
 * UX :
 *   - Two-stage button : Analyser → Supprimer N doublons.
 *   - The Supprimer button reveals an inline confirmation strip
 *     before the irreversible step, since this is destructive.
 *   - DELETE has no rate-limit on the api (cf. `routes/records.ts`)
 *     so we parallelise with a small pool of 8 to finish a typical
 *     200-doublon cleanup in ~3 seconds.
 *
 * Self-contained — talks to the typed client directly rather than
 * going through `useHrtAdminLogs`, same posture as `ImportPanel` :
 * we don't want a re-list after every single delete during the pass.
 */
import { useState } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';

import type { HrtAdminLogPayload } from '@nodea/shared';
import { hrtAdminLogsClient } from '@/core/api/modules/hrt';
import { useModuleClient } from '@/core/modules/use-module-client';
import Button from '@/ui/atoms/dirk/Button';

interface AdminEntry {
  id: string;
  payload: HrtAdminLogPayload;
}

type Phase = 'idle' | 'analyzing' | 'preview' | 'confirming' | 'deleting' | 'done';

interface AnalysisResult {
  /** Total number of duplicate groups (= number of distinct doses
   *  that got materialised more than once). */
  groupCount: number;
  /** Total rows that would be deleted (= sum of group sizes - 1). */
  duplicateCount: number;
  /** IDs to delete. The kept row of each group is implicit. */
  toDelete: string[];
}

const plural = (n: number): string => (n > 1 ? 's' : '');

/** Build the dedup key from a payload. Only materialised entries
 *  participate ; everything else returns null. */
function dedupKey(payload: HrtAdminLogPayload): string | null {
  if (!payload.scheduleId) return null;
  return [
    payload.scheduleId,
    String(payload.date).slice(0, 10),
    payload.time ?? '',
    payload.product ?? '',
    String(payload.dose ?? ''),
  ].join('::');
}

/** Group entries by dedup key, return groups of size > 1 (the
 *  duplicates) plus the deletion plan. The oldest entry in each
 *  group (lowest `payload.updatedAt`) is kept ; the rest get queued
 *  for deletion. */
function analyse(entries: ReadonlyArray<AdminEntry>): AnalysisResult {
  const groups = new Map<string, AdminEntry[]>();
  for (const e of entries) {
    const key = dedupKey(e.payload);
    if (!key) continue;
    const bucket = groups.get(key) ?? [];
    bucket.push(e);
    groups.set(key, bucket);
  }
  let groupCount = 0;
  const toDelete: string[] = [];
  for (const bucket of groups.values()) {
    if (bucket.length <= 1) continue;
    groupCount += 1;
    const sorted = [...bucket].sort((a, b) =>
      (a.payload.updatedAt ?? '').localeCompare(b.payload.updatedAt ?? ''),
    );
    for (let i = 1; i < sorted.length; i += 1) {
      toDelete.push(sorted[i]!.id);
    }
  }
  return { groupCount, duplicateCount: toDelete.length, toDelete };
}

const POOL = 8;

export default function DedupPanel() {
  const ctx = useModuleClient('hrt');
  const [phase, setPhase] = useState<Phase>('idle');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function runAnalysis(): Promise<void> {
    if (!ctx) return;
    setPhase('analyzing');
    setError(null);
    try {
      const records = await hrtAdminLogsClient.list(ctx.moduleUserId, ctx.mainKey);
      const result = analyse(records);
      setAnalysis(result);
      setPhase('preview');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Analyse impossible.';
      setError(message);
      setPhase('idle');
    }
  }

  async function runDeletion(): Promise<void> {
    if (!ctx || !analysis) return;
    setPhase('deleting');
    setProgress(0);
    setFailed(0);

    const ids = analysis.toDelete;
    let done = 0;
    let failures = 0;
    let cursor = 0;
    const worker = async (): Promise<void> => {
      while (cursor < ids.length) {
        const id = ids[cursor];
        cursor += 1;
        if (!id) break;
        try {
          await hrtAdminLogsClient.remove(ctx.moduleUserId, ctx.mainKey, id);
        } catch (err) {
          failures += 1;
          if (import.meta.env.DEV) console.warn('hrt: dedup delete failed', err);
        }
        done += 1;
        setProgress(done);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(POOL, ids.length) }, () => worker()),
    );
    setFailed(failures);
    setPhase('done');
  }

  function reset(): void {
    setPhase('idle');
    setAnalysis(null);
    setProgress(0);
    setFailed(0);
    setError(null);
  }

  return (
    <section className="mx-auto mt-10 max-w-5xl border-t border-hair pt-8">
      <h2 className="text-[14px] font-medium text-ink">Nettoyer les doublons</h2>
      <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-muted">
        Détecte les prises automatiquement créées plusieurs fois par les prises
        récurrentes (un ancien bug qui pouvait produire 2 ou 3 copies de la même
        dose). Le scan ne touche que les prises générées par un schedule ; les
        prises manuelles sont ignorées même si elles paraissent identiques.
        Pour chaque doublon, on garde la plus ancienne version et on supprime
        les copies.
      </p>

      {phase === 'idle' && (
        <div className="mt-4">
          <Button
            variant="neutral"
            size="sm"
            onClick={() => void runAnalysis()}
            disabled={!ctx}
          >
            Analyser
          </Button>
          {error ? (
            <p className="mt-3 text-[12.5px] text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      )}

      {phase === 'analyzing' && (
        <p className="mt-4 text-[12.5px] text-muted">Analyse en cours…</p>
      )}

      {phase === 'preview' && analysis && (
        <div className="mt-4">
          {analysis.duplicateCount === 0 ? (
            <p className="text-[13px] text-ink" role="status">
              Aucun doublon détecté. ✨
            </p>
          ) : (
            <>
              <p className="text-[13px] text-ink">
                <span className="font-semibold">{analysis.duplicateCount}</span>{' '}
                doublon{plural(analysis.duplicateCount)} détecté
                {plural(analysis.duplicateCount)} sur{' '}
                <span className="font-semibold">{analysis.groupCount}</span>{' '}
                prise{plural(analysis.groupCount)} matérialisée
                {plural(analysis.groupCount)}.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setPhase('confirming')}
                >
                  <TrashIcon className="h-4 w-4" aria-hidden="true" />
                  Supprimer {analysis.duplicateCount} doublon
                  {plural(analysis.duplicateCount)}
                </Button>
                <Button variant="neutral" size="sm" onClick={reset}>
                  Annuler
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {phase === 'confirming' && analysis && (
        <div
          className="mt-4 rounded-lg border border-danger/40 bg-danger/5 p-4"
          role="alertdialog"
          aria-labelledby="dedup-confirm-title"
        >
          <p id="dedup-confirm-title" className="text-[13px] font-medium text-ink">
            Action irréversible.
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
            {analysis.duplicateCount} prise{plural(analysis.duplicateCount)} vont
            être supprimée{plural(analysis.duplicateCount)} définitivement. La
            prise la plus ancienne de chaque groupe est conservée.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={() => void runDeletion()}
            >
              Confirmer la suppression
            </Button>
            <Button
              variant="neutral"
              size="sm"
              onClick={() => setPhase('preview')}
            >
              Annuler
            </Button>
          </div>
        </div>
      )}

      {phase === 'deleting' && analysis && (
        <div className="mt-4">
          <p className="text-[12.5px] text-muted" role="status">
            Suppression en cours… {progress} / {analysis.duplicateCount}
          </p>
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-bg-2"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={analysis.duplicateCount}
            aria-valuenow={progress}
          >
            <div
              className="h-full bg-accent transition-[width]"
              style={{
                width: `${analysis.duplicateCount === 0 ? 0 : (progress / analysis.duplicateCount) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {phase === 'done' && analysis && (
        <div className="mt-4 rounded-lg border border-hair p-4" role="status">
          <p className="text-[13px] text-ink">
            <span className="font-semibold">
              {analysis.duplicateCount - failed}
            </span>{' '}
            doublon{plural(analysis.duplicateCount - failed)} supprimé
            {plural(analysis.duplicateCount - failed)}.
            {failed > 0 && (
              <span className="text-danger">
                {' '}
                {failed} échec{plural(failed)} — réessaye dans un instant.
              </span>
            )}
          </p>
          <p className="mt-2 text-[12.5px] text-muted">
            Recharge la page pour voir les listes mises à jour.
          </p>
          <div className="mt-3">
            <Button variant="neutral" size="sm" onClick={reset}>
              Refaire un scan
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
