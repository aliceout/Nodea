/**
 * Mood data hook (REFACTO-08, same split as Goals / Library).
 *
 * Owns the encrypted mood collection: drives the initial fetch + the
 * `LoadState` machine, captures the reference `today` (local midnight,
 * once per mount — every consumer reads it so they don't each build
 * their own `new Date()` and disagree across a midnight tick), and
 * derives `availableYears`.
 *
 * Not a React context — the provider in `../context.tsx` consumes this
 * hook and republishes via `MoodDataValue`.
 */
import { useEffect, useMemo, useState } from 'react';

import { moodClient } from '@/core/api/modules/mood';
import type { ModuleClient } from '@/core/modules/use-module-client';
import type { LoadState } from '@/core/types/load-state';
import { useI18n } from '@/i18n/I18nProvider.jsx';

import { recordToEntry } from '../lib/mappers';
import type { MoodEntry } from '../lib/types';

export interface MoodDataState {
  entries: MoodEntry[];
  load: LoadState;
  /** Years with at least one entry, sorted descending. Falls back to
   *  `[currentYear]` so the YearSelector never renders blank. */
  availableYears: ReadonlyArray<number>;
  /** Reference « today » normalised to local midnight, captured once
   *  per provider mount. */
  today: Date;
  setEntries: React.Dispatch<React.SetStateAction<MoodEntry[]>>;
}

export function useMoodData(
  ctx: ModuleClient | null,
  moodVersion: number,
): MoodDataState {
  const { t, language } = useI18n();
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [load, setLoad] = useState<LoadState>({ status: 'idle' });

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

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
    moodClient
      .list(ctx.moduleUserId, ctx.mainKey)
      .then((records) => {
        if (cancelled) return;
        const next = records
          .map((r) => recordToEntry(r, today, labels))
          // Newest first — the EntryRow list reads top-down.
          .sort((a, b) => b.dateIso.localeCompare(a.dateIso));
        setEntries(next);
        setLoad({ status: 'ready' });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : t('mood.context.loadFailed');
        setLoad({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [ctx, moodVersion, today, t, language]);

  const availableYears = useMemo<ReadonlyArray<number>>(() => {
    const set = new Set<number>(
      entries.map((e) => Number(e.dateIso.slice(0, 4))),
    );
    if (set.size === 0) set.add(today.getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [entries, today]);

  return { entries, load, availableYears, today, setEntries };
}
