import { useMemo, useState } from 'react';

import { goalsClient } from '@/core/api/modules/goals';
import { useModuleClient } from '@/core/modules/use-module-client';
import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';

import Footer from '../components/Footer';
import { genMonthOptions, type GoalStatus } from '../lib/constants';
import { isCanonicalGoalStatus } from '../lib/guards';

import GoalFormFields from './goal/form-fields';
import { buildGoalPayload } from './goal/save-payload';
import { useDraftCoordination } from './goal/use-draft-coordination';
import { useThreadTokens } from './goal/use-thread-tokens';

interface GoalBodyProps {
  onClose: () => void;
}

/**
 * Goal entry form — title (required), date (`YYYY-MM` via paired
 * month + year `<select>` + numeric input because Firefox /
 * Safari macOS render `<input type="month">` as a plain text
 * input, hiding the picker entirely), status (3-segment Ouvert
 * / En cours / Terminé), thread (free text + chips of existing
 * thread tokens harvested from previously saved goals), note
 * (Markdown editor with visual / source toggle).
 *
 * Branches between **create** and **update** based on
 * `composer.editing` : a row's pencil icon on the Goals page
 * calls `openComposer('goal', { type, id, payload })`, which
 * prefills this form. Both branches `bumpGoalsVersion()` so the
 * Goals page refetches and the row updates / appears without a
 * reload.
 *
 * Drafts : the new-entry path (only) saves a debounced draft
 * via `useGoalDraft` so a user who closes the modal mid-thought
 * gets their input back next time they open it. Auto-restoring
 * is gated on every input being empty, so an in-flight typing
 * session is never clobbered.
 *
 * `completedAt` is managed across the form too — same boundary
 * logic as the Goals page's status toggle. Flipping into `done`
 * seeds `now`, flipping out clears, staying-in-done preserves
 * the previous value.
 *
 * **File layout.** The 11 `useState` slots stay here (coordinated
 * state, no benefit to splitting). The two extracted hooks own
 * narrow concerns : `useThreadTokens` lists chip suggestions,
 * `useDraftCoordination` wraps `useGoalDraft` plus the auto-save
 * + auto-restore effects. `save-payload.ts` holds the pure
 * `buildGoalPayload` helper. `form-fields.tsx` renders the
 * inputs. The parent only orchestrates.
 */
export default function GoalBody({ onClose }: GoalBodyProps) {
  const { t, language } = useI18n();
  const monthOptions = useMemo(() => genMonthOptions(language), [language]);
  const ctx = useModuleClient('goals');
  const bumpGoalsVersion = useNodeaStore((s) => s.bumpGoalsVersion);
  const editing = useNodeaStore((s) =>
    s.composer.editing && s.composer.editing.type === 'goal'
      ? s.composer.editing
      : null,
  );

  const initialMonth = editing ? (editing.payload.date ?? '').slice(5, 7) : '';
  const initialYear = editing ? (editing.payload.date ?? '').slice(0, 4) : '';

  const [title, setTitle] = useState(editing?.payload.title ?? '');
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [status, setStatus] = useState<GoalStatus>(
    isCanonicalGoalStatus(editing?.payload.status) ? editing!.payload.status : 'open',
  );
  const [thread, setThread] = useState(editing?.payload.thread ?? '');
  const [note, setNote] = useState(editing?.payload.note ?? '');
  const [noteMode, setNoteMode] = useState<'visual' | 'markdown'>('visual');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = editing !== null;

  const threadOptions = useThreadTokens(ctx);

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
        editing: editing?.payload ?? null,
      });
      if (editing) {
        await goalsClient.update(ctx.moduleUserId, ctx.mainKey, editing.id, payload);
      } else {
        await goalsClient.create(ctx.moduleUserId, ctx.mainKey, payload);
        clearDraft();
      }
      bumpGoalsVersion();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('goals.composer.errors.saveFailed'),
      );
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="space-y-3 px-[22px] pt-3.5 pb-3">
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
        />
      </div>
      <Footer
        onSubmit={handleSave}
        submitting={submitting}
        error={error}
        submitLabel={isEdit ? t('common.actions.update') : t('common.actions.save')}
        submittingLabel={isEdit ? t('goals.composer.submittingUpdate') : t('common.states.saving')}
      />
    </>
  );
}
