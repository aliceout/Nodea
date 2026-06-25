import { useEffect, type ReactNode } from 'react';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  PencilSquareIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

import Button from '@/ui/atoms/dirk/Button';
import ModuleShell from './ModuleShell';
import Tag from './Tag';
import Topbar from '../Topbar';

interface EntryReaderProps {
  /** Topbar centre label — typically `« <Module> · N / total »`. */
  topbarLabel: string;
  /** Optional extra controls placed between `Modifier` and `Fermer`
   *  in the action bar above the article. Modules can drop a status
   *  pill / quick-action here when the reader header isn't the
   *  right spot. (Used to be in the topbar pre-#58 follow-up ; the
   *  action bar is closer to the content the user is reading,
   *  matches the K · Sauge contextual-affordance rhythm.) */
  topbarExtras?: ReactNode;
  onOpenMenu: () => void;
  onEdit: () => void;
  onClose: () => void;
  /** `null` when the reader is at the first / last entry of the
   *  filtered list ; the footer button stays visible but disabled
   *  so the user sees the boundary. */
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  /** Optional control rendered above the prev/next row — lets a module
   *  expose what sequence the arrows walk (e.g. Journal's per-thread
   *  picker when an entry carries several threads). */
  navScope?: ReactNode;
  position: number;
  total: number;
  /** Small uppercase tag in the top-left of the header — `thread`
   *  for Journal, status label / thread for Goals, etc. */
  eyebrow: string;
  /** Right-aligned secondary date / metadata. Optional — Library
   *  reader future-uses won't always have a date. */
  dateLabel?: string;
  /** Big serif title. Omitted when the underlying entry has none
   *  (Journal entries can be title-less). */
  title?: string | null;
  /** Module-rendered body : Markdown content, attachment list,
   *  future sub-goals / cross-module links sections, etc. The shell
   *  keeps zero opinions about what goes here besides max-width. */
  children: ReactNode;
  editLabel: string;
  closeLabel: string;
  prevLabel: string;
  nextLabel: string;
}

/**
 * Generic full-shell reader (issue #64). Drops the side column and
 * the regular list to surface a single entry as a long-form read.
 * Issue #64 extracted this from Journal's `ReaderShell` so Goals
 * (and a future Library deep-view) can reuse the layout +
 * navigation + keyboard wiring.
 *
 * Topbar :
 *   - position counter (e.g. « Journal · 3 / 17 »),
 *   - « Modifier » (re-opens the module's Composer),
 *   - optional extras slot (module-specific quick action),
 *   - « Fermer » (closes the reader).
 *
 * Header (rendered by this shell from props) :
 *   - eyebrow on the left + date on the right,
 *   - optional serif title.
 *
 * Body : whatever the module ships as `children` — Markdown render,
 * attachments, future sections (sub-goals #60, cross-module
 * links #63, …).
 *
 * Footer : « Précédent » / « Suivant » navigation + position pill.
 *
 * Keyboard : `Esc` closes, `←` / `→` step through neighbours, but
 * the handler defers when a form field has focus so a future
 * inline-edit affordance on the reader page still gets its arrow
 * keys.
 */
export default function EntryReader({
  topbarLabel,
  topbarExtras,
  onOpenMenu,
  onEdit,
  onClose,
  onPrev,
  onNext,
  navScope,
  position,
  total,
  eyebrow,
  dateLabel,
  title,
  children,
  editLabel,
  closeLabel,
  prevLabel,
  nextLabel,
}: EntryReaderProps) {
  useEffect(() => {
    function handle(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }
      if (e.key === 'ArrowLeft' && onPrev) {
        e.preventDefault();
        onPrev();
        return;
      }
      if (e.key === 'ArrowRight' && onNext) {
        e.preventDefault();
        onNext();
      }
    }
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [onClose, onPrev, onNext]);

  // Each entry opens at its top. The reader replaces a (possibly far-
  // scrolled) list while sharing the window scroll, so without this the
  // window keeps the list's offset and drops the user mid-article.
  // Re-runs on prev/next (the `position` counter changes) so stepping
  // to a neighbour also starts at the top of that entry.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [position]);

  return (
    <ModuleShell
      topbar={<Topbar label={topbarLabel} onOpenMenu={onOpenMenu} />}
    >
      {/* Reading column is biased left, not centred : the left gutter
          is half the right one (1/3 vs 2/3 of the free space) so the
          text sits closer to the sidebar/nav side. `max()` clamps the
          offset to 0 on viewports narrower than the column. */}
      <article className="ml-[max(0px,calc((100%_-_50rem)/3))] max-w-[50rem]">
        {/* Action bar above the entry. `Modifier` is pushed to the
            left (mr-auto) ; the extras + `Fermer` stay on the right. */}
        <div className="mb-5 flex items-center gap-1.5 border-b border-hair pb-3">
          <Button variant="ghost" size="sm" onClick={onEdit} className="mr-auto">
            <PencilSquareIcon className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {editLabel}
          </Button>
          {topbarExtras}
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={onClose}
            aria-label={closeLabel}
          >
            <XMarkIcon className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <header className="mb-7">
          <div className="flex items-center justify-between gap-3">
            <Tag>{eyebrow}</Tag>
            {dateLabel ? (
              <p className="text-[12px] tabular-nums text-muted">{dateLabel}</p>
            ) : null}
          </div>
          {title ? (
            // K · Sauge canonical page heading — sans-serif 30 px
            // semibold, tight tracking. Same family as `PageHeading`
            // used by the list views, so the visual rhythm carries
            // through the open-reader transition. The previous
            // `font-serif text-[32px]` read as a magazine-style cue
            // foreign to the rest of the surface (issue #58 follow-up).
            <h1 className="mt-2 text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink">
              {title}
            </h1>
          ) : null}
        </header>

        {children}

        <footer className="mt-12 border-t border-hair pt-5">
          {navScope ? (
            <div className="mb-3 flex flex-wrap items-center justify-center gap-1.5">
              {navScope}
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="neutral"
              size="sm"
              onClick={onPrev ?? (() => undefined)}
              disabled={onPrev === null}
            >
              <ArrowLeftIcon className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              {prevLabel}
            </Button>
            <span className="text-[11px] tabular-nums text-muted">
              {position} / {total}
            </span>
            <Button
              variant="neutral"
              size="sm"
              onClick={onNext ?? (() => undefined)}
              disabled={onNext === null}
            >
              {nextLabel}
              <ArrowRightIcon className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        </footer>
      </article>
    </ModuleShell>
  );
}
