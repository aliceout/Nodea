import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogPanel, Transition } from '@headlessui/react';
import {
  LIBRARY_FORMAT_VALUES,
  LIBRARY_REVIEW_KIND_VALUES,
  LIBRARY_STATUS_VALUES,
  MOOD_SCORE_VALUES,
  type LibraryReviewKind,
  type LibraryStatus,
  type LibraryFormat,
  type MoodScore,
  type NormalisedBook,
} from '@nodea/shared';

import {
  apiLibraryLookupByIsbn,
  apiLibraryLookupByQuery,
  isApiError,
} from '@/core/api/client';
import { goalsClient } from '@/core/api/modules/goals';
import {
  libraryItemsClient,
  libraryReviewsClient,
} from '@/core/api/modules/library';
import { moodClient } from '@/core/api/modules/mood';
import { passageClient } from '@/core/api/modules/passage';
import { htmlToMarkdown, markdownToHtml } from '@/lib/journal-markdown';
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
  type ComposerType,
} from '@/core/store/nodea-store';
import { cn } from '@/lib/utils';
import questions from '@/i18n/fr/Mood/questions.json';

const MONTH_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '01', label: 'Janvier' },
  { value: '02', label: 'Février' },
  { value: '03', label: 'Mars' },
  { value: '04', label: 'Avril' },
  { value: '05', label: 'Mai' },
  { value: '06', label: 'Juin' },
  { value: '07', label: 'Juillet' },
  { value: '08', label: 'Août' },
  { value: '09', label: 'Septembre' },
  { value: '10', label: 'Octobre' },
  { value: '11', label: 'Novembre' },
  { value: '12', label: 'Décembre' },
];


/**
 * ComposerModal — Direction K · Sauge.
 *
 * Top-positioned overlay (≈ 130 px from the top of the viewport),
 * 620 px wide on desktop, with a five-tab type picker. The body
 * adapts to the selected type:
 *
 * - `mood`: structured form — 3 positives + note (-2..+2) + optional
 *   "question du jour" + optional free comment. Mirrors the legacy
 *   Mood entry shape (`MoodPayloadSchema`); emoji has been dropped
 *   per the Direction K spec but is still tolerated on read.
 * - other types: a single large Instrument-Serif textarea — quick
 *   capture for passages, goals, habits, free notes.
 *
 * Dismissal is wired to `closeComposer()`. The "Enregistrer" CTA
 * is a no-op until each module's encryption pipeline accepts entries
 * from this surface; opening, type-switching and Esc are already
 * production-ready.
 */
