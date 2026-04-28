import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '@/ui/atoms/layout/Modal';
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
  apiLibraryFetchCover,
  apiLibraryLookupByIsbn,
  isApiError,
  streamLibraryLookupByQuery,
} from '@/core/api/client';
import { goalsClient } from '@/core/api/modules/goals';
import {
  libraryCoversClient,
  libraryItemsClient,
  libraryReviewsClient,
} from '@/core/api/modules/library';
import { moodClient } from '@/core/api/modules/mood';
import { passageClient } from '@/core/api/modules/passage';
import { useJournalDraft } from '@/app/flow/Journal/hooks/useJournalDraft';
import { htmlToMarkdown, markdownToHtml } from '@/lib/journal-markdown';
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
  type ComposerType,
} from '@/core/store/nodea-store';
import { cn } from '@/lib/utils';
import DirkButton from '@/ui/atoms/dirk/Button';
import DirkInput from '@/ui/atoms/dirk/Input';
import DirkSelect from '@/ui/atoms/dirk/Select';
import DirkTextarea from '@/ui/atoms/dirk/Textarea';
import SectionLabel from '@/ui/dirk/SectionLabel';
import { useI18n } from '@/i18n/I18nProvider.jsx';
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
    <Modal open={open} onClose={closeComposer}>
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
    </Modal>
  );
}

interface TypePickerProps {
  active: ComposerType;
  onSelect: (next: ComposerType) => void;
}

