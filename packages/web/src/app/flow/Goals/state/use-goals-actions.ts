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
import { createMutationTracker } from '@/core/state/mutation-tracker';
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

  // FRONT-13 — per-entry mutation tracker. Two rapid clicks on the
  // same goal's status pill (or a delete chasing a cycle) used to
  // race because the rollback in the older catch block ran with a
  // stale snapshot of the entries list. Now each mutation gets a
  // token ; rollback only fires if the token is still the latest
  // for that entry id, AND the rollback only touches that entry
  // (not the whole list snapshot).
  const trackerRef = useRef(createMutationTracker<string>());

  const cycleStatus = useCallback(
    async (entry: GoalEntry) => {
      if (!ctx) return;
      const next = nextStatus(entry.status);
      // Capture or clear `completedAt` whenever the status crosses
      // the `done` boundary. Going *into* done seeds a fresh
      // timestamp ; cycling out of done back to open clears it.
      // Re-entering done (after a clear) seeds a new timestamp —
      // we don't preserve the previous one because the old « date
      // de complétion » is no longer accurate.
      const nextCompletedAt =
        next === 'done'
          ? (entry.completedAt ?? new Date().toISOString())
          : null;
      const token = trackerRef.current.begin(entry.id);
      const previousStatus = entry.status;
      const previousCompletedAt = entry.completedAt;
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
          completedAt: nextCompletedAt,
          updatedAt: new Date().toISOString(),
        });
        bumpGoalsVersion();
      } catch (err) {
        if (!trackerRef.current.isLatest(entry.id, token)) return;
        // Targeted rollback : revert THIS entry's status +
        // completedAt back to what they were before this attempt.
        // Other entries (and any newer mutation on the same entry)
        // are untouched.
        setEntries((prev) =>
          prev.map((e) =>
            e.id === entry.id
              ? { ...e, status: previousStatus, completedAt: previousCompletedAt }
              : e,
          ),
        );
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
          completedAt: entry.completedAt,
          updatedAt: entry.updatedAt,
        },
      });
    },
    [openComposer],
  );

  const deleteEntry = useCallback(
    async (entry: GoalEntry) => {
      if (!ctx) return;
      if (!window.confirm(`Supprimer « ${entry.title} » ?`)) return;
      const token = trackerRef.current.begin(entry.id);
      const indexBefore = entriesRef.current.findIndex((e) => e.id === entry.id);
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      try {
        await goalsClient.remove(ctx.moduleUserId, ctx.mainKey, entry.id);
        trackerRef.current.forget(entry.id);
        bumpGoalsVersion();
      } catch (err) {
        if (!trackerRef.current.isLatest(entry.id, token)) return;
        // Re-insert this entry at its original position. If a
        // concurrent mutation already re-added it (rare), no-op.
        setEntries((prev) => {
          if (prev.some((e) => e.id === entry.id)) return prev;
          const nextList = [...prev];
          const at = indexBefore < 0 || indexBefore > nextList.length
            ? nextList.length
            : indexBefore;
          nextList.splice(at, 0, entry);
          return nextList;
        });
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
      const previousDates = new Map<string, string>();
      const tokens = new Map<string, string>();
      for (const e of affected) {
        const newDate = e.date
          ? e.date.replace(/^\d{4}/, String(to))
          : String(to);
        renumbered.set(e.id, newDate);
        previousDates.set(e.id, e.date);
        tokens.set(e.id, trackerRef.current.begin(e.id));
      }
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
            completedAt: e.completedAt,
            updatedAt: now,
          });
        }
        bumpGoalsVersion();
      } catch (err) {
        // Targeted rollback per entry : restore each entry's date
        // only if our carry-over token is still the latest mutation
        // for that entry. Entries whose date was further mutated by
        // a concurrent action are left as-is.
        setEntries((prev) =>
          prev.map((e) => {
            const token = tokens.get(e.id);
            if (token === undefined) return e;
            if (!trackerRef.current.isLatest(e.id, token)) return e;
            const original = previousDates.get(e.id);
            return original !== undefined ? { ...e, date: original } : e;
          }),
        );
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
