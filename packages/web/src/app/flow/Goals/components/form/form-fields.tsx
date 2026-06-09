/**
 * Stateless render of the Goal composer's form-fields block.
 *
 * Extracted from `Goal.tsx` (decomposition follow-up) — the
 * parent kept all the coordinated `useState` slots ; this file
 * just consumes values + setters via prop drilling and emits
 * the JSX. No state, no effects, no I/O.
 *
 * Layout, attributes, accessibility labels, and Cmd+Enter
 * submission are preserved 1:1 from the inline version. The
 * draft-restored banner stays in the parent (it owns
 * `resetDraft`) ; everything else — title input, month + year +
 * status row, thread input + chip strip, MarkdownEditor —
 * lives here.
 */
import { cn } from '@/lib/utils';
import DirkInput from '@/ui/atoms/dirk/Input';
import DirkSelect from '@/ui/atoms/dirk/Select';

import MarkdownEditor from '@/ui/dirk/forms/MarkdownEditor';
import {
  GOAL_STATUS_ACTIVE_TONE,
  type GoalStatus,
} from '@/ui/dirk/forms/constants';
import { submitOnCmdEnter } from '@/ui/dirk/forms/format';

export interface GoalFormFieldsProps {
  // Field values + setters (kept as raw strings / typed unions,
  // just like the parent's useState slots).
  title: string;
  setTitle: (next: string) => void;
  month: string;
  setMonth: (next: string) => void;
  year: string;
  setYear: (next: string) => void;
  status: GoalStatus;
  setStatus: (next: GoalStatus) => void;
  thread: string;
  setThread: (next: string) => void;
  note: string;
  setNote: (next: string) => void;
  noteMode: 'visual' | 'markdown';
  setNoteMode: (next: 'visual' | 'markdown') => void;

  // Submission + helpers
  submitting: boolean;
  handleSave: () => void | Promise<void>;
  toggleThreadToken: (token: string) => void;

  // Derived data
  threadOptions: ReadonlyArray<string>;
  activeThreads: string[];
  monthOptions: ReadonlyArray<{ value: string; label: string }>;

  // i18n
  t: (key: string) => string;

  /** Id of the parent form's `role="alert"` error line, or `null`
   *  when no error is showing. Wired to the validated inputs
   *  (title, year) via `aria-describedby` so assistive tech reads
   *  the error with the field (audit 2026-06, lot G). */
  errorId?: string | null;
}

export default function GoalFormFields({
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
  noteMode,
  setNoteMode,
  submitting,
  handleSave,
  toggleThreadToken,
  threadOptions,
  activeThreads,
  monthOptions,
  t,
  errorId,
}: GoalFormFieldsProps) {
  return (
    <>
      <DirkInput
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
        placeholder={t('goals.composer.titlePlaceholder')}
        aria-label={t('goals.composer.titleAria')}
        aria-describedby={errorId ?? undefined}
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
            {monthOptions.map((m) => (
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
            aria-describedby={errorId ?? undefined}
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
          aria-label={t('goals.composer.threadAria')}
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
    </>
  );
}
