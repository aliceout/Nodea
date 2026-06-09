import { useMemo } from 'react';
import { splitThreads } from '@nodea/shared';

import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
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
 * **Navigation scope** : prev/next walk the entries that share at
 * least one thread with the currently-open entry — NOT the sidebar
 * `filtered` list. Rationale : opening a piece about « famille »
 * and then arrowing into an unrelated « voyages » or « therapy »
 * note breaks the continuity the user is reading for. Threadless
 * entries (`thread === ''`) form their own neighbourhood with
 * other threadless entries. Multi-thread entries (e.g.
 * « famille, voyages ») walk the union — any entry sharing one of
 * those threads counts as a neighbour.
 *
 * Self-conditional : returns `null` when there is no current
 * reading entry, so `JournalView` can mount this unconditionally.
 */
export default function ReaderShell() {
  const { t } = useI18n();
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const { entries } = useJournalData();
  const { readingId, editEntry, openReader, closeReader } = useJournalActions();

  // Resolve the current entry from the full `entries` set (not the
  // sidebar-filtered list) — the reader's neighbourhood is keyed on
  // the entry's threads, not on the user's current filter chip.
  const currentEntry = useMemo(
    () => (readingId === null ? null : entries.find((e) => e.id === readingId) ?? null),
    [entries, readingId],
  );

  // Same-thread neighbourhood. `entries` is already newest-first
  // (cf. context's `recordsToEntries` sort), so we keep that order
  // here for prev = older-on-the-right intuition the rest of the
  // app already follows.
  const neighbours = useMemo(() => {
    if (!currentEntry) return [];
    const currentTags = splitThreads(currentEntry.thread);
    const tagSet = new Set(currentTags);
    return entries.filter((e) => {
      const tags = splitThreads(e.thread);
      // Threadless entry → group with other threadless entries.
      if (currentTags.length === 0) return tags.length === 0;
      // Tagged entry → walk the union of its threads.
      return tags.some((t) => tagSet.has(t));
    });
  }, [entries, currentEntry]);

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
