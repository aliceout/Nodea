import { Modal } from '@/ui/atoms/layout/Modal';
import {
  useNodeaStore,
  type ComposerType,
} from '@/core/store/nodea-store';
import { cn } from '@/lib/utils';

import GoalBody from './bodies/Goal';
import JournalBody from './bodies/Journal';
import LibraryItemBody from './bodies/LibraryItem';
import LibraryReviewBody from './bodies/LibraryReview';
import MoodBody from './bodies/Mood';
import SimpleBody from './bodies/Simple';
import { TYPE_OPTIONS } from './lib/constants';

/**
 * ComposerModal — Direction K · Sauge.
 *
 * Top-positioned overlay (≈ 130 px from the top of the
 * viewport), 620 px wide on desktop, with a five-tab type
 * picker. The body adapts to the selected type :
 *
 * - `mood` — structured form (3 positives + −2..+2 score +
 *   optional « question du jour » + optional free comment).
 * - `goal` — title + date + status + thread + Markdown note.
 * - `journal` — single thread + Markdown content + up to 3
 *   image attachments.
 * - `library-item` — full bibliographic record + ISBN lookup
 *   + cover preview.
 * - `library-review` — quote / note attached to a library
 *   item, paginated.
 * - `habit` / `note` — free-text Instrument-Serif textarea
 *   (the « capture vite et on triera plus tard » fallback for
 *   modules that don't have a structured shape yet).
 *
 * Architecture : this orchestrator is intentionally thin — it
 * hosts only the modal shell + the tab strip + the body
 * dispatch. Each body owns its own state, validation, save
 * orchestration, and (where applicable) draft auto-save. The
 * ISBN lookup machinery lives in `lookup/` ; the markdown
 * editor / thread suggest input / footer in `components/` ;
 * the constants + type guards + pure helpers in `lib/`.
 *
 * Dismissal is wired to `closeComposer()`. Esc is handled by
 * the underlying `<Modal>`.
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

/** Tab strip at the top of the modal — picks which body
 *  renders. Library variants (`library-item`,
 *  `library-review`) aren't here because their entry points
 *  live elsewhere (the Library page itself opens the composer
 *  pre-typed for those). */
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