export default function ComposerModal() {
  const open = useNodeaStore((s) => s.composer.open);
  const type = useNodeaStore((s) => s.composer.type);
  const setComposerType = useNodeaStore((s) => s.setComposerType);
  const closeComposer = useNodeaStore((s) => s.closeComposer);

  return (
    <Transition show={open} as={Fragment} afterLeave={() => undefined}>
      <Dialog className="relative z-50" onClose={closeComposer}>
        <Transition.Child
          as={Fragment}
          enter="transition-opacity ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-ink/30" aria-hidden="true" />
        </Transition.Child>

        <div className="fixed inset-0 flex items-start justify-center px-4 pt-[12vh] sm:pt-[110px]">
          <Transition.Child
            as={Fragment}
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 -translate-y-3 scale-[0.98]"
            enterTo="opacity-100 translate-y-0 scale-100"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0 scale-100"
            leaveTo="opacity-0 -translate-y-3 scale-[0.98]"
          >
            <DialogPanel className="relative w-full max-w-[620px] overflow-hidden rounded-[12px] border border-hair bg-bg shadow-[0_24px_60px_rgba(0,0,0,0.18),0_4px_12px_rgba(0,0,0,0.08)]">
              <TypePicker active={type} onSelect={setComposerType} />
              {type === 'mood' ? (
                <MoodBody onClose={closeComposer} />
              ) : type === 'goal' ? (
                <GoalBody onClose={closeComposer} />
              ) : type === 'journal' ? (
                <JournalBody onClose={closeComposer} />
              ) : type === 'library-item' ? (
                <LibraryItemBody onClose={closeComposer} />
              ) : type === 'library-review' ? (
                <LibraryReviewBody onClose={closeComposer} />
              ) : (
                <SimpleBody type={type} onClose={closeComposer} />
              )}
            </DialogPanel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}

interface TypePickerProps {
  active: ComposerType;
  onSelect: (next: ComposerType) => void;
}

const TYPE_OPTIONS: Array<{ id: ComposerType; label: string }> = [
  { id: 'mood', label: 'Mood' },
  { id: 'journal', label: 'Journal' },
  { id: 'pass', label: 'Passage' },
  { id: 'goal', label: 'Goal' },
  { id: 'habit', label: 'Habit' },
  { id: 'note', label: 'Note libre' },
];

function TypePicker({ active, onSelect }: TypePickerProps) {
  return (
    <div className="flex gap-1 px-3 pt-2.5">
      {TYPE_OPTIONS.map((opt) => {
        const isActive = active === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onSelect(opt.id)}
            className={cn(
              'rounded-md px-2.5 py-1 text-[12px] transition-colors',
              isActive
                ? 'bg-accent-soft font-semibold text-accent-deep'
                : 'bg-transparent font-medium text-muted hover:text-ink',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

type SimpleType = Exclude<
  ComposerType,
  'mood' | 'goal' | 'journal' | 'library-item' | 'library-review'
>;

const SIMPLE_PLACEHOLDERS: Record<SimpleType, string> = {
  pass: 'Un extrait qui mérite d’être relu — citation entre guillemets, page et ouvrage en métadonnées.',
  habit: 'Une habitude à suivre — quoi, à quel rythme.',
  note: 'Une note libre. Aucune contrainte.',
};

interface SimpleBodyProps {
  type: SimpleType;
  onClose: () => void;
}

function SimpleBody({ type, onClose }: SimpleBodyProps) {
  const [text, setText] = useState('');
  return (
    <>
      <div className="px-[22px] pt-3.5 pb-3">
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => submitOnCmdEnter(e, onClose)}
          placeholder={SIMPLE_PLACEHOLDERS[type]}
          className="block min-h-[90px] w-full resize-none border-0 bg-transparent font-serif text-[19px] leading-[1.5] text-ink placeholder:text-muted-soft focus:outline-none"
        />
      </div>
      <Footer onSubmit={onClose} />
    </>
  );
}

const SCORE_LABELS: Record<MoodScore, string> = {
  '-2': 'très bas',
  '-1': 'bas',
  '0': 'neutre',
  '1': 'bon',
  '2': 'très bon',
};

interface MoodBodyProps {
  onClose: () => void;
}

function MoodBody({ onClose }: MoodBodyProps) {
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const moduleUserId = modules['mood']?.moduleUserId ?? null;
  const bumpMoodVersion = useNodeaStore((s) => s.bumpMoodVersion);
  const editing = useNodeaStore((s) =>
    s.composer.editing && s.composer.editing.type === 'mood'
      ? s.composer.editing
      : null,
  );

  const initialScore = editing && isMoodScoreString(editing.payload.mood_score)
    ? (editing.payload.mood_score as MoodScore)
    : null;
  const initialPositives: [string, string, string] = editing
    ? [
        editing.payload.positive1 ?? '',
        editing.payload.positive2 ?? '',
        editing.payload.positive3 ?? '',
      ]
    : ['', '', ''];

  const [positives, setPositives] =
    useState<[string, string, string]>(initialPositives);
  const [score, setScore] = useState<MoodScore | null>(initialScore);
  const [answer, setAnswer] = useState(editing?.payload.answer ?? '');
  const [comment, setComment] = useState(editing?.payload.comment ?? '');
  const [optionalsOpen, setOptionalsOpen] = useState(
    Boolean(editing && (editing.payload.answer || editing.payload.comment)),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = editing !== null;

  // When creating, pick a random question once at mount so it stays
  // stable while the user types. When editing, use the question
  // already saved on the entry (no re-rolling — the user's answer
  // is paired with that specific prompt).
  const question = useMemo<string>(() => {
    if (editing) return editing.payload.question ?? '';
    const list = questions as readonly string[];
    if (list.length === 0) return '';
    const i = Math.floor(Math.random() * list.length);
    return list[i] ?? '';
  }, [editing]);

  function setPositive(idx: 0 | 1 | 2, value: string): void {
    setPositives((prev) => {
      const next: [string, string, string] = [prev[0], prev[1], prev[2]];
      next[idx] = value;
      return next;
    });
  }

  async function handleSave(): Promise<void> {
    if (submitting) return;
    setError(null);
    if (!score) {
      setError('Choisis une note du jour.');
      return;
    }
    if (!mainKey || !moduleUserId) {
      setError('Module Mood non configuré ou clé absente — reconnecte-toi.');
      return;
    }
    setSubmitting(true);
    try {
      // Preserve the original date (and any legacy `mood_emoji`) on
      // edit — the user is amending content, not redating. Fresh
      // entries land on today's local date.
      let dateIso: string;
      if (editing) {
        dateIso = editing.payload.date;
      } else {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        dateIso = `${yyyy}-${mm}-${dd}`;
      }
      const trimmedAnswer = answer.trim();
      const payload = {
        date: dateIso,
        mood_score: score,
        mood_emoji: editing?.payload.mood_emoji ?? '',
        positive1: positives[0],
        positive2: positives[1],
        positive3: positives[2],
        comment,
        // Only persist the question/answer pair when there's an
        // actual answer — keeps the schema's optional fields
        // genuinely optional rather than always carrying the
        // question text with an empty answer.
        ...(trimmedAnswer ? { question, answer: trimmedAnswer } : {}),
      };
      if (editing) {
        await moodClient.update(moduleUserId, mainKey, editing.id, payload);
      } else {
        await moodClient.create(moduleUserId, mainKey, payload);
      }
      bumpMoodVersion();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erreur lors de l’enregistrement.',
      );
      setSubmitting(false);
    }
  }

  return (
    <>
    <div className="space-y-3.5 px-[22px] pt-3.5 pb-3">
      <div className="space-y-2">
        <SectionLabel>Trois choses positives aujourd&rsquo;hui</SectionLabel>
        {[0, 1, 2].map((i) => (
          <textarea
            key={i}
            value={positives[i as 0 | 1 | 2]}
            onChange={(e) => setPositive(i as 0 | 1 | 2, e.target.value)}
            onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
            placeholder={POSITIVE_PLACEHOLDERS[i] ?? ''}
            rows={1}
            autoFocus={i === 0}
            className="block w-full resize-none rounded-md border border-hair bg-bg px-3 py-2 text-[13.5px] leading-[1.5] text-ink placeholder:text-muted-soft focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none"
          />
        ))}
      </div>

      <div>
        <SectionLabel>Note du jour</SectionLabel>
        <div className="grid grid-cols-5 gap-1.5">
          {MOOD_SCORE_VALUES.map((value) => {
            const selected = score === value;
            const numeric = Number(value);
            const tone =
              numeric > 0
                ? selected
                  ? 'bg-accent text-white border-accent'
                  : 'bg-bg text-ink-soft border-hair hover:border-accent'
                : numeric < 0
                  ? selected
                    ? 'bg-low text-white border-low'
                    : 'bg-bg text-ink-soft border-hair hover:border-low'
                  : selected
                    ? 'bg-bg-2 text-ink border-ink-soft'
                    : 'bg-bg text-ink-soft border-hair hover:border-ink-soft';
            return (
              <button
                key={value}
                type="button"
                onClick={() => setScore(value)}
                aria-pressed={selected}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-md border px-2 py-1.5 text-[11px] transition-colors',
                  tone,
                )}
              >
                <span className="text-[14px] font-semibold tabular-nums">
                  {numeric > 0 ? `+${value}` : value}
                </span>
                <span className="text-[10px] tracking-[0.02em]">{SCORE_LABELS[value]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOptionalsOpen((v) => !v)}
        className="text-[12px] text-muted transition-colors hover:text-ink"
        aria-expanded={optionalsOpen}
      >
        {optionalsOpen ? '− Replier' : '+ Question du jour & commentaire'}
      </button>

      {optionalsOpen ? (
        <div className="space-y-3 pt-1">
          <div>
            <p className="mb-1 text-[12px] text-muted">
              <span className="font-semibold tracking-[0.02em]">Question du jour : </span>
              <span className="font-serif italic text-ink-soft">
                {question || '—'}
              </span>
            </p>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
              placeholder="Réponse (optionnelle)"
              rows={2}
              className="block w-full resize-none rounded-md border border-hair bg-bg px-3 py-2 text-[13px] leading-[1.5] text-ink placeholder:text-muted-soft focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none"
            />
          </div>

          <div>
            <SectionLabel>Commentaire</SectionLabel>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
              placeholder="Ce qui ne tient pas dans les trois lignes du dessus."
              rows={3}
              className="block w-full resize-none rounded-md border border-hair bg-bg px-3 py-2 text-[13px] leading-[1.5] text-ink placeholder:text-muted-soft focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none"
            />
          </div>
        </div>
      ) : null}
    </div>
    <Footer
      onSubmit={handleSave}
      submitting={submitting}
      error={error}
      submitLabel={isEdit ? 'Mettre à jour' : 'Enregistrer'}
      submittingLabel={isEdit ? 'Mise à jour…' : 'Enregistrement…'}
    />
    </>
  );
}

function isMoodScoreString(s: string | undefined): s is MoodScore {
  return s === '-2' || s === '-1' || s === '0' || s === '1' || s === '2';
}

const POSITIVE_PLACEHOLDERS: ReadonlyArray<string> = [
  'Un premier moment qui a tenu la journée debout.',
  'Un deuxième — plus discret peut-être.',
  'Un troisième — même tout petit.',
];

type GoalStatus = 'open' | 'wip' | 'done';

const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  open: 'Ouvert',
  wip: 'En cours',
  done: 'Terminé',
};

const GOAL_STATUS_ACTIVE_TONE: Record<GoalStatus, string> = {
  open: 'border-ink-soft bg-bg-2 font-semibold text-ink',
  wip: 'border-accent-soft bg-accent-soft font-semibold text-accent-deep',
  done: 'border-accent bg-accent font-semibold text-white',
};

interface GoalBodyProps {
  onClose: () => void;
}

/**
 * Goal entry form — matches the legacy `Form.jsx` field set: title
 * (required), date (`YYYY-MM` via paired month + year `<select>`s
 * because Firefox / Safari macOS render `<input type="month">` as
 * a plain text input, hiding the picker entirely), status
 * (3-segment Ouvert / En cours / Terminé), thread (free text;
 * autocomplete deferred), note (optional textarea).
 *
 * Branches between **create** and **update** based on
 * `composer.editing`: a row's pencil icon on the Goals page calls
 * `openComposer('goal', { type, id, payload })`, which prefills
 * this form. Both branches `bumpGoalsVersion()` so the Goals page
 * refetches and the row updates / appears without a reload.
 */
function GoalBody({ onClose }: GoalBodyProps) {
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const moduleUserId = modules['goals']?.moduleUserId ?? null;
  const bumpGoalsVersion = useNodeaStore((s) => s.bumpGoalsVersion);
  const editing = useNodeaStore((s) =>
    s.composer.editing && s.composer.editing.type === 'goal'
      ? s.composer.editing
      : null,
  );

  // Prefill from the editing payload at mount, fall back to empty.
  // Date is split into year + month for the paired selects; an
  // existing `YYYY-MM` value seeds both.
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = editing !== null;

  function composeDate(y: string, m: string): string {
    // Year + month → `YYYY-MM`. Year alone → bare `YYYY` (a goal
    // dated to a year without a specific month is a real
    // intention, not garbage; the Goals page's `formatDate`
    // tolerates the bare-year shape via its regex fallback).
    // Month without a year drops to empty — a month with no year
    // can't be ordered or formatted unambiguously.
    if (y && m) return `${y}-${m}`;
    if (y) return y;
    return '';
  }

  async function handleSave(): Promise<void> {
    if (submitting) return;
    setError(null);
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Le titre est requis.');
      return;
    }
    if (!mainKey || !moduleUserId) {
      setError('Module Goals non configuré ou clé absente — reconnecte-toi.');
      return;
    }
    if (year && !/^\d{4}$/.test(year)) {
      setError('L’année doit être un nombre à 4 chiffres.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        date: composeDate(year, month),
        title: trimmedTitle,
        note,
        status,
        thread: thread.trim(),
      };
      if (editing) {
        await goalsClient.update(moduleUserId, mainKey, editing.id, payload);
      } else {
        await goalsClient.create(moduleUserId, mainKey, payload);
      }
      bumpGoalsVersion();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erreur lors de l’enregistrement.',
      );
      setSubmitting(false);
    }
  }

  return (
    <>
    <div className="space-y-3 px-[22px] pt-3.5 pb-3">
      <input
        autoFocus
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
        placeholder="Titre — ex. Lancer un blog"
        disabled={submitting}
        className="block h-9 w-full rounded-md border border-hair bg-bg px-3 text-[14.5px] font-medium text-ink placeholder:text-muted-soft focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none disabled:opacity-60"
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[200px_1fr]">
        <div className="grid grid-cols-2 gap-1.5">
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            aria-label="Mois"
            disabled={submitting}
            className="block h-8 w-full cursor-pointer rounded-md border border-hair bg-bg px-2 text-[12.5px] text-ink focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none disabled:opacity-60"
          >
            <option value="">— mois —</option>
            {MONTH_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            inputMode="numeric"
            value={year}
            onChange={(e) => {
              // Strip non-digits live and cap at 4 chars so the
              // input never holds anything but a partial / complete
              // 4-digit year.
              const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
              setYear(digits);
            }}
            onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
            placeholder="Année"
            maxLength={4}
            aria-label="Année (4 chiffres)"
            disabled={submitting}
            className="block h-8 w-full rounded-md border border-hair bg-bg px-2 text-center text-[12.5px] tabular-nums text-ink placeholder:text-muted-soft focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none disabled:opacity-60"
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
                  'h-8 cursor-pointer rounded-md border text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                  active
                    ? GOAL_STATUS_ACTIVE_TONE[s]
                    : 'border-hair bg-bg text-muted hover:border-ink-soft hover:text-ink',
                )}
              >
                {GOAL_STATUS_LABEL[s]}
              </button>
            );
          })}
        </div>
      </div>

      <input
        type="text"
        value={thread}
        onChange={(e) => setThread(e.target.value)}
        onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
        placeholder="Threads (optionnel) — séparés par une virgule, ex. #DéménagementLyon, #Solo"
        disabled={submitting}
        className="block h-8 w-full rounded-md border border-hair bg-bg px-3 text-[13px] text-ink placeholder:text-muted-soft focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none disabled:opacity-60"
      />

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
        placeholder="Note (optionnelle) — détails, contexte, échéance précise…"
        rows={3}
        disabled={submitting}
        className="block w-full resize-none rounded-md border border-hair bg-bg px-3 py-2 text-[13px] leading-[1.5] text-ink placeholder:text-muted-soft focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none disabled:opacity-60"
      />
    </div>
    <Footer
      onSubmit={handleSave}
      submitting={submitting}
      error={error}
      submitLabel={isEdit ? 'Mettre à jour' : 'Enregistrer'}
      submittingLabel={isEdit ? 'Mise à jour…' : 'Enregistrement…'}
    />
    </>
  );
}

