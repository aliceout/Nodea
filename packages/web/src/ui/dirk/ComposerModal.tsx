import { Fragment, useState } from 'react';
import { Dialog, DialogPanel, Transition } from '@headlessui/react';

import {
  useNodeaStore,
  type ComposerType,
} from '@/core/store/nodea-store';
import { cn } from '@/lib/utils';

/**
 * ComposerModal — Direction K · Sauge.
 *
 * Pixel-precise port of `Design/design_handoff_nodea/source/dir-k-extras.jsx
 * → K_Composer`. Top-positioned overlay (≈ 130 px from the top of
 * the viewport), 620 px wide on desktop, with a five-tab type
 * picker, a big Instrument-Serif textarea, conditional metadata
 * for the `mood` type (1-10 note grid + tag pills), and a footer
 * with `↵ envoyer` / `esc annuler` keyboard hints.
 *
 * Dismissal is wired to `closeComposer()`. The "Enregistrer" CTA
 * is a no-op until the encrypted module pipelines accept entries
 * from this surface; opening the composer + cycling types + Esc
 * are already production-ready.
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

        <div className="fixed inset-0 flex items-start justify-center px-4 pt-[15vh] sm:pt-[130px]">
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
              <ComposerBody type={type} onSubmit={closeComposer} />
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

interface ComposerBodyProps {
  type: ComposerType;
  onSubmit: () => void;
}

const PLACEHOLDERS: Record<ComposerType, string> = {
  mood: 'Une humeur, un moment, ce qui se dit dans la tête…',
  pass: 'Un extrait qui mérite d’être relu — citation entre guillemets, page et ouvrage en métadonnées.',
  goal: 'Une intention pour la semaine, le mois, l’année.',
  habit: 'Une habitude à suivre — quoi, à quel rythme.',
  note: 'Une note libre. Aucune contrainte.',
};

function ComposerBody({ type, onSubmit }: ComposerBodyProps) {
  const [text, setText] = useState('');
  const [note, setNote] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>(['café', 'travail', 'marche']);

  function toggleTag(tag: string): void {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit();
    }
  }

  return (
    <>
      <div className="px-[22px] pb-1 pt-3.5">
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={PLACEHOLDERS[type]}
          className="block min-h-[90px] w-full resize-none border-0 bg-transparent font-serif text-[19px] leading-[1.5] text-ink placeholder:text-muted-soft focus:outline-none"
        />
      </div>

      {type === 'mood' ? (
        <div className="flex flex-wrap items-center gap-3.5 px-[22px] pb-3.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">
            Note
          </span>
          <div className="flex gap-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
              const selected = note === n;
              const aboveThreshold = note != null && n <= note;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNote(n)}
                  className={cn(
                    'flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-[4px] text-[11px] font-semibold tabular-nums transition-colors',
                    aboveThreshold
                      ? 'bg-accent text-white'
                      : 'bg-bg-2 text-muted hover:text-ink',
                    selected && 'ring-2 ring-accent-deep ring-offset-1 ring-offset-bg',
                  )}
                  aria-pressed={selected}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <div className="ml-auto flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className="cursor-pointer rounded-full bg-bg-2 px-2.5 py-[3px] text-[11px] text-ink-soft transition-colors hover:text-ink"
              >
                {tag}
              </button>
            ))}
            <button
              type="button"
              className="cursor-pointer rounded-full border border-dashed border-hair bg-transparent px-2.5 py-[3px] text-[11px] text-muted transition-colors hover:border-accent hover:text-ink"
            >
              + tag
            </button>
          </div>
        </div>
      ) : null}

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
    </>
  );
}
