import { useEffect, useMemo, useState } from 'react';

import { goalsClient } from '@/core/api/modules/goals';
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
} from '@/core/store/nodea-store';
import { useGoalDraft } from '@/app/flow/Goals/hooks/useGoalDraft';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';
import DirkInput from '@/ui/atoms/dirk/Input';
import DirkSelect from '@/ui/atoms/dirk/Select';

import Footer from '../components/Footer';
import MarkdownEditor from '../components/MarkdownEditor';
import {
  GOAL_STATUS_ACTIVE_TONE,
  MONTH_OPTIONS,
  type GoalStatus,
} from '../lib/constants';
import { submitOnCmdEnter } from '../lib/format';
import { isCanonicalGoalStatus } from '../lib/guards';

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
 * `completed_at` is managed across the form too — same boundary
 * logic as the Goals page's status toggle. Flipping into `done`
 * seeds `now`, flipping out clears, staying-in-done preserves
 * the previous value.
 */
export default function GoalBody({ onClose }: GoalBodyProps) {
  const { t } = useI18n();
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const moduleUserId = modules['goals']?.moduleUserId ?? null;
  const bumpGoalsVersion = useNodeaStore((s) => s.bumpGoalsVersion);
  const editing = useNodeaStore((s) =>
    s.composer.editing && s.composer.editing.type === 'goal'
      ? s.composer.editing
      : null,
  );
  // New-entry path only — when editing, the server record is
  // the canonical state and a draft would clobber the prefill.
  const {
    hydrated: draftHydrated,
    hydrating: draftHydrating,
    save: saveDraft,
    clear: clearDraft,
  } = useGoalDraft();

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
  const [threadOptions, setThreadOptions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  const isEdit = editing !== null;

  // Pull existing thread tokens from every stored goal so the
  // composer can suggest them as chips below the input. Splits
  // each goal's `thread` field on commas (the multi-thread
  // convention) and dedupes.
  useEffect(() => {
    if (!mainKey || !moduleUserId) return undefined;
    let cancelled = false;
    goalsClient
      .list(moduleUserId, mainKey)
      .then((records) => {
        if (cancelled) return;
        const set = new Set<string>();
        for (const r of records) {
          const raw = r.payload.thread ?? '';
          for (const t of raw.split(',')) {
            const trimmed = t.trim();
            if (trimmed) set.add(trimmed);
          }
        }
        setThreadOptions(Array.from(set).sort((a, b) => a.localeCompare(b, 'fr')));
      })
      .catch(() => {
        if (cancelled) return;
        setThreadOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [mainKey, moduleUserId]);

  // Auto-load any pending draft once it surfaces. Skipped on
  // edit, and skipped if the user has already typed something —
  // we don't want a draft to clobber active input.
  useEffect(() => {
    if (isEdit || draftHydrating || draftRestored) return;
    if (!draftHydrated) return;
    if (
      title.trim() !== '' ||
      thread.trim() !== '' ||
      note.trim() !== '' ||
      month !== '' ||
      year !== ''
    ) {
      return;
    }
    setTitle(draftHydrated.title);
    setMonth(draftHydrated.month);
    setYear(draftHydrated.year);
    setStatus(
      isCanonicalGoalStatus(draftHydrated.status) ? draftHydrated.status : 'open',
    );
    setThread(draftHydrated.thread);
    setNote(draftHydrated.note);
    setDraftRestored(true);
  }, [
    isEdit,
    draftHydrating,
    draftHydrated,
    draftRestored,
    title,
    thread,
    note,
    month,
    year,
  ]);

  // Persist every change through the debounced draft hook.
  useEffect(() => {
    if (isEdit) return;
    saveDraft({ title, month, year, status, thread, note });
  }, [title, month, year, status, thread, note, isEdit, saveDraft]);

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

  function composeDate(y: string, m: string): string {
    // Year + month → `YYYY-MM`. Year alone → bare `YYYY` (a
    // goal dated to a year without a specific month is a real
    // intention, not garbage ; the Goals page's `formatDate`
    // tolerates the bare-year shape via its regex fallback).
    // Month without a year drops to empty — a month with no
    // year can't be ordered or formatted unambiguously.
    if (y && m) return `${y}-${m}`;
    if (y) return y;
    return '';
  }

  async function handleSave(): Promise<void> {
    if (submitting) return;
    setError(null);
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError(t('goals.composer.errors.titleRequired'));
      return;
    }
    if (!mainKey || !moduleUserId) {
      setError(t('goals.composer.errors.missingConfig'));
      return;
    }
    if (year && !/^\d{4}$/.test(year)) {
      setError(t('goals.composer.errors.invalidYear'));
      return;
    }
    setSubmitting(true);
    try {
      const previousCompletedAt =
        typeof editing?.payload.completed_at === 'string'
          ? editing.payload.completed_at
          : null;
      const previousStatus = isCanonicalGoalStatus(editing?.payload.status)
        ? editing!.payload.status
        : 'open';
      const nextCompletedAt =
        status === 'done'
          ? previousStatus === 'done'
            ? previousCompletedAt
            : new Date().toISOString()
          : null;
      const payload = {
        date: composeDate(year, month),
        title: trimmedTitle,
        note,
        status,
        thread: thread.trim(),
        completed_at: nextCompletedAt,
        updated_at: new Date().toISOString(),
      };
      if (editing) {
        await goalsClient.update(moduleUserId, mainKey, editing.id, payload);
      } else {
        await goalsClient.create(moduleUserId, mainKey, payload);
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
              onClick={() => {
                setTitle('');
                setMonth('');
                setYear('');
                setStatus('open');
                setThread('');
                setNote('');
                setDraftRestored(false);
                clearDraft();
              }}
              className="cursor-pointer text-[11px] underline-offset-2 hover:underline"
            >
              {t('goals.composer.resetDraft')}
            </button>
          </div>
        ) : null}

        <DirkInput
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
          placeholder={t('goals.composer.titlePlaceholder')}
          disabled={submitting}
        />

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[200px_1fr]">
          <div className="grid grid-cols-2 gap-1.5">
            <DirkSelect
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              aria-label={t('goals.composer.monthAria')}
              disabled={submitting}
            >
              <option value="">{t('goals.composer.monthPlaceholder')}</option>
              {MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </DirkSelect>
            <DirkInput
              inputMode="numeric"
              value={year}
              onChange={(e) => {
                // Strip non-digits live and cap at 4 chars so
                // the input never holds anything but a partial /
                // complete 4-digit year.
                const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                setYear(digits);
              }}
              onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
              placeholder={t('goals.composer.yearPlaceholder')}
              maxLength={4}
              aria-label={t('goals.composer.yearAria')}
              disabled={submitting}
              align="center"
            />
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(['open', 'wip', 'done'] as const).map((s) => {
              const active = status === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  aria-pressed={active}
                  disabled={submitting}
                  className={cn(
                    'h-8 cursor-pointer rounded-sm border text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                    active
                      ? GOAL_STATUS_ACTIVE_TONE[s]
                      : 'border-hair bg-bg text-muted hover:border-ink-soft hover:text-ink',
                  )}
                >
                  {t(`goals.status.title.${s}`)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <DirkInput
            value={thread}
            onChange={(e) => setThread(e.target.value)}
            onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
            placeholder={t('goals.composer.threadPlaceholder')}
            disabled={submitting}
          />
          {threadOptions.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-0.5 text-[11px] italic text-muted">
                {t('goals.composer.existingThreads')}
              </span>
              {threadOptions.map((opt) => {
                const active = activeThreads.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleThreadToken(opt)}
                    disabled={submitting}
                    className={cn(
                      'cursor-pointer rounded-sm border px-1.5 py-0.5 text-[11px] transition-colors',
                      active
                        ? 'border-accent bg-accent-soft text-accent-deep'
                        : 'border-hair bg-bg text-muted hover:border-ink-soft hover:text-ink',
                      'disabled:cursor-not-allowed disabled:opacity-50',
                    )}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <MarkdownEditor
          value={note}
          onChange={setNote}
          onSubmit={handleSave}
          disabled={submitting}
          mode={noteMode}
          onModeChange={setNoteMode}
          minHeightPx={120}
          maxHeightPx={300}
          placeholder={t('goals.composer.notePlaceholder')}
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