function isCanonicalGoalStatus(s: string | undefined): s is GoalStatus {
  return s === 'open' || s === 'wip' || s === 'done';
}

interface JournalBodyProps {
  onClose: () => void;
}

/**
 * Journal entry form — uses the legacy passage shape under the new
 * "Journal" module: thread (required, single-valued — no comma
 * multi anymore), content (required, the heart of the entry, with
 * lightweight Markdown formatting).
 *
 * Title was dropped: now that thread is mandatory, every entry is
 * already filed under a fil. A title on top of that became
 * redundant noise — the K Journal page surfaces date + content
 * directly inside the thread group.
 *
 * Backed by `passageClient` since the `passage_entries` table is
 * the journal-shaped one — the K Passages module (book quotes)
 * gets its own future schema.
 *
 * Branches between **create** and **update** based on
 * `composer.editing`: the Journal page's pencil icon prefills via
 * `openComposer('journal', { type, id, payload })`. Both branches
 * `bumpJournalVersion()` so the page refetches without a reload.
 *
 * Date is preserved on edit (the user is amending content, not
 * redating); fresh entries land on `new Date().toISOString()`.
 */
function JournalBody({ onClose }: JournalBodyProps) {
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const moduleUserId = modules['journal']?.moduleUserId ?? null;
  const bumpJournalVersion = useNodeaStore((s) => s.bumpJournalVersion);
  const editing = useNodeaStore((s) =>
    s.composer.editing && s.composer.editing.type === 'journal'
      ? s.composer.editing
      : null,
  );

  const [thread, setThread] = useState(editing?.payload.thread ?? '');
  const [content, setContent] = useState(editing?.payload.content ?? '');
  const [threadOptions, setThreadOptions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Visual mode is the Word-like contentEditable surface (default
  // for non-technical users); Markdown mode shows the raw source for
  // anyone who'd rather type `**foo**` directly. Storage stays
  // Markdown either way — `MarkdownEditor` handles the round trip.
  const [editorMode, setEditorMode] = useState<'visual' | 'markdown'>('visual');

  const isEdit = editing !== null;

  // Pull existing threads once on mount so the input can offer them
  // as suggestions. Existing entries that pre-date the
  // single-thread switch may still hold a comma-separated value;
  // we split them out so each fil shows up individually in the
  // dropdown. Failures are swallowed — the dropdown simply stays
  // empty rather than showing an error inside the form.
  useEffect(() => {
    if (!mainKey || !moduleUserId) return undefined;
    let cancelled = false;
    passageClient
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
        setThreadOptions(
          Array.from(set).sort((a, b) => a.localeCompare(b, 'fr')),
        );
      })
      .catch(() => {
        if (cancelled) return;
        setThreadOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [mainKey, moduleUserId]);

  async function handleSave(): Promise<void> {
    if (submitting) return;
    setError(null);
    const trimmedThread = thread.trim();
    const trimmedContent = content.trim();
    if (!trimmedThread) {
      setError('Le fil est requis — choisis-en un existant ou crée-en un nouveau.');
      return;
    }
    if (!trimmedContent) {
      setError('Le contenu est requis.');
      return;
    }
    if (!mainKey || !moduleUserId) {
      setError('Module Journal non configuré ou clé absente — reconnecte-toi.');
      return;
    }
    setSubmitting(true);
    try {
      const dateIso = editing ? editing.payload.date : new Date().toISOString();
      const payload = {
        type: 'passage.entry' as const,
        date: dateIso,
        thread: trimmedThread,
        title: null,
        content: trimmedContent,
      };
      if (editing) {
        await passageClient.update(moduleUserId, mainKey, editing.id, payload);
      } else {
        await passageClient.create(moduleUserId, mainKey, payload);
      }
      bumpJournalVersion();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erreur lors de l’enregistrement.',
      );
      setSubmitting(false);
    }
  }

  return (
    <>
    <div className="space-y-3 px-[22px] pt-3.5 pb-3">
      <ThreadSuggestInput
        value={thread}
        onChange={setThread}
        options={threadOptions}
        disabled={submitting}
        onSubmit={handleSave}
      />

      <MarkdownEditor
        value={content}
        onChange={setContent}
        onSubmit={handleSave}
        disabled={submitting}
        mode={editorMode}
        onModeChange={setEditorMode}
      />
    </div>
    <Footer
      onSubmit={handleSave}
      submitting={submitting}
      error={error}
      submitLabel={isEdit ? 'Mettre à jour' : 'Enregistrer'}
      submittingLabel={isEdit ? 'Mise à jour…' : 'Enregistrement…'}
    />
    </>
  );
}

interface MarkdownToggleProps {
  value: boolean;
  onChange: (next: boolean) => void;
}

/**
 * Pill toggle that flips the Journal editor between visual (Word-
 * like contentEditable, default) and Markdown source view. Sits in
 * the Composer footer so the editor surface stays uncluttered.
 * Pressed = Markdown source view; unpressed = visual edit.
 */
function MarkdownToggle({ value, onChange }: MarkdownToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      title={value ? 'Repasser en édition visuelle' : 'Voir la source Markdown'}
      className={cn(
        'cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
        value
          ? 'bg-accent-soft text-accent-deep'
          : 'text-muted hover:bg-bg-2 hover:text-ink',
      )}
    >
      Markdown
    </button>
  );
}

/* ===============================================================
 * Library — Item & Review bodies
 * =============================================================== */

const LIBRARY_STATUS_LABEL: Record<LibraryStatus, string> = {
  planned: 'À lire',
  in_progress: 'En cours',
  finished: 'Terminé',
  abandoned: 'Abandonné',
};

const LIBRARY_FORMAT_LABEL: Record<LibraryFormat, string> = {
  paper: 'Papier',
  ebook: 'eBook',
  audio: 'Audio',
  unknown: '—',
};

const LIBRARY_REVIEW_KIND_LABEL: Record<LibraryReviewKind, string> = {
  quote: 'Extrait',
  note: 'Note',
};

interface LibraryItemBodyProps {
  onClose: () => void;
}

/**
 * Library item form — manual entry only at this stage (Phase 1).
 * Phase 2 will add an "ISBN / titre" lookup that prefills via the
 * `/library/lookup` proxy.
 *
 * Author convention: when typing an author manually, the form
 * normalises on save to `<Prénom> <NOM en MAJUSCULES>` per the
 * decision documented in Library.md §3.1.
 */
function LibraryItemBody({ onClose }: LibraryItemBodyProps) {
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const moduleUserId = modules['library']?.moduleUserId ?? null;
  const bumpItemsVersion = useNodeaStore((s) => s.bumpLibraryItemsVersion);
  const editing = useNodeaStore((s) =>
    s.composer.editing && s.composer.editing.type === 'library-item'
      ? s.composer.editing
      : null,
  );

  const editingPayload = editing?.payload;
  const editingCreatorName = editingPayload?.creators?.[0]?.name ?? '';
  const editingIsbn =
    editingPayload?.providers?.isbn13 ?? editingPayload?.providers?.isbn10 ?? '';

  const [title, setTitle] = useState(editingPayload?.title ?? '');
  const [author, setAuthor] = useState(editingCreatorName);
  const [isbn, setIsbn] = useState(editingIsbn);
  const [year, setYear] = useState(
    editingPayload?.year ? String(editingPayload.year) : '',
  );
  const [publisher, setPublisher] = useState(editingPayload?.publisher ?? '');
  const [collection, setCollection] = useState(editingPayload?.collection ?? '');
  const [seriesName, setSeriesName] = useState(editingPayload?.series?.name ?? '');
  const [seriesPosition, setSeriesPosition] = useState(
    editingPayload?.series?.position ? String(editingPayload.series.position) : '',
  );
  const [summary, setSummary] = useState(editingPayload?.summary ?? '');
  const [status, setStatus] = useState<LibraryStatus>(editingPayload?.status ?? 'planned');
  const [format, setFormat] = useState<LibraryFormat>(editingPayload?.format ?? 'unknown');
  const [tagsInput, setTagsInput] = useState((editingPayload?.tags ?? []).join(', '));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lookup state — only relevant on creation (the search bar is
  // hidden on edit since the user presumably knows their own data).
  const [searchInput, setSearchInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<NormalisedBook[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  const isEdit = editing !== null;

  /**
   * Run a metadata lookup. ISBN-shaped input goes through the
   * dedicated by-isbn endpoint (one merged result); anything else
   * goes through by-query and returns up to 15 candidates.
   */
  async function runSearch(): Promise<void> {
    const q = searchInput.trim();
    if (!q) return;
    setSearchError(null);
    setSearching(true);
    setSearchOpen(true);
    try {
      const stripped = q.replace(/[\s-]/g, '');
      const isPossibleIsbn = /^\d{10}$|^\d{13}$|^\d{9}[\dX]$/i.test(stripped);
      // Hard-coded to `fr` for now: Nodea is French-first, and an
      // English-locale browser reaching this page would otherwise
      // make GB / Amazon return amazon.com / English-only editions
      // that don't match the user's actual library. To revisit
      // when a per-user `library.searchLanguage` preference lands.
      const lang = 'fr';
      const response = isPossibleIsbn
        ? await apiLibraryLookupByIsbn({ isbn: stripped })
        : await apiLibraryLookupByQuery({ q, lang });
      setSearchResults(response.results);
      if (response.results.length === 0) {
        setSearchError('Aucun résultat. Tu peux saisir manuellement.');
      }
    } catch (err) {
      if (isApiError(err) && err.status === 429) {
        setSearchError('Trop de recherches récentes — patiente une minute.');
      } else {
        setSearchError('Recherche indisponible. Tu peux saisir manuellement.');
        if (import.meta.env.DEV) console.warn('library lookup failed', err);
      }
    } finally {
      setSearching(false);
    }
  }

  function applyResult(book: NormalisedBook): void {
    setTitle(book.title);
    if (book.creators[0]?.name) setAuthor(book.creators[0].name);
    if (book.year) setYear(String(book.year));
    if (book.publisher) setPublisher(book.publisher);
    if (book.collection) setCollection(book.collection);
    if (book.summary) setSummary(book.summary);
    if (book.series) {
      setSeriesName(book.series.name);
      if (book.series.position) setSeriesPosition(String(book.series.position));
    }
    if (book.format) setFormat(book.format);
    if (book.isbn13) setIsbn(book.isbn13);
    else if (book.isbn10) setIsbn(book.isbn10);
    setSearchOpen(false);
    setSearchResults([]);
    setSearchInput('');
  }

  function dismissSearch(): void {
    setSearchOpen(false);
    setSearchResults([]);
    setSearchError(null);
  }

  async function handleSave(): Promise<void> {
    if (submitting) return;
    setError(null);
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Le titre est requis.');
      return;
    }
    if (!mainKey || !moduleUserId) {
      setError('Module Library non configuré ou clé absente — reconnecte-toi.');
      return;
    }
    if (year && !/^\d{4}$/.test(year)) {
      setError('L’année doit être un nombre à 4 chiffres.');
      return;
    }
    setSubmitting(true);
    try {
      const trimmedAuthor = author.trim();
      const normalisedAuthor = trimmedAuthor ? normaliseAuthorName(trimmedAuthor) : '';
      const isbnTrimmed = isbn.replace(/[\s-]/g, '');
      const providers: Record<string, string> = {};
      if (isbnTrimmed.length === 13) providers.isbn13 = isbnTrimmed;
      else if (isbnTrimmed.length === 10) providers.isbn10 = isbnTrimmed;

      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const basePayload = editingPayload ?? null;
      const payload = {
        // Schema defaults are not applied by zod on the input side
        // (they're "fill-in-on-parse"), so the create/update typing
        // requires every nullable field to be explicitly present.
        // We seed with sensible defaults, then let the editing
        // payload override what the user already had.
        type: 'book' as const,
        title: trimmedTitle,
        creators: normalisedAuthor
          ? [{ name: normalisedAuthor, role: 'author' }]
          : [],
        cover_rid: basePayload?.cover_rid ?? null,
        status,
        format,
        started_at: basePayload?.started_at ?? null,
        finished_at: basePayload?.finished_at ?? null,
        current_page: basePayload?.current_page ?? null,
        rating: basePayload?.rating ?? null,
        is_favorite: basePayload?.is_favorite ?? false,
        tags,
        ...(Object.keys(providers).length > 0
          ? { providers }
          : basePayload?.providers
            ? { providers: basePayload.providers }
            : {}),
        ...(year ? { year: Number(year) } : {}),
        ...(publisher.trim() ? { publisher: publisher.trim() } : {}),
        ...(collection.trim() ? { collection: collection.trim() } : {}),
        ...(summary.trim() ? { summary: summary.trim() } : {}),
        ...(seriesName.trim()
          ? {
              series: {
                name: seriesName.trim(),
                ...(seriesPosition && /^\d+$/.test(seriesPosition)
                  ? { position: Number(seriesPosition) }
                  : {}),
              },
            }
          : {}),
      };
      if (editing) {
        await libraryItemsClient.update(moduleUserId, mainKey, editing.id, payload);
      } else {
        await libraryItemsClient.create(moduleUserId, mainKey, payload);
      }
      bumpItemsVersion();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erreur lors de l’enregistrement.',
      );
      setSubmitting(false);
    }
  }

  // The form fields hide *only when actual results are displayed* —
  // not while a search is loading. This avoids the
  // "form → empty → results → form" shrink/grow flicker the user
  // sees during the few hundred ms of round-trip latency. While
  // loading, the form stays visible and the LookupBar shows its
  // own inline "…" indicator.
  const showFormFields = isEdit || !searchOpen || searchResults.length === 0;

  return (
    <>
    {/* Fixed height so the modal NEVER resizes between form / loading
        / results states (a `min-h` + natural-content combo still let
        the body grow when results > form). `max-h` clamps for small
        viewports — when the screen is short, the body shrinks below
        600 px and the inner `<ul>` scrolls. The 200 px envelope
        accounts for the type picker, footer, and the modal's top
        offset (`pt-[12vh]`). */}
    <div className="flex h-[600px] max-h-[calc(100vh-200px)] flex-col space-y-3 px-[22px] pt-3.5 pb-3">
      {!isEdit ? (
        <LookupBar
          value={searchInput}
          onChange={setSearchInput}
          onSearch={runSearch}
          searching={searching}
          error={searchError}
          results={searchResults}
          open={searchOpen}
          onApply={applyResult}
          onDismiss={dismissSearch}
          disabled={submitting}
        />
      ) : null}

      {showFormFields ? (
      <>
      <input
        autoFocus={isEdit}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
        placeholder="Titre — ex. Les Misérables"
        disabled={submitting}
        className="block h-9 w-full rounded-md border border-hair bg-bg px-3 text-[14.5px] font-medium text-ink placeholder:text-muted-soft focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none disabled:opacity-60"
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px]">
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
          placeholder="Auteur·rice — ex. Victor Hugo"
          disabled={submitting}
          className="block h-8 w-full rounded-md border border-hair bg-bg px-3 text-[13px] text-ink placeholder:text-muted-soft focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none disabled:opacity-60"
        />
        <input
          type="text"
          inputMode="numeric"
          value={year}
          onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
          onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
          placeholder="Année"
          maxLength={4}
          disabled={submitting}
          className="block h-8 w-full rounded-md border border-hair bg-bg px-3 text-center text-[13px] tabular-nums text-ink placeholder:text-muted-soft focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none disabled:opacity-60"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr]">
        <input
          type="text"
          value={isbn}
          onChange={(e) => setIsbn(e.target.value)}
          onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
          placeholder="ISBN (optionnel)"
          disabled={submitting}
          className="block h-8 w-full rounded-md border border-hair bg-bg px-3 text-[13px] tabular-nums text-ink placeholder:text-muted-soft focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none disabled:opacity-60"
        />
        <input
          type="text"
          value={publisher}
          onChange={(e) => setPublisher(e.target.value)}
          onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
          placeholder="Éditeur (optionnel)"
          disabled={submitting}
          className="block h-8 w-full rounded-md border border-hair bg-bg px-3 text-[13px] text-ink placeholder:text-muted-soft focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none disabled:opacity-60"
        />
      </div>

      <input
        type="text"
        value={collection}
        onChange={(e) => setCollection(e.target.value)}
        onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
        placeholder="Collection (optionnel) — ex. Folio classique, Babel"
        disabled={submitting}
        className="block h-8 w-full rounded-md border border-hair bg-bg px-3 text-[13px] text-ink placeholder:text-muted-soft focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none disabled:opacity-60"
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px]">
        <input
          type="text"
          value={seriesName}
          onChange={(e) => setSeriesName(e.target.value)}
          onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
          placeholder="Série (optionnel) — ex. Le Seigneur des Anneaux"
          disabled={submitting}
          className="block h-8 w-full rounded-md border border-hair bg-bg px-3 text-[13px] text-ink placeholder:text-muted-soft focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none disabled:opacity-60"
        />
        <input
          type="text"
          inputMode="numeric"
          value={seriesPosition}
          onChange={(e) =>
            setSeriesPosition(e.target.value.replace(/\D/g, '').slice(0, 3))
          }
          onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
          placeholder="Tome n°"
          disabled={submitting}
          className="block h-8 w-full rounded-md border border-hair bg-bg px-3 text-center text-[13px] tabular-nums text-ink placeholder:text-muted-soft focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none disabled:opacity-60"
        />
      </div>

      <textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
        placeholder="4ᵉ de couverture — généralement préremplie via la recherche."
        rows={3}
        disabled={submitting}
        className="block min-h-[72px] w-full resize-none rounded-md border border-hair bg-bg px-3 py-2 text-[13px] leading-[1.5] text-ink placeholder:text-muted-soft focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none disabled:opacity-60"
      />

      <div>
        <SectionLabel>Statut</SectionLabel>
        <div className="grid grid-cols-4 gap-1.5">
          {LIBRARY_STATUS_VALUES.map((s) => {
            const active = status === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                aria-pressed={active}
                disabled={submitting}
                className={cn(
                  'h-8 cursor-pointer rounded-md border text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                  active
                    ? 'border-accent bg-accent font-semibold text-white'
                    : 'border-hair bg-bg text-muted hover:border-ink-soft hover:text-ink',
                )}
              >
                {LIBRARY_STATUS_LABEL[s]}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <SectionLabel>Format</SectionLabel>
        <div className="grid grid-cols-4 gap-1.5">
          {LIBRARY_FORMAT_VALUES.map((f) => {
            const active = format === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                aria-pressed={active}
                disabled={submitting}
                className={cn(
                  'h-8 cursor-pointer rounded-md border text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                  active
                    ? 'border-accent-soft bg-accent-soft font-semibold text-accent-deep'
                    : 'border-hair bg-bg text-muted hover:border-ink-soft hover:text-ink',
                )}
              >
                {LIBRARY_FORMAT_LABEL[f]}
              </button>
            );
          })}
        </div>
      </div>

      <input
        type="text"
        value={tagsInput}
        onChange={(e) => setTagsInput(e.target.value)}
        onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
        placeholder="Tags (optionnel) — séparés par une virgule, ex. classique, à offrir"
        disabled={submitting}
        className="block h-8 w-full rounded-md border border-hair bg-bg px-3 text-[13px] text-ink placeholder:text-muted-soft focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none disabled:opacity-60"
      />
      </>
      ) : null}
    </div>
    <Footer
      onSubmit={handleSave}
      submitting={submitting}
      error={error}
      submitLabel={isEdit ? 'Mettre à jour' : 'Ajouter à ma bibliothèque'}
      submittingLabel={isEdit ? 'Mise à jour…' : 'Enregistrement…'}
    />
    </>
  );
}

/**
 * Normalise an author name to `<Prénom> <NOM en MAJUSCULES>`.
 *
 * Heuristic: split on whitespace, take the **last token** as the
 * lastname, uppercase it, and prefix with the rest. Detects the
 * Babelio convention (`<Lastname> <Firstname>`) when the *first*
 * token is already uppercase or matches a "lastname-shaped" word
 * — but otherwise assumes the user typed naturally.
 *
 * Edge cases (compound surnames "Saint-Exupéry", "La Boétie",
 * patronyms with particles) get the simple heuristic and may need
 * manual fix in the import preview — documented in Library.md §5.1.
 */
function normaliseAuthorName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) return trimmed;
  const tokens = trimmed.split(' ');
  if (tokens.length === 1) return tokens[0]!.toLocaleUpperCase('fr');
  // Heuristic: if the first token is already in MAJUSCULES, the user
  // probably typed "HUGO Victor" — flip.
  const first = tokens[0]!;
  if (first === first.toLocaleUpperCase('fr') && first !== first.toLocaleLowerCase('fr')) {
    const rest = tokens.slice(1).join(' ');
    return `${rest} ${first}`;
  }
  // Default: last token = lastname → uppercase
  const last = tokens[tokens.length - 1]!;
  const rest = tokens.slice(0, -1).join(' ');
  return `${rest} ${last.toLocaleUpperCase('fr')}`;
}