const TYPE_OPTIONS: Array<{ id: ComposerType; label: string }> = [
  { id: 'mood', label: 'Mood' },
  { id: 'journal', label: 'Journal' },
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
              'rounded-sm px-2.5 py-1 text-[12px] transition-colors',
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
          <DirkInput
            key={i}
            value={positives[i as 0 | 1 | 2]}
            onChange={(e) => setPositive(i as 0 | 1 | 2, e.target.value)}
            onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
            placeholder={POSITIVE_PLACEHOLDERS[i] ?? ''}
            autoFocus={i === 0}
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
                  'flex flex-col items-center gap-0.5 rounded-sm border px-2 py-1.5 text-[11px] transition-colors',
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
            <DirkTextarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
              placeholder="Réponse (optionnelle)"
              rows={2}
              minHeightPx={56}
            />
          </div>

          <div>
            <SectionLabel>Commentaire</SectionLabel>
            <DirkTextarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
              placeholder="Ce qui ne tient pas dans les trois lignes du dessus."
              rows={3}
              minHeightPx={84}
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
      <DirkInput
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
        placeholder="Titre — ex. Lancer un blog"
        disabled={submitting}
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[200px_1fr]">
        <div className="grid grid-cols-2 gap-1.5">
          <DirkSelect
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            aria-label="Mois"
            disabled={submitting}
          >
            <option value="">— mois —</option>
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
                {GOAL_STATUS_LABEL[s]}
              </button>
            );
          })}
        </div>
      </div>

      <DirkInput
        value={thread}
        onChange={(e) => setThread(e.target.value)}
        onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
        placeholder="Threads (optionnel) — séparés par une virgule, ex. #DéménagementLyon, #Solo"
        disabled={submitting}
      />

      <DirkTextarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
        placeholder="Note (optionnelle) — détails, contexte, échéance précise…"
        rows={3}
        minHeightPx={84}
        disabled={submitting}
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
  // Drafts live for « new entry » flows only — when editing an
  // existing record the canonical state is the server payload.
  const {
    hydrated: draftHydrated,
    hydrating: draftHydrating,
    save: saveDraft,
    clear: clearDraft,
  } = useJournalDraft();

  const [thread, setThread] = useState(editing?.payload.thread ?? '');
  const [content, setContent] = useState(editing?.payload.content ?? '');
  const [threadOptions, setThreadOptions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  // Visual mode is the Word-like contentEditable surface (default
  // for non-technical users); Markdown mode shows the raw source for
  // anyone who'd rather type `**foo**` directly. Storage stays
  // Markdown either way — `MarkdownEditor` handles the round trip.
  const [editorMode, setEditorMode] = useState<'visual' | 'markdown'>('visual');

  const isEdit = editing !== null;

  // Auto-load any draft sitting in localStorage as soon as it
  // surfaces from `useJournalDraft`. Skipped when editing or when
  // the user has already typed something (we don't want to clobber
  // active input). The « brouillon repris » banner stays visible
  // until the user submits or wipes it.
  useEffect(() => {
    if (isEdit || draftHydrating || draftRestored) return;
    if (!draftHydrated) return;
    if (thread.trim() !== '' || content.trim() !== '') return;
    setThread(draftHydrated.thread);
    setContent(draftHydrated.content);
    setDraftRestored(true);
  }, [isEdit, draftHydrating, draftHydrated, draftRestored, thread, content]);

  // Persist every keystroke (debounced inside `saveDraft`). Skip
  // the edit path — that flow's source-of-truth is the server
  // record, no draft slot involved.
  useEffect(() => {
    if (isEdit) return;
    saveDraft({ thread, content });
  }, [thread, content, isEdit, saveDraft]);

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
        // Successful save → wipe the draft slot so the next open
        // starts fresh instead of resurrecting what the user just
        // submitted.
        clearDraft();
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
      {draftRestored ? (
        <div className="flex items-baseline justify-between gap-2 rounded-sm border-l-2 border-accent bg-accent-soft/40 px-3 py-1.5 text-[12px] text-accent-deep">
          <span>Brouillon en cours repris.</span>
          <button
            type="button"
            onClick={() => {
              setThread('');
              setContent('');
              setDraftRestored(false);
              clearDraft();
            }}
            className="cursor-pointer text-[11px] underline-offset-2 hover:underline"
          >
            Repartir à zéro
          </button>
        </div>
      ) : null}

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
        'cursor-pointer rounded-sm px-2.5 py-1 text-[11px] font-medium transition-colors',
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
  // The user's Nodea-app language (synced from encrypted preferences,
  // falling back to localStorage / navigator on first paint). Passed
  // to the lookup as a *soft boost*, not a filter — providers still
  // return all languages, but the dispatcher reorders so books in the
  // user's language float to the top. Bilingual users still see the
  // alternatives below.
  const { language: userLang } = useI18n();
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
  // Editor mode for the 4ᵉ de couv field: visual (Word-style
  // contentEditable, default) or markdown source. Same pattern as
  // the Journal Composer — gives non-technical users a formatted
  // surface, while letting power users see / edit the raw markers.
  const [summaryMode, setSummaryMode] = useState<'visual' | 'markdown'>('visual');
  // Cover URL preview — populated when the user picks a search
  // result (`applyResult`). Not persisted yet: the schema stores
  // covers as encrypted blobs (`cover_rid`), so wiring the upload
  // pipeline is its own story. For now this is a visual hint in
  // the form so the user can confirm they picked the right book.
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverLoadFailed, setCoverLoadFailed] = useState(false);
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
  // Default the search language to the user's Nodea app language —
  // it's the right choice 99 % of the time, and the user can flip
  // it via the `<select>` next to the search button. ISBN searches
  // ignore this (a 13-digit code is unambiguous across languages).
  const [searchLang, setSearchLang] = useState<string>(userLang);
  // AbortController for the in-flight streaming search. We cancel
  // the previous run when the user fires a new search before the
  // old one finished — otherwise late snapshots from the old query
  // would clobber the new results, and the API keeps doing wasted
  // work on connections nobody reads from.
  const searchAbortRef = useRef<AbortController | null>(null);

  const isEdit = editing !== null;

  /**
   * Run a metadata lookup. ISBN-shaped input goes through the
   * dedicated by-isbn endpoint (one merged result, batch). Free-text
   * goes through the NDJSON streaming endpoint: snapshots arrive as
   * each provider settles (Google Books in ~1 s, Open Library in
   * ~10 s, etc.) so the user sees results progressively rather than
   * staring at a spinner for the slowest provider's full window.
   */
  async function runSearch(): Promise<void> {
    const q = searchInput.trim();
    if (!q) return;
    // Cancel any prior stream — its late snapshots would otherwise
    // overwrite our fresh results, and its `finally` would flip the
    // spinner off mid-new-run.
    searchAbortRef.current?.abort();
    const ac = new AbortController();
    searchAbortRef.current = ac;
    setSearchError(null);
    setSearching(true);
    setSearchOpen(true);
    setSearchResults([]);
    try {
      const stripped = q.replace(/[\s-]/g, '');
      const isPossibleIsbn = /^\d{10}$|^\d{13}$|^\d{9}[\dX]$/i.test(stripped);
      if (isPossibleIsbn) {
        // ISBN: a 13-digit code is unambiguous, no point streaming.
        const response = await apiLibraryLookupByIsbn({ isbn: stripped });
        if (searchAbortRef.current !== ac) return; // superseded
        setSearchResults(response.results);
        if (response.results.length === 0) {
          setSearchError('Aucun résultat. Tu peux saisir manuellement.');
        }
        return;
      }
      // Free-text: stream snapshots in. Each snapshot is the full
      // accumulated state, so we just replace.
      let lastResults: NormalisedBook[] = [];
      await streamLibraryLookupByQuery(
        { q, lang: searchLang },
        {
          signal: ac.signal,
          onSnapshot: (snap) => {
            // Drop late snapshots from a superseded run.
            if (searchAbortRef.current !== ac) return;
            lastResults = snap.results;
            setSearchResults(snap.results);
          },
        },
      );
      if (searchAbortRef.current !== ac) return; // superseded
      if (lastResults.length === 0) {
        setSearchError('Aucun résultat. Tu peux saisir manuellement.');
      }
    } catch (err) {
      // AbortError on stream cancellation is expected and not user-
      // facing — happens when the user fires a new search.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (searchAbortRef.current !== ac) return; // superseded
      if (isApiError(err) && err.status === 429) {
        setSearchError('Trop de recherches récentes — patiente une minute.');
      } else {
        setSearchError('Recherche indisponible. Tu peux saisir manuellement.');
        if (import.meta.env.DEV) console.warn('library lookup failed', err);
      }
    } finally {
      // Only flip the spinner off if we're still the latest run —
      // otherwise an aborted stream would clear the indicator out
      // from under the new search that just started.
      if (searchAbortRef.current === ac) setSearching(false);
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
    setCoverUrl(book.cover_url);
    setCoverLoadFailed(false);
    setSearchOpen(false);
    setSearchResults([]);
    setSearchInput('');
  }

  function dismissSearch(): void {
    searchAbortRef.current?.abort();
    setSearchOpen(false);
    setSearchResults([]);
    setSearchError(null);
    setSearching(false);
  }

  // Abort any in-flight stream when the body unmounts (modal closes
  // mid-search). The fetch / reader stop cleanly, the API stops
  // pushing snapshots into a connection nobody is reading.
  useEffect(() => {
    return () => {
      searchAbortRef.current?.abort();
    };
  }, []);

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
        // Edit path: cover swap mid-edit isn't wired (would need to
        // delete the old encrypted blob row and create a new one).
        // We just update the item, keeping the existing `cover_rid`
        // from `basePayload`. If the user wants to add a cover to a
        // book that didn't have one, that's still supported below.
        await libraryItemsClient.update(moduleUserId, mainKey, editing.id, payload);
        if (coverUrl && !basePayload?.cover_rid) {
          // Late-add a cover to an existing item: download via the
          // proxy, store the encrypted blob, then patch the item to
          // point at it. Best-effort — failure leaves the book without
          // a cover but doesn't roll back the rest of the edit.
          const fetched = await apiLibraryFetchCover(coverUrl);
          if (fetched) {
            try {
              const newCover = await libraryCoversClient.create(
                moduleUserId,
                mainKey,
                {
                  item_rid: editing.id,
                  mime: fetched.mime,
                  blob_b64: fetched.blob_b64,
                  fetched_from: coverUrl,
                  fetched_at: new Date().toISOString(),
                },
              );
              await libraryItemsClient.update(moduleUserId, mainKey, editing.id, {
                ...payload,
                cover_rid: newCover.id,
              });
            } catch (err) {
              if (import.meta.env.DEV) console.warn('cover persist failed', err);
            }
          }
        }
      } else {
        // Create path: race the item insert and the cover download —
        // they're independent (cover proxy lives on library-lookup,
        // not on the encrypted-records pipeline). Total wall-clock
        // is bounded by `max(itemCreate, coverFetch)` rather than
        // their sum.
        const [newItem, fetchedCover] = await Promise.all([
          libraryItemsClient.create(moduleUserId, mainKey, payload),
          coverUrl ? apiLibraryFetchCover(coverUrl) : Promise.resolve(null),
        ]);
        if (coverUrl && fetchedCover) {
          // Cover save is best-effort on create: if the encrypted-blob
          // round-trip fails we still keep the book record. Better
          // than losing the typed-out form to a flaky cover proxy.
          try {
            const newCover = await libraryCoversClient.create(
              moduleUserId,
              mainKey,
              {
                item_rid: newItem.id,
                mime: fetchedCover.mime,
                blob_b64: fetchedCover.blob_b64,
                fetched_from: coverUrl,
                fetched_at: new Date().toISOString(),
              },
            );
            await libraryItemsClient.update(moduleUserId, mainKey, newItem.id, {
              ...newItem.payload,
              cover_rid: newCover.id,
            });
          } catch (err) {
            if (import.meta.env.DEV) console.warn('cover persist failed', err);
          }
        }
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
          lang={searchLang}
          onLangChange={setSearchLang}
        />
      ) : null}

      {showFormFields ? (
      <>
      <DirkInput
        autoFocus={isEdit}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
        placeholder="Titre — ex. Les Misérables"
        disabled={submitting}
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px]">
        <DirkInput
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
          placeholder="Auteur·rice — ex. Victor Hugo"
          disabled={submitting}
        />
        <DirkInput
          inputMode="numeric"
          value={year}
          onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
          onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
          placeholder="Année"
          maxLength={4}
          disabled={submitting}
          align="center"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr]">
        <DirkInput
          value={isbn}
          onChange={(e) => setIsbn(e.target.value)}
          onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
          placeholder="ISBN (optionnel)"
          disabled={submitting}
          className="tabular-nums"
        />
        <DirkInput
          value={publisher}
          onChange={(e) => setPublisher(e.target.value)}
          onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
          placeholder="Éditeur (optionnel)"
          disabled={submitting}
        />
      </div>

      <DirkInput
        value={collection}
        onChange={(e) => setCollection(e.target.value)}
        onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
        placeholder="Collection (optionnel) — ex. Folio classique, Babel"
        disabled={submitting}
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px]">
        <DirkInput
          value={seriesName}
          onChange={(e) => setSeriesName(e.target.value)}
          onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
          placeholder="Série (optionnel) — ex. Le Seigneur des Anneaux"
          disabled={submitting}
        />
        <DirkInput
          inputMode="numeric"
          value={seriesPosition}
          onChange={(e) =>
            setSeriesPosition(e.target.value.replace(/\D/g, '').slice(0, 3))
          }
          onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
          placeholder="Tome n°"
          disabled={submitting}
          align="center"
        />
      </div>

      {/* 4ᵉ de couv + couverture côte à côte. L'éditeur prend toute
          la largeur dispo (flex-1), la cover est fixe à droite avec
          un ratio livre 2:3. Si la cover charge mal (URL morte côté
          provider) on l'efface — pas envie d'afficher un cadre vide.
          Le MarkdownEditor rend le wiki-markup `##title##` et le
          markdown léger normalisés par le dispatcher (cleanSummary). */}
      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          <MarkdownEditor
            value={summary}
            onChange={setSummary}
            onSubmit={handleSave}
            disabled={submitting}
            mode={summaryMode}
            onModeChange={setSummaryMode}
            minHeightPx={160}
          />
        </div>
        {coverUrl && !coverLoadFailed ? (
          <img
            src={coverUrl}
            alt=""
            onError={() => setCoverLoadFailed(true)}
            className="aspect-[2/3] w-[140px] flex-none self-start rounded-sm border border-hair bg-bg-2 object-cover"
          />
        ) : null}
      </div>

      {/* Status, Format, Tags compressés sur une seule ligne via
          deux <select> + un <input> — gagne ~110 px de hauteur sur
          le formulaire, ce qui laisse de la marge pour rajouter
          des champs (collection, série, 4ᵉ de couv) sans pousser
          la modale. La modale reste à sa hauteur fixe — l'espace
          dégagé apparaît juste comme du whitespace en bas tant
          qu'on n'a rien rajouté. */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[140px_140px_1fr]">
        <DirkSelect
          value={status}
          onChange={(e) => setStatus(e.target.value as LibraryStatus)}
          aria-label="Statut"
          disabled={submitting}
        >
          {LIBRARY_STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {LIBRARY_STATUS_LABEL[s]}
            </option>
          ))}
        </DirkSelect>
        <DirkSelect
          value={format}
          onChange={(e) => setFormat(e.target.value as LibraryFormat)}
          aria-label="Format"
          disabled={submitting}
        >
          {LIBRARY_FORMAT_VALUES.map((f) => (
            <option key={f} value={f}>
              {LIBRARY_FORMAT_LABEL[f]}
            </option>
          ))}
        </DirkSelect>
        <DirkInput
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
          placeholder="Tags (optionnel) — ex. classique, à offrir"
          disabled={submitting}
        />
      </div>
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
  /** BCP 47 2-letter code chosen by the user before searching.
   * Used as a *hard filter* by the dispatcher (no soft boost / no
   * post-search chip). Empty string disables the search button. */
  lang: string;
  onLangChange: (next: string) => void;
}

