/**
 * Goals actions hook (REFACTO-08).
 *
 * Owns the action callbacks (cycleStatus, editEntry, deleteEntry,
 * upsertRecord) plus the bulk theme-mutation engine (rename / delete a
 * « thème » across every goal that carries it — the shared
 * `ThreadManagerModal`, same engine as Journal's « fils »).
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

import type { GoalsPayload } from '@nodea/shared';

import { goalsClient } from '@/core/api/modules/goals';
import type { DecryptedRecord } from '@/core/api/modules/collection-client';
import type { ModuleClient } from '@/core/modules/use-module-client';
import { createMutationTracker } from '@/core/state/mutation-tracker';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import {
  removeThreadFromString,
  renameThreadInString,
  type ThreadMutationResult,
} from '@/lib/threads-mutate';
import { useConfirm } from '@/ui/dirk/confirm/confirm-context';

import { recordToEntry } from '../lib/mappers';
import { byDateDesc } from '../lib/sort';
import { nextStatus } from '../lib/status';
import type { GoalEntry } from '../lib/types';

export interface GoalsActionsState {
  /** Reader-mode focus (issue #64). `null` when the regular list is
   *  shown ; otherwise the id of the goal being read full-screen.
   *  Auto-clears if the underlying entry disappears (delete / filter
   *  change leaves it out of `filtered`). */
  readingId: string | null;
  /** Inline composer state (replaces the global Zustand
   *  `composer.editing` slice the modal used). `formOpen` toggles
   *  the form visibility in `PrimaryColumn` ; `editingEntry` is the
   *  entry being edited (or `null` on a fresh create). */
  formOpen: boolean;
  editingEntry: GoalEntry | null;
  /** Open the inline form on a blank entry (the topbar
   *  « + Nouvel objectif » button). */
  openCreateForm: () => void;
  /** Open the inline form pre-filled with the given entry — the
   *  edit affordance on each row + each card. Aliased to
   *  `editEntry` below so existing call-sites compile unchanged. */
  openEditForm: (entry: GoalEntry) => void;
  /** Cancel / dismiss the form (own Cancel button + post-save
   *  callback). */
  closeForm: () => void;
  cycleStatus: (entry: GoalEntry) => Promise<void>;
  editEntry: (entry: GoalEntry) => void;
  /** Inline title quick-rename (issue #65). Same optimistic-update +
   *  per-entry mutation tracker pattern as `cycleStatus`, except
   *  only the title travels through. Caller hands in the trimmed
   *  new title ; equal-to-current is a no-op handled at the call
   *  site so this stays a single round-trip. */
  updateTitle: (entry: GoalEntry, nextTitle: string) => Promise<void>;
  deleteEntry: (entry: GoalEntry) => Promise<void>;
  /** Insert-or-replace a single record locally after a form save —
   *  the inline composer calls this with the record returned by
   *  `goalsClient.create` / `.update` instead of bumping the version
   *  and forcing a full refetch (audit 2026-06 passe 2). */
  upsertRecord: (record: DecryptedRecord<GoalsPayload>) => void;
  /** Open the focus reader on a specific goal (issue #64). */
  openReader: (id: string) => void;
  /** Close the focus reader and return to the regular list. */
  closeReader: () => void;
  /** Rename a theme (« thread ») across every goal that carries it.
   *  Renaming into an existing theme is a de facto merge. Optimistic
   *  update + per-entry rollback ; reports a success/failure tally. */
  renameThread: (from: string, to: string) => Promise<ThreadMutationResult>;
  /** Delete a theme from every goal that carries it. */
  deleteThread: (target: string) => Promise<ThreadMutationResult>;
}

interface GoalsActionsDeps {
  ctx: ModuleClient | null;
  entries: GoalEntry[];
  setEntries: React.Dispatch<React.SetStateAction<GoalEntry[]>>;
  bumpGoalsVersion: () => void;
}

