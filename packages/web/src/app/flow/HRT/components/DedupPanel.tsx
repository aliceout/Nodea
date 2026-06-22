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

import { hrtAdminLogsClient } from '@/core/api/modules/hrt';
import { useModuleClient } from '@/core/modules/use-module-client';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';

import { analyse, type AnalysisResult } from '../lib/dedup';

type Phase = 'idle' | 'analyzing' | 'preview' | 'confirming' | 'deleting' | 'done';

const POOL = 8;

export default function DedupPanel() {
  const { t, tn } = useI18n();
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
        err instanceof Error ? err.message : t('hrt.dedup.analyzeFailed');
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
      <h2 className="text-[14px] font-medium text-ink">{t('hrt.dedup.title')}</h2>
      <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-muted">
        {t('hrt.dedup.description')}
      </p>

      {phase === 'idle' && (
        <div className="mt-4">
          <Button
            variant="neutral"
            size="sm"
            onClick={() => void runAnalysis()}
            disabled={!ctx}
          >
            {t('hrt.dedup.analyze')}
          </Button>
          {error ? (
            <p className="mt-3 text-[12.5px] text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      )}

      {phase === 'analyzing' && (
        <p className="mt-4 text-[12.5px] text-muted">{t('hrt.dedup.analyzing')}</p>
      )}

      {phase === 'preview' && analysis && (
        <div className="mt-4">
          {analysis.duplicateCount === 0 ? (
            <p className="text-[13px] text-ink" role="status">
              {t('hrt.dedup.none')}
            </p>
          ) : (
            <>
              <p className="text-[13px] text-ink">
                <span className="font-semibold">{analysis.duplicateCount}</span>{' '}
                {tn('hrt.dedup.foundDuplicates', analysis.duplicateCount)}{' '}
                <span className="font-semibold">{analysis.groupCount}</span>{' '}
                {tn('hrt.dedup.foundGroups', analysis.groupCount)}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setPhase('confirming')}
                >
                  <TrashIcon className="h-4 w-4" aria-hidden="true" />
                  {tn('hrt.dedup.deleteButton', analysis.duplicateCount)}
                </Button>
                <Button variant="neutral" size="sm" onClick={reset}>
                  {t('common.actions.cancel')}
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
            {t('hrt.dedup.irreversible')}
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
            {tn('hrt.dedup.confirmBody', analysis.duplicateCount)}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={() => void runDeletion()}
            >
              {t('hrt.dedup.confirmDelete')}
            </Button>
            <Button
              variant="neutral"
              size="sm"
              onClick={() => setPhase('preview')}
            >
              {t('common.actions.cancel')}
            </Button>
          </div>
        </div>
      )}

      {phase === 'deleting' && analysis && (
        <div className="mt-4">
          <p className="text-[12.5px] text-muted" role="status">
            {t('hrt.dedup.deleting', {
              values: { done: progress, total: analysis.duplicateCount },
            })}
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
            {tn('hrt.dedup.deleted', analysis.duplicateCount - failed)}
            {failed > 0 && (
              <span className="text-danger"> {tn('hrt.dedup.failures', failed)}</span>
            )}
          </p>
          <p className="mt-2 text-[12.5px] text-muted">{t('hrt.dedup.reloadHint')}</p>
          <div className="mt-3">
            <Button variant="neutral" size="sm" onClick={reset}>
              {t('hrt.dedup.rescan')}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
