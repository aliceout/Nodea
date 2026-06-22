import { useMemo, useState } from 'react';

import { goalsClient } from '@/core/api/modules/goals';
import { useModuleClient } from '@/core/modules/use-module-client';
import { useI18n } from '@/i18n/I18nProvider.jsx';

import {
  genMonthOptions,
  MODULE_FORM_CARD,
  type GoalStatus,
} from '@/ui/dirk/forms/constants';
import FormError from '@/ui/dirk/forms/FormError';
import FormFooter from '@/ui/dirk/forms/FormFooter';
import { isCanonicalGoalStatus } from '@/ui/dirk/forms/guards';

import GoalFormFields from './form/form-fields';
import { buildGoalPayload } from './form/save-payload';
import { useDraftCoordination } from './form/use-draft-coordination';

import { useGoalsActions, useGoalsFilters } from '../context';
import type { GoalEntry } from '../lib/types';

interface GoalFormProps {
  /** When set, the form edits this entry instead of creating one. */
  initial?: GoalEntry;
  /** Close the form (cancel, or after a successful submit). */
  onClose: () => void;
}

/**
 * Goal entry form — inline composer rendered by `PrimaryColumn`
 * above the entries list / card grid, mirroring the HRT
 * `AdminLogForm` posture : a bordered card with the form fields
 * + a cancel/save row, no chrome that pulls the user away from
 * the page.
 *
 * Decomposed across `./form/` siblings :
 *   - `form-fields.tsx` — stateless field render
 *   - `use-thread-tokens.ts` — fil chip input
 *   - `use-draft-coordination.ts` — draft auto-save / restore
 *   - `save-payload.ts` — pure build helper
 *
 * Edit vs create :
 *   - On edit, the `initial` entry pre-fills every field. The
 *     draft restore banner is skipped (server payload wins).
 *   - On create, today's local date is the default and the draft
 *     restore banner can surface a previously-typed-but-not-
 *     saved goal.
 *
 * Save / update / error handling : `upsertRecord` splices the saved
 * record into the in-memory list on success (no full-collection
 * refetch — audit 2026-06 passe 2), `onClose` returns the user to the
 * list, and the in-component error feedback shows the friendly
 * message when validation or the network call fails.
 */
export default function GoalForm({ initial, onClose }: GoalFormProps) {
  const { t, language } = useI18n();
  const monthOptions = useMemo(() => genMonthOptions(language), [language]);
  const ctx = useModuleClient('goals');
  const { upsertRecord } = useGoalsActions();

  // Initial values come from `initial` on edit, or empty defaults
  // on create. The « date » field is split into month + year by
  // the form fields (Firefox / Safari macOS render
  // `<input type="month">` as plain text, so we use a paired
  // select + numeric input).
  const initialMonth = initial ? (initial.date ?? '').slice(5, 7) : '';
  const initialYear = initial ? (initial.date ?? '').slice(0, 4) : '';

  const [title, setTitle] = useState(initial?.title ?? '');
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [status, setStatus] = useState<GoalStatus>(
    isCanonicalGoalStatus(initial?.status) ? initial!.status : 'open',
  );
  const [thread, setThread] = useState(initial?.thread ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [noteMode, setNoteMode] = useState<'visual' | 'markdown'>('visual');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = initial !== undefined;

  // Thread chips come from the provider's already-computed list —
  // this form renders inside `GoalsProvider`. The old
  // `useThreadTokens(ctx)` hook re-fetched + re-decrypted the whole
  // goals collection on every form mount to rebuild the same list
  // (audit 2026-06).
  const { threads: threadOptions } = useGoalsFilters();

  const { draftRestored, resetDraft, clearDraft } = useDraftCoordination({
    isEdit,
    title,
    setTitle,
    month,
    setMonth,
    year,
    setYear,
    status,
    setStatus,
    thread,
    setThread,
    note,
    setNote,
  });

  // Append (or remove) a thread token from the comma-separated
  // string. Toggle behaviour means clicking the same chip twice
  // adds then removes.
  function toggleThreadToken(token: string): void {
    const current = thread
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (current.includes(token)) {
      setThread(current.filter((t) => t !== token).join(', '));
      return;
    }
    setThread(current.length > 0 ? `${current.join(', ')}, ${token}` : token);
  }

  const activeThreads = useMemo(
    () =>
      thread
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    [thread],
  );

  async function handleSave(): Promise<void> {
    if (submitting) return;
    setError(null);
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError(t('goals.composer.errors.titleRequired'));
      return;
    }
    if (!ctx) {
      setError(t('goals.composer.errors.missingConfig'));
      return;
    }
    if (year && !/^\d{4}$/.test(year)) {
      setError(t('goals.composer.errors.invalidYear'));
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildGoalPayload({
        title,
        year,
        month,
        status,
        thread,
        note,
        editing: initial
          ? {
              date: initial.date,
              title: initial.title,
              note: initial.note,
              status: initial.status,
              thread: initial.thread,
              completedAt: initial.completedAt,
              updatedAt: initial.updatedAt,
            }
          : null,
      });
      let record;
      if (initial) {
        record = await goalsClient.update(
          ctx.moduleUserId,
          ctx.mainKey,
          initial.id,
          payload,
        );
      } else {
        record = await goalsClient.create(ctx.moduleUserId, ctx.mainKey, payload);
        clearDraft();
      }
      upsertRecord(record);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('goals.composer.errors.saveFailed'),
      );
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleSave();
      }}
      className={MODULE_FORM_CARD}
      noValidate
    >
      <div className="space-y-3">
        {draftRestored ? (
          <div className="flex items-baseline justify-between gap-2 rounded-sm border-l-2 border-accent bg-accent-soft/40 px-3 py-1.5 text-[12px] text-accent-deep">
            <span>{t('goals.composer.draftRestored')}</span>
            <button
              type="button"
              onClick={resetDraft}
              className="cursor-pointer text-[11px] underline-offset-2 hover:underline"
            >
              {t('goals.composer.resetDraft')}
            </button>
          </div>
        ) : null}

        <GoalFormFields
          title={title}
          setTitle={setTitle}
          month={month}
          setMonth={setMonth}
          year={year}
          setYear={setYear}
          status={status}
          setStatus={setStatus}
          thread={thread}
          setThread={setThread}
          note={note}
          setNote={setNote}
          noteMode={noteMode}
          setNoteMode={setNoteMode}
          submitting={submitting}
          handleSave={handleSave}
          toggleThreadToken={toggleThreadToken}
          threadOptions={threadOptions}
          activeThreads={activeThreads}
          monthOptions={monthOptions}
          t={t}
          errorId={error ? 'goal-form-error' : null}
        />
      </div>

      <FormError id="goal-form-error">{error}</FormError>

      <FormFooter
        onCancel={onClose}
        submitting={submitting}
        submitLabel={
          submitting
            ? isEdit
              ? t('goals.composer.submittingUpdate')
              : t('common.states.saving')
            : isEdit
              ? t('common.actions.update')
              : t('common.actions.save')
        }
      />
    </form>
  );
}