/**
 * Languages exposed in the search-language `<select>`. Order matters —
 * Français first since the app is FR-first, then English, then the
 * other big book-publishing languages. Autonyms (each language name
 * in its own language) make the dropdown self-explanatory regardless
 * of the user's UI locale.
 */
const SEARCH_LANGUAGES: ReadonlyArray<{ code: string; label: string }> = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
  { code: 'ja', label: '日本語' },
];

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

interface FilterEntry<T> {
  value: T;
  label: string;
  count: number;
}

interface FilterRowProps<T> {
  /** Section label, e.g. "Langue". */
  label: string;
  /** Currently selected value, or null when "Tous" / no filter. */
  active: T | null;
  /** Distinct values harvested from results, with counts. */
  entries: FilterEntry<T>[];
  /** Setter — pass null to clear. */
  onChange: (next: T | null) => void;
}

/**
 * One row of filter chips (Langue / Format / Auteur·ice). The
 * "Tous" chip clears the filter; clicking the active chip again
 * also clears it. Only one selection per dimension at a time —
 * picking a new chip in the same row replaces the previous.
 */
function FilterRow<T>({ label, active, entries, onChange }: FilterRowProps<T>) {
  return (
    <div className="flex items-center gap-1.5 overflow-hidden">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.04em] text-muted">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        <FilterChip
          isActive={active === null}
          onClick={() => onChange(null)}
        >
          Tous
        </FilterChip>
        {entries.map((entry, i) => (
          <FilterChip
            key={i}
            isActive={active === entry.value}
            onClick={() =>
              onChange(active === entry.value ? null : entry.value)
            }
          >
            <span className="truncate">{entry.label}</span>
            <span className="ml-1 text-[10px] tabular-nums opacity-70">
              {entry.count}
            </span>
          </FilterChip>
        ))}
      </div>
    </div>
  );
}

