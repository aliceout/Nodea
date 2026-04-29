import { useEffect } from 'react';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  PencilSquareIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

import { useNodeaStore } from '@/core/store/nodea-store';
import { JournalContent } from '@/lib/journal-markdown';
import Button from '@/ui/atoms/dirk/Button';
import ModuleShell from '@/ui/dirk/ModuleShell';
import Topbar from '@/ui/dirk/Topbar';

import { useJournalActions, useJournalFilters } from '../context';
import { attachmentSrc } from '../hooks/imageResize';

/**
 * Focus reading mode — full-shell takeover that drops the side
 * column and the regular list to surface a single entry as a
 * long-form read. Topbar carries :
 *   - position counter « N / total » against the filtered list,
 *   - « Modifier » (re-opens the Composer),
 *   - « ← Retour » (closes the reader).
 *
 * Body : eyebrow thread + date, optional serif title, the entry's
 * Markdown rendered through `JournalContent` at a slightly larger
 * size than the inline list.
 *
 * Footer : « ← Précédent » / « Suivant → » navigation, disabled at
 * either end. Sequence follows the **filtered** list so the user
 * keeps reading what they were just looking at, not random entries
 * that weren't in their view.
 *
 * Keyboard : `Esc` closes, `←` / `→` step through neighbours
 * (ignored when a focusable element has the focus, so future
 * inline-edit affordances would still get to handle their own
 * arrow keys).
 *
 * Self-conditional : returns `null` when there is no current
 * reading entry, so `JournalView` can mount this unconditionally.
 */
export default function ReaderShell() {
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const { filtered } = useJournalFilters();
  const { readingId, editEntry, openReader, closeReader } = useJournalActions();

  const readingIndex =
    readingId === null ? -1 : filtered.findIndex((e) => e.id === readingId);
  const entry = readingIndex >= 0 ? filtered[readingIndex]! : null;

  const onPrev =
    entry && readingIndex > 0
      ? () => openReader(filtered[readingIndex - 1]!.id)
      : null;
  const onNext =
    entry && readingIndex < filtered.length - 1
      ? () => openReader(filtered[readingIndex + 1]!.id)
      : null;

  useEffect(() => {
    if (!entry) return undefined;
    function handle(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeReader();
        return;
      }
      // Don't steal arrow keys when the user is interacting with a
      // focusable element (form fields, toolbar buttons) — the
      // reader is read-only but a future inline-edit affordance
      // would care.
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
  }, [entry, closeReader, onPrev, onNext]);

  if (!entry) return null;

  const position = readingIndex + 1;
  const total = filtered.length;

  return (
    <ModuleShell
      topbar={
        <Topbar
          label={`Journal · ${position} / ${total}`}
          onOpenMenu={() => setMobileMenuOpen(true)}
        >
          <Button variant="ghost" size="sm" onClick={() => editEntry(entry)}>
            <PencilSquareIcon className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Modifier
          </Button>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={closeReader}
            aria-label="Fermer"
          >
            <XMarkIcon className="h-4 w-4" aria-hidden="true" />
          </Button>
        </Topbar>
      }
    >
      <article className="mx-auto max-w-2xl">
        <header className="mb-7">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-muted">
              {entry.thread || '— sans fil —'}
            </p>
            <p className="text-[12px] tabular-nums text-muted">
              {entry.dateLabel}
            </p>
          </div>
          {entry.title ? (
            <h1 className="mt-2 font-serif text-[32px] leading-[1.15] tracking-[-0.01em] text-ink">
              {entry.title}
            </h1>
          ) : null}
        </header>

        <div className="text-[15px] leading-[1.7] text-ink">
          <JournalContent text={entry.content} />
        </div>

        {entry.attachments.length > 0 ? (
          <div className="mt-8 space-y-4">
            {entry.attachments.map((att) => (
              <img
                key={att.id}
                src={attachmentSrc(att)}
                alt=""
                className="block w-full rounded-md border border-hair object-contain"
              />
            ))}
          </div>
        ) : null}

        <footer className="mt-12 flex items-center justify-between gap-3 border-t border-hair pt-5">
          <Button
            variant="neutral"
            size="sm"
            onClick={onPrev ?? (() => undefined)}
            disabled={onPrev === null}
          >
            <ArrowLeftIcon className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Précédent
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
            Suivant
            <ArrowRightIcon className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </footer>
      </article>
    </ModuleShell>
  );
}
