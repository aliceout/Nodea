/**
 * Goals actions hook (REFACTO-08).
 *
 * Owns the action callbacks (cycleStatus, editEntry, deleteEntry,
 * carryOver) plus the carry-over dialog UI state.
 *
 * Same ref-pattern as `useLibraryActions` : the callbacks need to
 * read the freshest entries for optimistic-update rollbacks, but
 * listing `entries` in the `useCallback` dep arrays would invalidate
 * every callback on every data fetch — which would re-render every
 * consumer of the actions context. The hook keeps an `entriesRef`
 * internally, mirrors it in `useEffect`, and the callbacks read via
 * the ref. Result : action identities stay stable across data
 * fetches, which is the whole point of splitting actions from data /
 * filters.
 *
 * Not a React context — the provider in `../context.tsx` consumes
 * this hook and republishes via `GoalsActionsValue`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { goalsClient } from '@/core/api/modules/goals';
import type { ModuleClient } from '@/core/modules/use-module-client';
import type { ComposerEditing, ComposerType } from '@/core/store/nodea-store';

import { nextStatus } from '../lib/status';
import type { GoalEntry } from '../lib/types';

export interface GoalsActionsState {
  carryOverOpen: boolean;
  cycleStatus: (entry: GoalEntry) => Promise<void>;
  editEntry: (entry: GoalEntry) => void;
  deleteEntry: (entry: GoalEntry) => Promise<void>;
  openCarryOver: () => void;
  closeCarryOver: () => void;
  /** Bulk-bump every unfinished goal whose date year matches `from`
   *  up to `to`. Status preserved (only open / wip ; done goals
   *  are filtered out before reaching this handler). Date format
   *  preserved (YYYY-MM stays YYYY-MM with the year swapped, bare
   *  YYYY stays bare). */
  carryOver: (
    from: number,
    to: number,
    affected: GoalEntry[],
  ) => Promise<void>;
}

interface GoalsActionsDeps {
  ctx: ModuleClient | null;
  entries: GoalEntry[];
  setEntries: React.Dispatch<React.SetStateAction<GoalEntry[]>>;
  bumpGoalsVersion: () => void;
  openComposer: (kind?: ComposerType, editing?: ComposerEditing) => void;
}

export function useGoalsActions(deps: GoalsActionsDeps): GoalsActionsState {
  const { ctx, entries, setEntries, bumpGoalsVersion, openComposer } = deps;

  const [carryOverOpen, setCarryOverOpen] = useState(false);

  const entriesRef = useRef(entries);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  const cycleStatus = useCallback(
    async (entry: GoalEntry) => {
      if (!ctx) return;
      const next = nextStatus(entry.status);
      // Capture or clear `completed_at` whenever the status crosses
      // the `done` boundary. Going *into* done seeds a fresh
      // timestamp ; cycling out of done back to open clears it.
      // Re-entering done (after a clear) seeds a new timestamp —
      // we don't preserve the previous one because the old « date
      // de complétion » is no longer accurate.
      const nextCompletedAt =
        next === 'done'
          ? (entry.completedAt ?? new Date().toISOString())
          : null;
      const previous = entriesRef.current;
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id
            ? { ...e, status: next, completedAt: nextCompletedAt }
            : e,
        ),
      );
      try {
        await goalsClient.update(ctx.moduleUserId, ctx.mainKey, entry.id, {
          date: entry.date,
          title: entry.title,
          note: entry.note,
          status: next,
          thread: entry.thread,
          completed_at: nextCompletedAt,
          updated_at: new Date().toISOString(),
        });
        bumpGoalsVersion();
      } catch (err) {
        setEntries(previous);
        if (import.meta.env.DEV)
          console.warn('goals: toggle status failed', err);
      }
    },
    [ctx, bumpGoalsVersion, setEntries],
  );

  const editEntry = useCallback(
    (entry: GoalEntry) => {
      openComposer('goal', {
        type: 'goal',
        id: entry.id,
        payload: {
          date: entry.date,
          title: entry.title,
          note: entry.note,
          status: entry.status,
          thread: entry.thread,
          completed_at: entry.completedAt,
          updated_at: entry.updatedAt,
        },
      });
    },
    [openComposer],
  );

  const deleteEntry = useCallback(
    async (entry: GoalEntry) => {
      if (!ctx) return;
      if (!window.confirm(`Supprimer « ${entry.title} » ?`)) return;
      const previous = entriesRef.current;
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      try {
        await goalsClient.remove(ctx.moduleUserId, ctx.mainKey, entry.id);
        bumpGoalsVersion();
      } catch (err) {
        setEntries(previous);
        if (import.meta.env.DEV) console.warn('goals: delete failed', err);
      }
    },
    [ctx, bumpGoalsVersion, setEntries],
  );

  const openCarryOver = useCallback(() => setCarryOverOpen(true), []);
  const closeCarryOver = useCallback(() => setCarryOverOpen(false), []);

  const carryOver = useCallback(
    async (from: number, to: number, affected: GoalEntry[]) => {
      if (!ctx) return;
      if (affected.length === 0) {
        setCarryOverOpen(false);
        return;
      }
      const renumbered = new Map<string, string>();
      for (const e of affected) {
        const newDate = e.date
          ? e.date.replace(/^\d{4}/, String(to))
          : String(to);
        renumbered.set(e.id, newDate);
      }
      const previous = entriesRef.current;
      setEntries((prev) =>
        prev.map((e) =>
          renumbered.has(e.id) ? { ...e, date: renumbered.get(e.id)! } : e,
        ),
      );
      setCarryOverOpen(false);
      try {
        const now = new Date().toISOString();
        for (const e of affected) {
          const newDate = renumbered.get(e.id)!;
          await goalsClient.update(ctx.moduleUserId, ctx.mainKey, e.id, {
            date: newDate,
            title: e.title,
            note: e.note,
            status: e.status,
            thread: e.thread,
            completed_at: e.completedAt,
            updated_at: now,
          });
        }
        bumpGoalsVersion();
      } catch (err) {
        setEntries(previous);
        if (import.meta.env.DEV) console.warn('goals: carry-over failed', err);
      }
      // `from` is unused at runtime — used by the call site to
      // scope `affected`. Keep it in the signature so the contract
      // stays explicit.
      void from;
    },
    [ctx, bumpGoalsVersion, setEntries],
  );

  return {
    carryOverOpen,
    cycleStatus,
    editEntry,
    deleteEntry,
    openCarryOver,
    closeCarryOver,
    carryOver,
  };
}