interface LookupBarProps {
  value: string;
  onChange: (next: string) => void;
  onSearch: () => void | Promise<void>;
  searching: boolean;
  error: string | null;
  results: NormalisedBook[];
  open: boolean;
  onApply: (book: NormalisedBook) => void;
  onDismiss: () => void;
  disabled: boolean;
}

const PROVIDER_LABEL: Record<NormalisedBook['source'], string> = {
  openlibrary: 'OL',
  googlebooks: 'GB',
  bnf: 'BNF',
  wikidata: 'WD',
  bne: 'BNE',
  amazon: 'Amz',
};

const PROVIDER_ORDER: ReadonlyArray<NormalisedBook['source']> = [
  'openlibrary',
  'googlebooks',
  'bnf',
  'wikidata',
  'bne',
  'amazon',
];

interface ProviderBadgesProps {
  /** The provider whose record won the merge (got top billing). */
  primarySource: NormalisedBook['source'];
  /** Every provider that contributed to the merged record. */
  providers: NormalisedBook['providers'];
}

/**
 * Render a small row of provider badges for a deduped result —
 * the merge in the dispatcher accumulates `providers` across
 * every contributor, so on a popular book like a Werber novel
 * a row might show `OL · GB · Amz` even though a single
 * `book.source` field only points to one of them. The primary
 * source gets the accent-coloured badge, the rest stay muted.
 */