interface FilterChipProps {
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function FilterChip({ isActive, onClick, children }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={cn(
        'inline-flex max-w-[180px] cursor-pointer items-center rounded-sm px-1.5 py-0.5 text-[11px] transition-colors',
        isActive
          ? 'bg-accent-soft font-semibold text-accent-deep'
          : 'text-muted hover:bg-bg hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

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
 * Count facet values across results (e.g. how many books per
 * language). Drops null/undefined extractions, returns descending
 * counts so the most-populated chip renders first. Used to drive
 * the filter chips below the lookup search bar.
 */
function countBy<T, K>(
  items: ReadonlyArray<T>,
  pick: (item: T) => K | null | undefined,
): Array<{ value: K; count: number }> {
  const map = new Map<K, number>();
  for (const item of items) {
    const v = pick(item);
    if (v === null || v === undefined) continue;
    map.set(v, (map.get(v) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Normalise the various language codes providers spit out
 * (`fr`, `fre`, `fr-FR`, `eng`, `en`) into a 2-letter BCP 47 code
 * for display + filtering. Returns null when the input doesn't
 * look like a language at all.
 */
function shortLang(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const lc = raw.toLowerCase();
  // 3-letter MARC codes Open Library still returns sometimes
  const marcToBcp: Record<string, string> = {
    fre: 'fr',
    eng: 'en',
    spa: 'es',
    ger: 'de',
    ita: 'it',
    por: 'pt',
    jpn: 'ja',
    rus: 'ru',
  };
  if (marcToBcp[lc]) return marcToBcp[lc] ?? null;
  // BCP 47 like `fr-FR` → first two letters
  const m = /^([a-z]{2})(?:[-_].*)?$/.exec(lc);
  return m ? m[1]! : null;
}

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
  lang,
  onLangChange,
}: LookupBarProps) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (lang) void onSearch();
    } else if (e.key === 'Escape') {
      onDismiss();
    }
  }

  // ---- Post-search filter state (chips below the bar) ----
  // Two narrowers remain post-search:
  //   - "Filtrer par": where the user's query string matched
  //     (auteur·ice / titre). Cleaner than listing every author the
  //     result set surfaced — for "Annie Ernaux" we'd see noisy
  //     one-offs like "Sergio Villani 1" (a critic who wrote about
  //     her) which doesn't help filter anything.
  //   - "Format" (paper / ebook / audio).
  // Both reset when a fresh result set arrives.
  const [formatFilter, setFormatFilter] = useState<NormalisedBook['format']>(null);
  const [matchFilter, setMatchFilter] = useState<'author' | 'title' | null>(null);
  useEffect(() => {
    setFormatFilter(null);
    setMatchFilter(null);
  }, [results]);

  const formatCounts = useMemo(() => {
    return countBy(results, (b) => b.format);
  }, [results]);

  // Counts for the match-field chips: how many results would each
  // option keep? Computed *as if* the chip were active so the count
  // shown alongside the chip is its actual size.
  const matchCounts = useMemo(() => {
    const q = value.trim().toLocaleLowerCase('fr');
    if (!q) return { author: 0, title: 0 };
    let authorMatches = 0;
    let titleMatches = 0;
    for (const b of results) {
      if (b.creators.some((c) => c.name.toLocaleLowerCase('fr').includes(q))) {
        authorMatches += 1;
      }
      if (b.title.toLocaleLowerCase('fr').includes(q)) {
        titleMatches += 1;
      }
    }
    return { author: authorMatches, title: titleMatches };
  }, [results, value]);

  const filteredResults = useMemo(() => {
    const q = value.trim().toLocaleLowerCase('fr');
    return results.filter((b) => {
      if (formatFilter && b.format !== formatFilter) return false;
      if (matchFilter === 'author') {
        if (!q) return true;
        return b.creators.some((c) => c.name.toLocaleLowerCase('fr').includes(q));
      }
      if (matchFilter === 'title') {
        if (!q) return true;
        return b.title.toLocaleLowerCase('fr').includes(q);
      }
      return true;
    });
  }, [results, formatFilter, matchFilter, value]);

  const showFilters =
    open &&
    results.length > 0 &&
    (formatCounts.length > 1 || matchCounts.author > 0 || matchCounts.title > 0);

  const expanded = open && results.length > 0;

  return (
    <div
      className={cn(
        'rounded-sm border border-hair bg-bg-2/60 p-2.5',
        // When results are showing, the bar grows to fill the
        // remaining space in the modal so the list can stretch all
        // the way down — keeps the modal-tall layout filled
        // instead of a white gap below the results card.
        expanded ? 'flex min-h-0 flex-1 flex-col' : '',
      )}
    >
      <div className="flex gap-2">
        <DirkInput
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Rechercher par titre, auteur·rice ou ISBN…"
          disabled={disabled}
        />
        <DirkSelect
          value={lang}
          onChange={(e) => onLangChange(e.target.value)}
          aria-label="Langue de la recherche"
          disabled={disabled}
          className="w-auto shrink-0"
        >
          <option value="" disabled>
            Langue…
          </option>
          {SEARCH_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </DirkSelect>
        <DirkButton
          variant="primary"
          onClick={() => void onSearch()}
          disabled={disabled || searching || value.trim().length < 2 || !lang}
          title={!lang ? 'Choisis une langue avant de chercher' : undefined}
        >
          {searching ? '…' : 'Chercher'}
        </DirkButton>
        {open ? (
          <DirkButton
            variant="secondary"
            onClick={onDismiss}
            aria-label="Fermer les résultats"
            title="Fermer (Esc)"
            className="px-2"
          >
            ✕
          </DirkButton>
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
      {showFilters ? (
        <div className="mt-2 flex flex-col gap-1">
          {matchCounts.author > 0 || matchCounts.title > 0 ? (
            <FilterRow<'author' | 'title'>
              label="Filtrer par"
              active={matchFilter}
              onChange={setMatchFilter}
              entries={[
                ...(matchCounts.author > 0
                  ? [
                      {
                        value: 'author' as const,
                        label: 'Auteur·ice',
                        count: matchCounts.author,
                      },
                    ]
                  : []),
                ...(matchCounts.title > 0
                  ? [
                      {
                        value: 'title' as const,
                        label: 'Titre',
                        count: matchCounts.title,
                      },
                    ]
                  : []),
              ]}
            />
          ) : null}
          {formatCounts.length > 1 ? (
            <FilterRow<NormalisedBook['format']>
              label="Format"
              active={formatFilter}
              onChange={setFormatFilter}
              entries={formatCounts.map((c) => ({
                value: c.value,
                label: c.value ? FORMAT_LABEL[c.value] : '—',
                count: c.count,
              }))}
            />
          ) : null}
        </div>
      ) : null}
      {open && filteredResults.length > 0 ? (
        <ul className="mt-2 min-h-0 flex-1 overflow-auto rounded-sm border border-hair bg-bg">
          {filteredResults.map((book, i) => {
            const isbn = book.isbn13 ?? book.isbn10;
            const formatLabel = book.format ? FORMAT_LABEL[book.format] : null;
            const langCode = shortLang(book.language);
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
                    {(isbn || formatLabel || langCode || seriesLabel) ? (
                      <span className="flex flex-wrap items-center gap-x-1.5 text-[10.5px] text-muted-soft">
                        {isbn ? <span className="tabular-nums">{isbn}</span> : null}
                        {langCode ? (
                          <span className="rounded bg-bg-2 px-1 py-px font-medium uppercase text-ink-soft">
                            {langCode}
                          </span>
                        ) : null}
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
                  'h-8 cursor-pointer rounded-sm border text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-60',
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
        <DirkInput
          inputMode="numeric"
          value={page}
          onChange={(e) => setPage(e.target.value.replace(/\D/g, '').slice(0, 5))}
          onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
          placeholder="Page"
          disabled={submitting}
          align="center"
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
      <DirkInput
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
      />
      {showDropdown ? (
        <ul
          id="journal-thread-suggest"
          role="listbox"
          className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-auto rounded-sm border border-hair bg-bg py-1 shadow-[0_8px_20px_rgba(0,0,0,0.08)]"
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
  /** Minimum height of the writing surface in pixels (defaults to
   * 180). Lets a host module (e.g. Library Composer, where the form
   * has a lot of fields above and a fixed-height modal) tune the
   * editor to fill the available space. */
  minHeightPx?: number;
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
  minHeightPx = 180,
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
          style={{ minHeight: `${minHeightPx}px` }}
          className={cn(
            'journal-ce block w-full rounded-sm border border-hair bg-bg px-3 py-2 text-[13.5px] leading-[1.5] text-ink',
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
          style={{ minHeight: `${minHeightPx}px` }}
          className="block w-full resize-none rounded-sm border border-hair bg-bg px-3 py-2 text-[13.5px] leading-[1.5] text-ink placeholder:text-muted-soft focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none disabled:opacity-60"
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
    <DirkButton
      variant="ghost"
      size="xs"
      iconOnly
      onMouseDown={(e) => {
        // Keep the textarea focused so `selectionStart/End` stays
        // accurate when the click handler runs.
        e.preventDefault();
      }}
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      className="text-[13px] text-ink-soft"
    >
      {children}
    </DirkButton>
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
          <DirkButton
            variant="primary"
            size="sm"
            onClick={onSubmit}
            disabled={submitting}
          >
            {submitting ? submittingLabel : submitLabel}
          </DirkButton>
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
