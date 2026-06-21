/**
 * Journal data hook (REFACTO-08, same split as Goals / Library / Mood).
 *
 * Owns the encrypted journal collection: drives the initial fetch + the
 * `LoadState` machine, and derives `stats` + `availableYears` from the
 * full entries array (NOT the filtered slice — the Stats block and the
 * year strip count the whole dataset). Not a React context — the
 * provider in `../context.tsx` republishes via `JournalDataValue`.
 */
import { useEffect, useMemo, useState } from 'react';

import { journalClient } from '@/core/api/modules/journal';
import type { ModuleClient } from '@/core/modules/use-module-client';
import type { LoadState } from '@/core/types/load-state';
import { useI18n } from '@/i18n/I18nProvider.jsx';

import { recordToEntry } from '../lib/mappers';
import { computeStats } from '../lib/stats';
import type { JournalEntry, JournalStats } from '../lib/types';

export interface JournalDataState {
  entries: JournalEntry[];
  load: LoadState;
  stats: JournalStats;
  /** Years present in the dataset, descending — drives the YearSelector
   *  tab strip (issue #56). */
  availableYears: ReadonlyArray<number>;
  setEntries: React.Dispatch<React.SetStateAction<JournalEntry[]>>;
}

export function useJournalData(
  ctx: ModuleClient | null,
  journalVersion: number,
): JournalDataState {
  const { t, language } = useI18n();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [load, setLoad] = useState<LoadState>({ status: 'idle' });

  // Initial load (and re-load on store version bump).
  useEffect(() => {
    if (!ctx) return undefined;
    let cancelled = false;
    setLoad({ status: 'loading' });
    const labels = {
      language,
      todayLabel: t('common.time.today'),
      yesterdayLabel: t('common.time.yesterday'),
    };
    journalClient
      .list(ctx.moduleUserId, ctx.mainKey)
      .then((records) => {
        if (cancelled) return;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const next = records
          .map((r) => recordToEntry(r, today, labels))
          // Newest first.
          .sort((a, b) => b.dateIso.localeCompare(a.dateIso));
        setEntries(next);
        setLoad({ status: 'ready' });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : t('journal.context.loadFailed');
        setLoad({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [ctx, journalVersion, t, language]);

  const stats = useMemo<JournalStats>(() => computeStats(entries), [entries]);

  const availableYears = useMemo<ReadonlyArray<number>>(() => {
    const set = new Set<number>();
    for (const e of entries) {
      const y = parseInt(e.dateIso.slice(0, 4), 10);
      if (Number.isFinite(y)) set.add(y);
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [entries]);

  return { entries, load, stats, availableYears, setEntries };
}
