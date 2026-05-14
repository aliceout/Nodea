import { useMemo } from 'react';

import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { JournalContent } from '@/lib/journal-markdown';
import EntryReader from '@/ui/dirk/module/EntryReader';

import { useJournalActions, useJournalFilters } from '../context';
import { attachmentSrc } from '../hooks/imageResize';

/**
 * Focus reading mode for Journal entries. Composes the shared
 * `EntryReader` shell (issue #64 extraction) with Journal-specific
 * payload : Markdown content via `JournalContent`, attached images
 * after the body, and a "no thread" eyebrow fallback.
 *
 * The shell handles the keyboard (Esc / ←/→), the topbar, the
 * header and the prev/next footer ; this file only resolves the
 * filtered-list neighbours and renders the body.
 *
 * Self-conditional : returns `null` when there is no current
 * reading entry, so `JournalView` can mount this unconditionally.
 */
export default function ReaderShell() {
  const { t } = useI18n();
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const { filtered } = useJournalFilters();
  const { readingId, editEntry, openReader, closeReader } = useJournalActions();

  const readingIndex =
    readingId === null ? -1 : filtered.findIndex((e) => e.id === readingId);
  const entry = readingIndex >= 0 ? filtered[readingIndex]! : null;

  const onPrev = useMemo(
    () =>
      entry && readingIndex > 0
        ? () => openReader(filtered[readingIndex - 1]!.id)
        : null,
    [entry, readingIndex, filtered, openReader],
  );
  const onNext = useMemo(
    () =>
      entry && readingIndex < filtered.length - 1
        ? () => openReader(filtered[readingIndex + 1]!.id)
        : null,
    [entry, readingIndex, filtered, openReader],
  );

  if (!entry) return null;

  const position = readingIndex + 1;
  const total = filtered.length;

  return (
    <EntryReader
      topbarLabel={t('journal.topbar.readerLabel', { values: { position, total } })}
      onOpenMenu={() => setMobileMenuOpen(true)}
      onEdit={() => editEntry(entry)}
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
    </EntryReader>
  );
}