export function useGoalsActions(deps: GoalsActionsDeps): GoalsActionsState {
  const { ctx, entries, setEntries, bumpGoalsVersion } = deps;
  const { t } = useI18n();
  const confirm = useConfirm();

  const [readingId, setReadingId] = useState<string | null>(null);
  // Inline-form state (replaces the legacy global Zustand composer
  // slice). Independent of the reader (`readingId`) so closing the
  // form doesn't toggle the reader on / off.
  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<GoalEntry | null>(null);

  const entriesRef = useRef(entries);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  // Auto-close the reader when the goal it points to is no longer in
  // `entries` (deleted from this page, or removed by an external
  // refresh). Keeping the stale id around would leave the reader
  // mounted on `null` and force the consumer to render an empty
  // shell ; clearing here keeps the UX consistent across mutations.
  useEffect(() => {
    if (readingId !== null && !entries.some((e) => e.id === readingId)) {
      setReadingId(null);
    }
  }, [readingId, entries]);

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
        // Success : the optimistic flip IS the server state — no
        // refetch. The old bump re-downloaded + re-decrypted the
        // whole collection after every status click (audit 2026-06).
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
    [ctx, setEntries],
  );

  const openCreateForm = useCallback(() => {
    setEditingEntry(null);
    setFormOpen(true);
  }, []);

  const openEditForm = useCallback((entry: GoalEntry) => {
    setEditingEntry(entry);
    setFormOpen(true);
  }, []);

  // Alias kept so GoalRow / GoalCard's existing
  // `onClick={() => editEntry(entry)}` compiles untouched.
  // Internally identical to `openEditForm`.
  const editEntry = openEditForm;

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditingEntry(null);
  }, []);

  const updateTitle = useCallback(
    async (entry: GoalEntry, nextTitle: string) => {
      if (!ctx) return;
      // The caller already trimmed + bailed on no-op renames ; we
      // still guard against an empty string here because the API
      // would reject it and we'd roll back uselessly.
      const trimmed = nextTitle.trim();
      if (trimmed.length === 0 || trimmed === entry.title) return;
      const token = trackerRef.current.begin(entry.id);
      const previousTitle = entry.title;
      const now = new Date().toISOString();
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id ? { ...e, title: trimmed, updatedAt: now } : e,
        ),
      );
      try {
        await goalsClient.update(ctx.moduleUserId, ctx.mainKey, entry.id, {
          date: entry.date,
          title: trimmed,
          note: entry.note,
          status: entry.status,
          thread: entry.thread,
          completedAt: entry.completedAt,
          updatedAt: now,
        });
        // Success : optimistic rename is the server state — no
        // refetch (audit 2026-06).
      } catch (err) {
        if (!trackerRef.current.isLatest(entry.id, token)) return;
        setEntries((prev) =>
          prev.map((e) =>
            e.id === entry.id ? { ...e, title: previousTitle } : e,
          ),
        );
        if (import.meta.env.DEV)
          console.warn('goals: inline rename failed', err);
      }
    },
    [ctx, setEntries],
  );

  const deleteEntry = useCallback(
    async (entry: GoalEntry) => {
      if (!ctx) return;
      const ok = await confirm({
        message: t('goals.row.confirmDelete', { values: { title: entry.title } }),
        tone: 'danger',
      });
      if (!ok) return;
      const token = trackerRef.current.begin(entry.id);
      const indexBefore = entriesRef.current.findIndex((e) => e.id === entry.id);
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      try {
        await goalsClient.remove(ctx.moduleUserId, ctx.mainKey, entry.id);
        trackerRef.current.forget(entry.id);
        // Success : optimistic removal is the server state — no
        // refetch (audit 2026-06).
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
    [ctx, setEntries, t, confirm],
  );

  // Insert (create) or replace (edit) a single record locally after
  // the form saved it — avoids the full-collection refetch the version
  // bump used to trigger on every « Enregistrer » (audit 2026-06 passe
  // 2). The mapper + sort match `useGoalsData`'s load path so the
  // optimistic row lands in the same position a refetch would place it.
  const upsertRecord = useCallback(
    (record: DecryptedRecord<GoalsPayload>) => {
      const entry = recordToEntry(record);
      setEntries((prev) => {
        const without = prev.filter((e) => e.id !== entry.id);
        return [...without, entry].sort(byDateDesc);
      });
    },
    [setEntries],
  );

  const openReader = useCallback((id: string) => setReadingId(id), []);
  const closeReader = useCallback(() => setReadingId(null), []);

  // Bulk theme (« thread ») mutation engine — rename / delete a theme
  // across every goal that carries it. Optimistic local update +
  // parallel PATCHes ; each failed PATCH reverts ITS goal's thread to
  // the pre-update value (no cross-talk between concurrent mutations).
  // Same shape as Journal's « fils » engine — both drive the shared
  // ThreadManagerModal.
  const applyThreadTransform = useCallback(
    async (
      transform: (raw: string) => string,
    ): Promise<ThreadMutationResult> => {
      if (!ctx) return { updatedIds: [], failedIds: [] };
      const affected: Array<{ entry: GoalEntry; nextThread: string }> = [];
      for (const entry of entriesRef.current) {
        const next = transform(entry.thread);
        if (next !== entry.thread) affected.push({ entry, nextThread: next });
      }
      if (affected.length === 0) return { updatedIds: [], failedIds: [] };

      // Snapshot pre-update threads so each failed PATCH reverts its own
      // entry only.
      const snapshot = new Map(
        affected.map(({ entry }) => [entry.id, entry.thread]),
      );

      // Optimistic local update — flip every affected goal at once.
      setEntries((prev) =>
        prev.map((e) => {
          const change = affected.find((a) => a.entry.id === e.id);
          return change ? { ...e, thread: change.nextThread } : e;
        }),
      );

      const updatedIds: string[] = [];
      const failedIds: string[] = [];
      const now = new Date().toISOString();
      await Promise.all(
        affected.map(async ({ entry, nextThread }) => {
          try {
            await goalsClient.update(ctx.moduleUserId, ctx.mainKey, entry.id, {
              date: entry.date,
              title: entry.title,
              note: entry.note,
              status: entry.status,
              thread: nextThread,
              completedAt: entry.completedAt,
              updatedAt: now,
            });
            updatedIds.push(entry.id);
          } catch (err) {
            failedIds.push(entry.id);
            const previous = snapshot.get(entry.id);
            if (previous !== undefined) {
              setEntries((prev) =>
                prev.map((e) =>
                  e.id === entry.id ? { ...e, thread: previous } : e,
                ),
              );
            }
            if (import.meta.env.DEV)
              console.warn('goals: theme mutation failed', err);
          }
        }),
      );

      // Reconcile the local list to whatever landed server-side on the
      // next fetch (matches Journal's posture).
      if (updatedIds.length > 0) bumpGoalsVersion();
      return { updatedIds, failedIds };
    },
    [ctx, bumpGoalsVersion, setEntries],
  );

  const renameThread = useCallback(
    (from: string, to: string) =>
      applyThreadTransform((raw) => renameThreadInString(raw, from, to)),
    [applyThreadTransform],
  );

  const deleteThread = useCallback(
    (target: string) =>
      applyThreadTransform((raw) => removeThreadFromString(raw, target)),
    [applyThreadTransform],
  );

  return {
    readingId,
    formOpen,
    editingEntry,
    openCreateForm,
    openEditForm,
    closeForm,
    cycleStatus,
    editEntry,
    updateTitle,
    deleteEntry,
    upsertRecord,
    openReader,
    closeReader,
    renameThread,
    deleteThread,
  };
}