function ProviderBadges({ primarySource, providers }: ProviderBadgesProps) {
  // Use the canonical provider order so the badge row is stable
  // across re-renders (Object.keys order varies by JS engine on
  // some edge cases).
  const contributing = PROVIDER_ORDER.filter(
    (p) => providers[p as keyof NormalisedBook['providers']],
  );
  const list = contributing.length > 0 ? contributing : [primarySource];
  return (
    <span className="ml-1.5 flex shrink-0 items-center gap-0.5">
      {list.map((p) => (
        <span
          key={p}
          className={cn(
            'inline-flex h-5 items-center rounded px-1.5 text-[10px] font-semibold tracking-[0.04em]',
            p === primarySource
              ? 'bg-accent-soft text-accent-deep'
              : 'bg-bg-2 text-muted',
          )}
        >
          {PROVIDER_LABEL[p]}
        </span>
      ))}
    </span>
  );
}

const FORMAT_LABEL: Record<NonNullable<NormalisedBook['format']>, string> = {
  paper: 'Papier',
  ebook: 'eBook',
  audio: 'Audio',
};

/**
 * Single search bar at the top of the create form. Detects ISBN
 * automatically (10/13 digits) and routes through the right
 * lookup endpoint. Results render inline below the bar; clicking
 * one prefills the rest of the form.
 *
 * Privacy reminder for the user: the search query is sent to the
 * Nodea server, which proxies the providers — see Library.md §4.
 */
