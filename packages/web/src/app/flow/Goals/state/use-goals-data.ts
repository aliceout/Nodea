/**
 * Goals data hook (REFACTO-08).
 *
 * Owns the encrypted goals collection, drives the initial fetch +
 * the `LoadState` machine, derives the `stats` summary from the
 * full entries array (NOT the filtered slice — see comment below).
 *
 * Not a React context — the provider in `../context.tsx` consumes
 * this hook and republishes via `GoalsDataValue`.
 */
import { useEffect, useMemo, useState } from 'react';

import { goalsClient } from '@/core/api/modules/goals';
import type { ModuleClient } from '@/core/modules/use-module-client';
import type { LoadState } from '@/core/types/load-state';

import { recordToEntry } from '../lib/mappers';
import { byDateDesc } from '../lib/sort';
import type { GoalEntry } from '../lib/types';

export interface GoalsStats {
  total: number;
  open: number;
  wip: number;
  done: number;
}

export interface GoalsDataState {
  entries: GoalEntry[];
  load: LoadState;
  stats: GoalsStats;
  setEntries: React.Dispatch<React.SetStateAction<GoalEntry[]>>;
}

export function useGoalsData(
  ctx: ModuleClient | null,
  goalsVersion: number,
): GoalsDataState {
  const [entries, setEntries] = useState<GoalEntry[]>([]);
  const [load, setLoad] = useState<LoadState>({ status: 'idle' });

  useEffect(() => {
    if (!ctx) return undefined;
    let cancelled = false;
    setLoad({ status: 'loading' });
    goalsClient
      .list(ctx.moduleUserId, ctx.mainKey)
      .then((records) => {
        if (cancelled) return;
        const next = records.map(recordToEntry).sort(byDateDesc);
        setEntries(next);
        setLoad({ status: 'ready' });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : 'Erreur lors du chargement des objectifs.';
        setLoad({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [ctx, goalsVersion]);

  // `stats` is over the **full** entries array (not the filtered
  // slice) so the « Masquer terminés (N) » count keeps showing the
  // global done count, not the count after filters.
  const stats = useMemo<GoalsStats>(
    () => ({
      total: entries.length,
      open: entries.filter((e) => e.status === 'open').length,
      wip: entries.filter((e) => e.status === 'wip').length,
      done: entries.filter((e) => e.status === 'done').length,
    }),
    [entries],
  );

  return { entries, load, stats, setEntries };
}
