import { Fragment, useMemo, useState } from 'react';
import { Dialog, DialogPanel, Transition } from '@headlessui/react';
import { MOOD_SCORE_VALUES, type MoodScore } from '@nodea/shared';

import {
  useNodeaStore,
  type ComposerType,
} from '@/core/store/nodea-store';
import { cn } from '@/lib/utils';
import questions from '@/i18n/fr/Mood/questions.json';

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
                <MoodBody onSubmit={closeComposer} />
              ) : (
                <SimpleBody type={type} onSubmit={closeComposer} />
              )}
              <Footer onSubmit={closeComposer} />
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

const SIMPLE_PLACEHOLDERS: Record<Exclude<ComposerType, 'mood'>, string> = {
  pass: 'Un extrait qui mérite d’être relu — citation entre guillemets, page et ouvrage en métadonnées.',
  goal: 'Une intention pour la semaine, le mois, l’année.',
  habit: 'Une habitude à suivre — quoi, à quel rythme.',
  note: 'Une note libre. Aucune contrainte.',
};

interface SimpleBodyProps {
  type: Exclude<ComposerType, 'mood'>;
  onSubmit: () => void;
}

function SimpleBody({ type, onSubmit }: SimpleBodyProps) {
  const [text, setText] = useState('');
  return (
    <div className="px-[22px] pt-3.5 pb-3">
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => submitOnCmdEnter(e, onSubmit)}
        placeholder={SIMPLE_PLACEHOLDERS[type]}
        className="block min-h-[90px] w-full resize-none border-0 bg-transparent font-serif text-[19px] leading-[1.5] text-ink placeholder:text-muted-soft focus:outline-none"
      />
    </div>
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
  onSubmit: () => void;
}

function MoodBody({ onSubmit }: MoodBodyProps) {
  const [positives, setPositives] = useState<[string, string, string]>(['', '', '']);
  const [score, setScore] = useState<MoodScore | null>(null);
  const [answer, setAnswer] = useState('');
  const [comment, setComment] = useState('');
  const [optionalsOpen, setOptionalsOpen] = useState(false);

  // Pick a random question once per Composer-mood mount so it stays
  // stable while the user types — re-rolls only when the modal
  // unmounts (Composer closed) and re-opens.
  const question = useMemo<string>(() => {
    const list = questions as readonly string[];
    if (list.length === 0) return '';
    const i = Math.floor(Math.random() * list.length);
    return list[i] ?? '';
  }, []);

  function setPositive(idx: 0 | 1 | 2, value: string): void {
    setPositives((prev) => {
      const next: [string, string, string] = [prev[0], prev[1], prev[2]];
      next[idx] = value;
      return next;
    });
  }

  return (
    <div className="space-y-3.5 px-[22px] pt-3.5 pb-3">
      <div className="space-y-2">
        <SectionLabel>Trois choses positives aujourd&rsquo;hui</SectionLabel>
        {[0, 1, 2].map((i) => (
          <textarea
            key={i}
            value={positives[i as 0 | 1 | 2]}
            onChange={(e) => setPositive(i as 0 | 1 | 2, e.target.value)}
            onKeyDown={(e) => submitOnCmdEnter(e, onSubmit)}
            placeholder={POSITIVE_PLACEHOLDERS[i] ?? ''}
            rows={1}
            autoFocus={i === 0}
            className="block w-full resize-none rounded-md border border-hair bg-bg px-3 py-2 text-[14.5px] leading-[1.5] text-ink placeholder:text-muted-soft focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none"
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
              onKeyDown={(e) => submitOnCmdEnter(e, onSubmit)}
              placeholder="Réponse (optionnelle)"
              rows={2}
              className="block w-full resize-none rounded-md border border-hair bg-bg px-3 py-2 text-[14px] leading-[1.5] text-ink placeholder:text-muted-soft focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none"
            />
          </div>

          <div>
            <SectionLabel>Commentaire</SectionLabel>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => submitOnCmdEnter(e, onSubmit)}
              placeholder="Ce qui ne tient pas dans les trois lignes du dessus."
              rows={3}
              className="block w-full resize-none rounded-md border border-hair bg-bg px-3 py-2 text-[14px] leading-[1.5] text-ink placeholder:text-muted-soft focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

const POSITIVE_PLACEHOLDERS: ReadonlyArray<string> = [
  'Un premier moment qui a tenu la journée debout.',
  'Un deuxième — plus discret peut-être.',
  'Un troisième — même tout petit.',
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">
      {children}
    </div>
  );
}

interface FooterProps {
  onSubmit: () => void;
}

function Footer({ onSubmit }: FooterProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-hair bg-bg-2 px-3.5 py-2.5">
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
      <button
        type="button"
        onClick={onSubmit}
        className="rounded-md bg-accent px-3.5 py-1.5 text-[12px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-accent-deep active:translate-y-px"
      >
        Enregistrer
      </button>
    </div>
  );
}

function submitOnCmdEnter(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  onSubmit: () => void,
): void {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    onSubmit();
  }
}
