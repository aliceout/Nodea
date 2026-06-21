/**
 * Mood actions hook (REFACTO-08). Owns the inline-form open/edit state
 * and the create / edit / delete / upsert handlers. Callbacks read live
 * data via `entriesRef` so their identity stays stable across data
 * fetches — consumers that only need actions don't re-render when
 * entries change. Not a React context — republished by the provider via
 * `MoodActionsValue`.
 *
 * Opening the form auto-collapses the chart (focus mode) and `closeForm`
 * reopens it — hence the `setChartCollapsed` dep, owned by the filters
 * hook and threaded in by the provider.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import type { MoodPayload } from '@nodea/shared';

import type { DecryptedRecord } from '@/core/api/modules/collection-client';
import { moodClient } from '@/core/api/modules/mood';
import type { ModuleClient } from '@/core/modules/use-module-client';
import { createMutationTracker } from '@/core/state/mutation-tracker';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { useConfirm } from '@/ui/dirk/confirm/confirm-context';

import { recordToEntry } from '../lib/mappers';
import type { MoodEntry } from '../lib/types';

export interface MoodActionsDeps {
  ctx: ModuleClient | null;
  entries: ReadonlyArray<MoodEntry>;
  setEntries: React.Dispatch<React.SetStateAction<MoodEntry[]>>;
  today: Date;
  setChartCollapsed: (next: boolean) => void;
}

export interface MoodActionsState {
  formOpen: boolean;
  editingEntry: MoodEntry | null;
  openCreateForm: () => void;
  openEditForm: (entry: MoodEntry) => void;
  editEntry: (entry: MoodEntry) => void;
  closeForm: () => void;
  deleteEntry: (entry: MoodEntry) => Promise<void>;
  upsertRecord: (record: DecryptedRecord<MoodPayload>) => void;
}

export function useMoodActions({
  ctx,
  entries,
  setEntries,
  today,
  setChartCollapsed,
}: MoodActionsDeps): MoodActionsState {
  const { t, language } = useI18n();
  const confirm = useConfirm();

  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MoodEntry | null>(null);

  // Ref keeps action callbacks stable across data fetches.
  const entriesRef = useRef(entries);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  // Opening the form auto-collapses the chart so the inline form isn't
  // pushed below the fold by the heatmap; closing brings it back.
  const openCreateForm = useCallback(() => {
    setEditingEntry(null);
    setFormOpen(true);
    setChartCollapsed(true);
  }, [setChartCollapsed]);

  const openEditForm = useCallback(
    (entry: MoodEntry) => {
      setEditingEntry(entry);
      setFormOpen(true);
      setChartCollapsed(true);
    },
    [setChartCollapsed],
  );

  // Alias kept so EntryRow's existing `onClick={() => editEntry(entry)}`
  // compiles untouched.
  const editEntry = openEditForm;

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditingEntry(null);
    setChartCollapsed(false);
  }, [setChartCollapsed]);

  // FRONT-13 — per-entry mutation tracker so concurrent rollbacks don't
  // clobber each other.
  const trackerRef = useRef(createMutationTracker<string>());

  const deleteEntry = useCallback(
    async (entry: MoodEntry) => {
      if (!ctx) return;
      const ok = await confirm({
        message: t('mood.context.confirmDelete', { values: { date: entry.date } }),
        tone: 'danger',
      });
      if (!ok) return;
      const token = trackerRef.current.begin(entry.id);
      // Capture the original index so a rollback re-inserts in place.
      const indexBefore = entriesRef.current.findIndex((e) => e.id === entry.id);
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      try {
        await moodClient.remove(ctx.moduleUserId, ctx.mainKey, entry.id);
        trackerRef.current.forget(entry.id);
      } catch (err) {
        if (!trackerRef.current.isLatest(entry.id, token)) return;
        // Targeted rollback : re-insert THIS entry at its original
        // position without undoing concurrent unrelated mutations.
        setEntries((prev) => {
          if (prev.some((e) => e.id === entry.id)) return prev;
          const next = [...prev];
          const at =
            indexBefore < 0 || indexBefore > next.length ? next.length : indexBefore;
          next.splice(at, 0, entry);
          return next;
        });
        if (import.meta.env.DEV) console.warn('mood: delete failed', err);
      }
    },
    [ctx, t, confirm, setEntries],
  );

  const upsertRecord = useCallback(
    (record: DecryptedRecord<MoodPayload>) => {
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
    [today, t, language, setEntries],
  );

  return {
    formOpen,
    editingEntry,
    openCreateForm,
    openEditForm,
    editEntry,
    closeForm,
    deleteEntry,
    upsertRecord,
  };
}