function LookupBar({
  value,
  onChange,
  onSearch,
  searching,
  error,
  results,
  open,
  onApply,
  onDismiss,
  disabled,
}: LookupBarProps) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      void onSearch();
    } else if (e.key === 'Escape') {
      onDismiss();
    }
  }

  const expanded = open && results.length > 0;

  return (
    <div
      className={cn(
        'rounded-md border border-hair bg-bg-2/60 p-2.5',
        // When results are showing, the bar grows to fill the
        // remaining space in the modal so the list can stretch all
        // the way down — keeps the modal-tall layout filled
        // instead of a white gap below the results card.
        expanded ? 'flex min-h-0 flex-1 flex-col' : '',
      )}
    >
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Rechercher par titre, auteur·rice ou ISBN…"
          disabled={disabled}
          className="block h-8 w-full rounded-md border border-hair bg-bg px-3 text-[13px] text-ink placeholder:text-muted-soft focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => void onSearch()}
          disabled={disabled || searching || value.trim().length < 2}
          className="cursor-pointer shrink-0 rounded-md bg-accent px-3 text-[12px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-accent-deep active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
        >
          {searching ? '…' : 'Chercher'}
        </button>
        {open ? (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Fermer les résultats"
            title="Fermer (Esc)"
            className="cursor-pointer shrink-0 rounded-md border border-hair bg-bg px-2 text-[12px] text-muted transition-colors hover:bg-bg-2 hover:text-ink"
          >
            ✕
          </button>
        ) : null}
      </div>
      {error ? (
        <p
          role="alert"
          className="mt-1.5 text-[11px] text-ink-soft"
        >
          {error}
        </p>
      ) : null}
      {open && results.length > 0 ? (
        <ul className="mt-2 min-h-0 flex-1 overflow-auto rounded-md border border-hair bg-bg">
          {results.map((book, i) => {
            const isbn = book.isbn13 ?? book.isbn10;
            const formatLabel = book.format ? FORMAT_LABEL[book.format] : null;
            const seriesLabel = book.series
              ? book.series.position
                ? `${book.series.name}, t. ${book.series.position}`
                : book.series.name
              : null;
            return (
              <li
                key={`${book.source}-${book.title}-${i}`}
                className="border-b border-hair last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() => onApply(book)}
                  className="flex w-full cursor-pointer items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-bg-2"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[13px] font-medium text-ink">
                      {book.title}
                    </span>
                    <span className="truncate text-[11px] text-muted">
                      {book.creators[0]?.name ?? '—'}
                      {book.year ? <span className="ml-1.5 tabular-nums">· {book.year}</span> : null}
                      {book.publisher ? <span className="ml-1.5">· {book.publisher}</span> : null}
                      {book.collection ? <span className="ml-1.5">· {book.collection}</span> : null}
                    </span>
                    {(isbn || formatLabel || seriesLabel) ? (
                      <span className="flex flex-wrap items-center gap-x-1.5 text-[10.5px] text-muted-soft">
                        {isbn ? <span className="tabular-nums">{isbn}</span> : null}
                        {formatLabel ? (
                          <span className="rounded bg-bg-2 px-1 py-px font-medium text-ink-soft">
                            {formatLabel}
                          </span>
                        ) : null}
                        {seriesLabel ? <span className="italic">· {seriesLabel}</span> : null}
                      </span>
                    ) : null}
                  </span>
                  <ProviderBadges
                    primarySource={book.source}
                    providers={book.providers}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

interface LibraryReviewBodyProps {
  onClose: () => void;
}

/**
 * Library review form — a note or extract attached to an item.
 * Reuses the Journal MarkdownEditor (visual mode + Markdown source
 * toggle) so the writing experience matches the rest of the app.
 *
 * `kind` distinguishes a `quote` (extract from the book, often with
 * a page number) from a `note` (in-progress reflection or fiche-
 * bilan). The detail page renders them differently.
 *
 * The review *requires* a parent item — the page passes the item id
 * via `composer.editing.payload.item_rid` even on creation
 * (otherwise we'd have a dangling review).
 */
function LibraryReviewBody({ onClose }: LibraryReviewBodyProps) {
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const moduleUserId = modules['library']?.moduleUserId ?? null;
  const bumpReviewsVersion = useNodeaStore((s) => s.bumpLibraryReviewsVersion);
  const editing = useNodeaStore((s) =>
    s.composer.editing && s.composer.editing.type === 'library-review'
      ? s.composer.editing
      : null,
  );

  const editingPayload = editing?.payload;
  const itemRid = editingPayload?.item_rid ?? '';
  const isEditExisting = editing !== null && (editing.id?.length ?? 0) > 0;

  const [kind, setKind] = useState<LibraryReviewKind>(editingPayload?.kind ?? 'note');
  const [page, setPage] = useState(editingPayload?.page ? String(editingPayload.page) : '');
  const [content, setContent] = useState(editingPayload?.content ?? '');
  const [editorMode, setEditorMode] = useState<'visual' | 'markdown'>('visual');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(): Promise<void> {
    if (submitting) return;
    setError(null);
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      setError('Le contenu est requis.');
      return;
    }
    if (!itemRid) {
      setError('Aucun livre rattaché — ouvre la review depuis la page du livre.');
      return;
    }
    if (!mainKey || !moduleUserId) {
      setError('Module Library non configuré ou clé absente — reconnecte-toi.');
      return;
    }
    setSubmitting(true);
    try {
      const dateIso = isEditExisting
        ? (editingPayload?.date ?? new Date().toISOString())
        : new Date().toISOString();
      const payload = {
        item_rid: itemRid,
        date: dateIso,
        kind,
        title: null,
        content: trimmedContent,
        page: page ? Number(page) : null,
        spoiler: editingPayload?.spoiler ?? false,
      };
      if (isEditExisting && editing) {
        await libraryReviewsClient.update(moduleUserId, mainKey, editing.id, payload);
      } else {
        await libraryReviewsClient.create(moduleUserId, mainKey, payload);
      }
      bumpReviewsVersion();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erreur lors de l’enregistrement.',
      );
      setSubmitting(false);
    }
  }

  return (
    <>
    <div className="space-y-3 px-[22px] pt-3.5 pb-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px]">
        <div className="grid grid-cols-2 gap-1.5">
          {LIBRARY_REVIEW_KIND_VALUES.map((k) => {
            const active = kind === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={active}
                disabled={submitting}
                className={cn(
                  'h-8 cursor-pointer rounded-md border text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                  active
                    ? 'border-accent bg-accent font-semibold text-white'
                    : 'border-hair bg-bg text-muted hover:border-ink-soft hover:text-ink',
                )}
              >
                {LIBRARY_REVIEW_KIND_LABEL[k]}
              </button>
            );
          })}
        </div>
        <input
          type="text"
          inputMode="numeric"
          value={page}
          onChange={(e) => setPage(e.target.value.replace(/\D/g, '').slice(0, 5))}
          onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
          placeholder="Page"
          disabled={submitting}
          className="block h-8 w-full rounded-md border border-hair bg-bg px-3 text-center text-[13px] tabular-nums text-ink placeholder:text-muted-soft focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none disabled:opacity-60"
        />
      </div>

      <MarkdownEditor
        value={content}
        onChange={setContent}
        onSubmit={handleSave}
        disabled={submitting}
        mode={editorMode}
        onModeChange={setEditorMode}
      />
    </div>
    <Footer
      onSubmit={handleSave}
      submitting={submitting}
      error={error}
      submitLabel={isEditExisting ? 'Mettre à jour' : 'Enregistrer'}
      submittingLabel={isEditExisting ? 'Mise à jour…' : 'Enregistrement…'}
    />
    </>
  );
}

interface ThreadSuggestInputProps {
  value: string;
  onChange: (next: string) => void;
  options: ReadonlyArray<string>;
  disabled?: boolean;
  onSubmit: () => void;
}

/**
 * Free-text thread input with dropdown suggestions drawn from the
 * user's existing threads. Mirrors the legacy `SuggestInput` pattern
 * used by the old Passage form: type to filter, pick from the
 * dropdown to commit a known fil, or just keep typing to create a
 * new one.
 *
 * Single-valued: an entry belongs to exactly one thread. Pre-existing
 * comma-separated values from earlier iterations are still loaded for
 * the suggestion source but are not produced by this input.
 */
function ThreadSuggestInput({
  value,
  onChange,
  options,
  disabled,
  onSubmit,
}: ThreadSuggestInputProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const trimmed = value.trim();

  const suggestions = useMemo<string[]>(() => {
    const needle = trimmed.toLocaleLowerCase('fr');
    const list: string[] = [];
    for (const opt of options) {
      if (needle && !opt.toLocaleLowerCase('fr').includes(needle)) continue;
      // Hide exact-match-only options (the user already typed the
      // whole thread name — nothing left to suggest).
      if (opt.toLocaleLowerCase('fr') === needle) continue;
      list.push(opt);
      if (list.length >= 8) break;
    }
    return list;
  }, [options, trimmed]);

  // Clamp the highlight when the suggestion list shrinks under it.
  useEffect(() => {
    if (highlight >= suggestions.length) setHighlight(0);
  }, [suggestions.length, highlight]);

  // Click-outside closes the dropdown — Headless UI's outer Dialog
  // already swallows global Esc, so we don't redundantly listen.
  useEffect(() => {
    if (!open) return undefined;
    function onDocPointerDown(e: PointerEvent) {
      if (!containerRef.current) return;
      if (!(e.target instanceof Node)) return;
      if (!containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, [open]);

  function pick(option: string): void {
    onChange(option);
    setOpen(false);
    setHighlight(0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit();
      return;
    }
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const choice = suggestions[highlight];
      if (choice) pick(choice);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  }

  const showDropdown = open && suggestions.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Fil — choisis-en un existant ou crée-en un nouveau"
        disabled={disabled}
        autoComplete="off"
        autoFocus
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showDropdown}
        aria-controls="journal-thread-suggest"
        className="block h-8 w-full rounded-md border border-hair bg-bg px-3 text-[13px] text-ink placeholder:text-muted-soft focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none disabled:opacity-60"
      />
      {showDropdown ? (
        <ul
          id="journal-thread-suggest"
          role="listbox"
          className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-auto rounded-md border border-hair bg-bg py-1 shadow-[0_8px_20px_rgba(0,0,0,0.08)]"
        >
          {suggestions.map((option, i) => {
            const isHighlighted = i === highlight;
            return (
              <li key={option} role="option" aria-selected={isHighlighted}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    // `onMouseDown` (not `onClick`) so the input
                    // doesn't blur and dismiss the panel before we
                    // get the chance to handle the pick.
                    e.preventDefault();
                    pick(option);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={cn(
                    'flex w-full items-center px-3 py-1.5 text-left text-[13px] transition-colors',
                    isHighlighted
                      ? 'bg-accent-soft text-accent-deep'
                      : 'text-ink-soft hover:bg-bg-2',
                  )}
                >
                  {option}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

interface MarkdownEditorProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  /** Default `'visual'` (Word-like contentEditable). `'markdown'`
   * exposes the raw source in a textarea for users who'd rather
   * type the markers directly. */
  mode?: 'visual' | 'markdown';
  /** Called when the user flips the in-toolbar mode toggle. */
  onModeChange?: (next: 'visual' | 'markdown') => void;
}

/**
 * Two-mode editor for the Journal Composer:
 *
 * - **visual** (default): a `contentEditable` surface where bold /
 *   italic / bullet show formatted directly, edited Word-style. The
 *   toolbar uses `document.execCommand` (deprecated but universally
 *   supported) to apply formatting, and we serialise the resulting
 *   HTML back to Markdown on every input — storage stays Markdown
 *   either way.
 * - **markdown**: a textarea with the raw source. The toolbar
 *   wraps the current selection with `**` / `*`, or toggles `- `
 *   line prefixes.
 *
 * Toggle lives in the Composer footer (`MarkdownToggle`). Switching
 * modes hydrates the new surface from the canonical `value` so the
 * round trip is lossless for the supported subset.
 *
 * Keyboard: `Cmd/Ctrl+Enter` submits in both modes. `Cmd/Ctrl+B/I`
 * works in markdown mode (handled here) and visual mode (the browser
 * already maps these to execCommand for contentEditable).
 *
 * Deliberately not a full editor — no headings, no links, no code
 * blocks. If we need more we'll reach for TipTap; for now this is
 * zero-dep and predictable.
 */
function MarkdownEditor({
  value,
  onChange,
  onSubmit,
  disabled,
  mode = 'visual',
  onModeChange,
}: MarkdownEditorProps) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const ceRef = useRef<HTMLDivElement | null>(null);
  const prevMode = useRef<'visual' | 'markdown'>(mode);

  // Hydrate the contentEditable from `value` on mount and on every
  // toggle into visual mode. We deliberately don't include `value`
  // in the deps — once the surface is alive, the user's typing IS
  // the source of changes (we serialise back to `value` on input),
  // so re-setting `innerHTML` here would clobber the cursor.
  useEffect(() => {
    if (mode === 'visual' && ceRef.current) {
      const wasMarkdown = prevMode.current !== 'visual';
      const isFirstMount = ceRef.current.innerHTML === '';
      if (wasMarkdown || isFirstMount) {
        ceRef.current.innerHTML = markdownToHtml(value);
      }
    }
    prevMode.current = mode;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  /* ---- Markdown-mode helpers (textarea source view) -------------- */

  function wrapSelection(marker: string): void {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = value.slice(0, start);
    const sel = value.slice(start, end);
    const after = value.slice(end);
    onChange(`${before}${marker}${sel}${marker}${after}`);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + marker.length, end + marker.length);
    });
  }

  function toggleBulletList(): void {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const lineEnd =
      value.indexOf('\n', end) === -1 ? value.length : value.indexOf('\n', end);
    const block = value.slice(lineStart, lineEnd);
    const lines = block.split('\n');
    const nonEmpty = lines.filter((l) => l.length > 0);
    const allBulleted =
      nonEmpty.length > 0 && nonEmpty.every((l) => l.startsWith('- '));
    const transformed = lines
      .map((l) => {
        if (l.length === 0) return l;
        if (allBulleted) return l.startsWith('- ') ? l.slice(2) : l;
        return l.startsWith('- ') ? l : `- ${l}`;
      })
      .join('\n');
    const next = value.slice(0, lineStart) + transformed + value.slice(lineEnd);
    onChange(next);
    const delta = transformed.length - block.length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start, end + delta);
    });
  }

  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 'b') {
        e.preventDefault();
        wrapSelection('**');
        return;
      }
      if (k === 'i') {
        e.preventDefault();
        wrapSelection('*');
        return;
      }
    }
  }

  /* ---- Visual-mode helpers (contentEditable) --------------------- */

  function syncFromContentEditable(): void {
    if (!ceRef.current) return;
    onChange(htmlToMarkdown(ceRef.current.innerHTML));
  }

  function execCommand(command: 'bold' | 'italic' | 'insertUnorderedList'): void {
    const el = ceRef.current;
    if (!el) return;
    el.focus();
    document.execCommand(command);
    syncFromContentEditable();
  }

  function handleVisualKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit();
      return;
    }
    // Wire Cmd/Ctrl + B / I explicitly. Browsers nominally map these
    // to execCommand for contentEditable on their own, but the
    // behaviour is patchy across Firefox/Safari/Chrome — handling
    // them ourselves guarantees the toolbar and the keyboard agree.
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 'b') {
        e.preventDefault();
        execCommand('bold');
        return;
      }
      if (k === 'i') {
        e.preventDefault();
        execCommand('italic');
        return;
      }
    }
  }

  function handleVisualPaste(e: React.ClipboardEvent<HTMLDivElement>): void {
    // Force plain-text paste so the contentEditable doesn't ingest
    // arbitrary HTML (styles, images, links) from another app — the
    // user can re-apply our limited formatting via the toolbar.
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }

  /* ---- Render ---------------------------------------------------- */

  const toolbarDisabled = Boolean(disabled);
  const isVisual = mode === 'visual';

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          onClick={() => (isVisual ? execCommand('bold') : wrapSelection('**'))}
          ariaLabel="Gras"
          title="Gras (Cmd/Ctrl + B)"
          disabled={toolbarDisabled}
        >
          <span className="font-bold">B</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => (isVisual ? execCommand('italic') : wrapSelection('*'))}
          ariaLabel="Italique"
          title="Italique (Cmd/Ctrl + I)"
          disabled={toolbarDisabled}
        >
          <span className="font-serif italic">I</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            isVisual ? execCommand('insertUnorderedList') : toggleBulletList()
          }
          ariaLabel="Liste à puce"
          title="Liste à puce"
          disabled={toolbarDisabled}
        >
          <span className="leading-none">•</span>
        </ToolbarButton>
        <span className="ml-2 text-[11px] text-muted">
          {isVisual
            ? 'Édition visuelle'
            : '**gras** · *italique* · - liste'}
        </span>
        {onModeChange ? (
          <div className="ml-auto">
            <MarkdownToggle
              value={mode === 'markdown'}
              onChange={(next) => onModeChange(next ? 'markdown' : 'visual')}
            />
          </div>
        ) : null}
      </div>
      {isVisual ? (
        <div
          ref={ceRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Contenu de l’entrée"
          data-placeholder="Ce qui te traverse aujourd’hui — au long, sans contrainte."
          onInput={syncFromContentEditable}
          onKeyDown={handleVisualKeyDown}
          onPaste={handleVisualPaste}
          className={cn(
            'journal-ce block min-h-[180px] w-full rounded-md border border-hair bg-bg px-3 py-2 text-[13.5px] leading-[1.5] text-ink',
            'focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none',
            disabled ? 'pointer-events-none opacity-60' : '',
          )}
        />
      ) : (
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleTextareaKeyDown}
          placeholder="Ce qui te traverse aujourd’hui — au long, sans contrainte."
          rows={8}
          disabled={disabled}
          className="block min-h-[180px] w-full resize-none rounded-md border border-hair bg-bg px-3 py-2 text-[13.5px] leading-[1.5] text-ink placeholder:text-muted-soft focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none disabled:opacity-60"
        />
      )}
    </div>
  );
}

