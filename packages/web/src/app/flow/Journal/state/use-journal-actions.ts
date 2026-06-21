/**
 * Journal actions hook (REFACTO-08). Owns the reader UI state, the
 * inline-composer state, the per-entry mutation handlers (delete /
 * upsert), and the bulk thread-mutation engine (rename / delete a thread
 * across every entry that carries it). Callbacks read live data via
 * `entriesRef` so their identity stays stable across data fetches. Not a
 * React context — republished by the provider via `JournalActionsValue`.
 *
 * Opening the inline form auto-collapses the chart (focus mode) — hence
 * the `setChartCollapsed` dep, owned by the filters hook and threaded in
 * by the provider.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import type { JournalPayload } from '@nodea/shared';

import type { DecryptedRecord } from '@/core/api/modules/collection-client';
import { journalClient } from '@/core/api/modules/journal';
import type { ModuleClient } from '@/core/modules/use-module-client';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { useConfirm } from '@/ui/dirk/confirm/confirm-context';

import { recordToEntry } from '../lib/mappers';
import {
  removeThreadFromString,
  renameThreadInString,
} from '../lib/threads-mutate';
import type { JournalEntry } from '../lib/types';

/**
 * Result of a bulk thread mutation (rename / merge / delete). The action
 * runs PATCHes in parallel ; this shape lets the caller surface a
 * precise « N réussis, M échoués » report without re-reading entries.
 */
export interface ThreadMutationResult {
  updatedIds: ReadonlyArray<string>;
  failedIds: ReadonlyArray<string>;
}

export interface JournalActionsDeps {
  ctx: ModuleClient | null;
  entries: ReadonlyArray<JournalEntry>;
  setEntries: React.Dispatch<React.SetStateAction<JournalEntry[]>>;
  bumpJournalVersion: () => void;
  setChartCollapsed: (next: boolean) => void;
}

export interface JournalActionsState {
  readingId: string | null;
  formOpen: boolean;
  editingEntry: JournalEntry | null;
  openCreateForm: () => void;
  openEditForm: (entry: JournalEntry) => void;
  closeForm: () => void;
  editEntry: (entry: JournalEntry) => void;
  deleteEntry: (entry: JournalEntry) => Promise<void>;
  upsertRecord: (record: DecryptedRecord<JournalPayload>) => void;
  openReader: (id: string) => void;
  closeReader: () => void;
  renameThread: (from: string, to: string) => Promise<ThreadMutationResult>;
  deleteThread: (target: string) => Promise<ThreadMutationResult>;
}

export function useJournalActions({
  ctx,
  entries,
  setEntries,
  bumpJournalVersion,
  setChartCollapsed,
}: JournalActionsDeps): JournalActionsState {
  const { t, language } = useI18n();
  const confirm = useConfirm();

  const [readingId, setReadingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);

  // Ref keeps action callbacks stable across data fetches.
  const entriesRef = useRef(entries);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  // Opening the form auto-collapses the heatmap so the writing surface
  // gets the full width (same posture as Mood).
  const openCreateForm = useCallback(() => {
    setEditingEntry(null);
    setFormOpen(true);
    setChartCollapsed(true);
  }, [setChartCollapsed]);

  const openEditForm = useCallback(
    (entry: JournalEntry) => {
      setEditingEntry(entry);
      setFormOpen(true);
      setChartCollapsed(true);
    },
    [setChartCollapsed],
  );

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditingEntry(null);
  }, []);

  const editEntry = openEditForm;

  const deleteEntry = useCallback(
    async (entry: JournalEntry) => {
      if (!ctx) return;
      const label = entry.title ?? entry.dateLabel;
      const ok = await confirm({
        message: t('journal.context.confirmDelete', { values: { label } }),
        tone: 'danger',
      });
      if (!ok) return;
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      try {
        await journalClient.remove(ctx.moduleUserId, ctx.mainKey, entry.id);
        // Success : the optimistic removal IS the server state — no
        // refetch (audit 2026-06).
      } catch (err) {
        // Targeted rollback : re-insert THIS entry only, keeping the
        // list newest-first, instead of restoring a full snapshot that
        // would undo concurrent mutations.
        setEntries((prev) => {
          const next = [...prev, entry];
          next.sort((a, b) => b.dateIso.localeCompare(a.dateIso));
          return next;
        });
        if (import.meta.env.DEV) console.warn('journal: delete failed', err);
      }
    },
    [ctx, t, confirm, setEntries],
  );

  const upsertRecord = useCallback(
    (record: DecryptedRecord<JournalPayload>) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const labels = {
        language,
        todayLabel: t('common.time.today'),
        yesterdayLabel: t('common.time.yesterday'),
      };
      const entry = recordToEntry(record, today, labels);
      setEntries((prev) => {
        const without = prev.filter((e) => e.id !== entry.id);
        const next = [entry, ...without];
        next.sort((a, b) => b.dateIso.localeCompare(a.dateIso));
        return next;
      });
    },
    [language, t, setEntries],
  );

  const openReader = useCallback((id: string) => setReadingId(id), []);
  const closeReader = useCallback(() => setReadingId(null), []);

  /**
   * Apply a thread-string transform to every in-memory entry and PATCH
   * each one whose thread actually changed. Optimistic local update +
   * parallel PATCHes ; each failed PATCH reverts ITS entry's thread to
   * the pre-update value (no cross-talk between concurrent mutations).
   */
  const applyThreadTransform = useCallback(
    async (
      transform: (raw: string) => string,
    ): Promise<ThreadMutationResult> => {
      if (!ctx) return { updatedIds: [], failedIds: [] };
      const affected: Array<{ entry: JournalEntry; nextThread: string }> = [];
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

      // Optimistic local update — flip every affected entry at once.
      setEntries((prev) =>
        prev.map((e) => {
          const change = affected.find((a) => a.entry.id === e.id);
          return change ? { ...e, thread: change.nextThread } : e;
        }),
      );

      const updatedIds: string[] = [];
      const failedIds: string[] = [];
      await Promise.all(
        affected.map(async ({ entry, nextThread }) => {
          try {
            await journalClient.update(ctx.moduleUserId, ctx.mainKey, entry.id, {
              type: 'journal.entry',
              date: entry.dateIso,
              thread: nextThread,
              title: entry.title,
              content: entry.content,
              attachments: entry.attachments,
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
              console.warn('journal: thread mutation failed', err);
          }
        }),
      );

      if (updatedIds.length > 0) bumpJournalVersion();
      return { updatedIds, failedIds };
    },
    [ctx, bumpJournalVersion, setEntries],
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
    editEntry,
    deleteEntry,
    upsertRecord,
    openReader,
    closeReader,
    renameThread,
    deleteThread,
  };
}
