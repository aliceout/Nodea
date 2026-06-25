import { useMemo, useState } from 'react';
import { splitThreads } from '@nodea/shared';

import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';
import { LiteMarkdown } from '@/lib/lite-markdown';
import EntryReader from '@/ui/dirk/module/EntryReader';

import { useJournalActions, useJournalData } from '../context';
import { attachmentSrc } from '../hooks/imageResize';

/**
 * Focus reading mode for Journal entries. Composes the shared
 * `EntryReader` shell (issue #64 extraction) with Journal-specific
 * payload : Markdown content via `LiteMarkdown`, attached images
 * after the body, and a "no thread" eyebrow fallback.
 *
 * The shell handles the keyboard (Esc / ←/→), the topbar, the
 * header and the prev/next footer ; this file only resolves the
 * neighbours and renders the body.
 *
 * **Navigation scope** : prev/next walk the entries carrying ONE
 * thread — the « active » thread — NOT the sidebar `filtered` list,
 * so opening a « famille » piece and arrowing on never jumps into an
 * unrelated « voyages » note. When the open entry has several threads
 * the user picks which one the arrows follow via the chips in the
 * footer (the active thread defaults to the entry's first) ; the
 * choice persists while stepping through neighbours and resets when
 * the reader is closed and reopened. Threadless entries (`thread ===
 * ''`) form their own neighbourhood with other threadless entries.
 *
 * Self-conditional : returns `null` when there is no current
 * reading entry, so `JournalView` can mount this unconditionally.
 */
export default function ReaderShell() {
  const { t } = useI18n();
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const { entries } = useJournalData();
  const { readingId, editEntry, openReader, closeReader } = useJournalActions();

  // Which thread the arrows follow when the open entry has several.
  // `null` = use the default (the entry's first thread). Lives here, so
  // it survives prev/next (the shell stays mounted) and resets when the
  // reader is closed + reopened (the shell unmounts on `readingId` null).
  const [navThread, setNavThread] = useState<string | null>(null);

  // Resolve the current entry from the full `entries` set (not the
  // sidebar-filtered list) — the reader's neighbourhood is keyed on
  // the entry's threads, not on the user's current filter chip.
  const currentEntry = useMemo(
    () => (readingId === null ? null : entries.find((e) => e.id === readingId) ?? null),
    [entries, readingId],
  );

  const currentTags = useMemo(
    () => (currentEntry ? splitThreads(currentEntry.thread) : []),
    [currentEntry],
  );

  // The thread the arrows actually walk. Defaults to the entry's first
  // thread ; falls back to it if the user's pick isn't on the current
  // entry (shouldn't happen given the neighbour filter, but keeps the
  // value always valid). `null` only for threadless entries.
  const activeThread =
    navThread !== null && currentTags.includes(navThread)
      ? navThread
      : currentTags[0] ?? null;

  // Single-thread neighbourhood (not the union of the entry's threads):
  // « précédent / suivant » stays inside ONE coherent fil. `entries` is
  // already newest-first (cf. context's sort), so we keep that order.
  const neighbours = useMemo(() => {
    if (!currentEntry) return [];
    if (activeThread === null) {
      return entries.filter((e) => splitThreads(e.thread).length === 0);
    }
    return entries.filter((e) => splitThreads(e.thread).includes(activeThread));
  }, [entries, currentEntry, activeThread]);

  const readingIndex =
    currentEntry === null
      ? -1
      : neighbours.findIndex((e) => e.id === currentEntry.id);
  const entry = readingIndex >= 0 ? neighbours[readingIndex]! : null;

  const onPrev = useMemo(
    () =>
      entry && readingIndex > 0
        ? () => openReader(neighbours[readingIndex - 1]!.id)
        : null,
    [entry, readingIndex, neighbours, openReader],
  );
  const onNext = useMemo(
    () =>
      entry && readingIndex < neighbours.length - 1
        ? () => openReader(neighbours[readingIndex + 1]!.id)
        : null,
    [entry, readingIndex, neighbours, openReader],
  );

  if (!entry) return null;

  const position = readingIndex + 1;
  const total = neighbours.length;

  // When the entry carries several threads, surface a chip per thread so
  // the user picks which one « précédent / suivant » follows. Single- or
  // zero-thread entries get no picker (nothing to choose).
  const navScope =
    currentTags.length >= 2 ? (
      <>
        <span className="mr-1 text-[11px] text-muted">
          {t('journal.reader.navThreadLabel')}
        </span>
        {currentTags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => setNavThread(tag)}
            aria-pressed={tag === activeThread}
            className={cn(
              'cursor-pointer rounded-full border px-2 py-0.5 text-[11px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
              tag === activeThread
                ? 'border-accent bg-accent-soft text-accent-deep'
                : 'border-hair text-ink-soft hover:border-accent hover:text-accent',
            )}
          >
            {tag}
          </button>
        ))}
      </>
    ) : null;

  return (
    <EntryReader
      topbarLabel={t('journal.topbar.readerLabel', { values: { position, total } })}
      onOpenMenu={() => setMobileMenuOpen(true)}
      onEdit={() => {
        closeReader();
        editEntry(entry);
      }}
      onClose={closeReader}
      onPrev={onPrev}
      onNext={onNext}
      navScope={navScope}
      position={position}
      total={total}
      eyebrow={entry.thread || t('journal.reader.noThreadEyebrow')}
      dateLabel={entry.dateLabel}
      title={entry.title}
      editLabel={t('journal.reader.edit')}
      closeLabel={t('journal.reader.close')}
      prevLabel={t('journal.reader.prev')}
      nextLabel={t('journal.reader.next')}
    >
      <div className="text-[15px] leading-[1.7] text-ink">
        <LiteMarkdown text={entry.content} />
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
    </EntryReader>
  );
}