interface ToolbarButtonProps {
  onClick: () => void;
  ariaLabel: string;
  title: string;
  disabled?: boolean | undefined;
  children: React.ReactNode;
}

function ToolbarButton({
  onClick,
  ariaLabel,
  title,
  disabled,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        // Keep the textarea focused so `selectionStart/End` stays
        // accurate when the click handler runs.
        e.preventDefault();
      }}
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-[13px] text-ink-soft transition-colors hover:bg-bg-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">
      {children}
    </div>
  );
}

interface FooterProps {
  onSubmit: () => void;
  submitting?: boolean;
  error?: string | null;
  submitLabel?: string;
  submittingLabel?: string;
  /** Optional element rendered between the keyboard hints and the
   * submit button — e.g. a body-specific toggle like Journal's
   * "Aperçu" switch. Kept generic so other bodies can opt in later. */
  extra?: React.ReactNode;
}

function Footer({
  onSubmit,
  submitting,
  error,
  submitLabel = 'Enregistrer',
  submittingLabel = 'Enregistrement…',
  extra,
}: FooterProps) {
  return (
    <div className="border-t border-hair bg-bg-2">
      {error ? (
        <p
          role="alert"
          className="border-b border-hair bg-danger/5 px-3.5 py-1.5 text-[12px] text-danger"
        >
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-4 px-3.5 py-2.5">
        <div className="flex items-center gap-4 text-[11px] text-muted">
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <kbd className="rounded-[3px] border border-hair bg-bg px-1.5 py-px font-mono text-[10px] text-ink-soft">
              ⌘↵
            </kbd>
            envoyer
          </span>
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <kbd className="rounded-[3px] border border-hair bg-bg px-1.5 py-px font-mono text-[10px] text-ink-soft">
              esc
            </kbd>
            annuler
          </span>
          <span>chiffré localement</span>
        </div>
        <div className="flex items-center gap-2">
          {extra}
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="rounded-md bg-accent px-3.5 py-1.5 text-[12px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-accent-deep active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? submittingLabel : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function submitOnCmdEnter(
  e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  onSubmit: () => void,
): void {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    onSubmit();
  }
}
