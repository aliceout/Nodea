import { useMemo } from 'react';

import { formatPartialDate } from '@/core/i18n/date-format';
import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import EntryReader from '@/ui/dirk/module/EntryReader';

import { useGoalsActions, useGoalsData } from '../context';
import StatusPill from './StatusPill';

/**
 * Focus reading mode for a single goal (issue #64). Composes the
 * shared `EntryReader` shell with Goals-specific payload :
 *   - eyebrow : thread (or « — sans fil — » fallback),
 *   - date : right-aligned partial date,
 *   - title : the goal's name,
 *   - body : the clickable status pill + the (plain-text) note.
 *
 * Navigation prev/next follows the **full entries list** rather
 * than a filtered slice (Goals doesn't expose the same filtered
 * neighbour concept as Journal — the page already groups by
 * thread / year, and reader navigation should sweep the whole set).
 *
 * Self-conditional : returns `null` when no goal is being read,
 * so `GoalsView` can mount this unconditionally and switch on
 * `readingId !== null` for the layout swap.
 */
export default function GoalsReaderShell() {
  const { t, language } = useI18n();
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const { entries } = useGoalsData();
  const { readingId, editEntry, openReader, closeReader } = useGoalsActions();

  const readingIndex =
    readingId === null ? -1 : entries.findIndex((e) => e.id === readingId);
  const entry = readingIndex >= 0 ? entries[readingIndex]! : null;

  const onPrev = useMemo(
    () =>
      entry && readingIndex > 0
        ? () => openReader(entries[readingIndex - 1]!.id)
        : null,
    [entry, readingIndex, entries, openReader],
  );
  const onNext = useMemo(
    () =>
      entry && readingIndex < entries.length - 1
        ? () => openReader(entries[readingIndex + 1]!.id)
        : null,
    [entry, readingIndex, entries, openReader],
  );

  if (!entry) return null;

  const position = readingIndex + 1;
  const total = entries.length;
  const eyebrow = entry.thread || t('goals.reader.noThreadEyebrow');
  const dateLabel = entry.date
    ? formatPartialDate(entry.date, language)
    : undefined;

  return (
    <EntryReader
      topbarLabel={t('goals.topbar.readerLabel', { values: { position, total } })}
      onOpenMenu={() => setMobileMenuOpen(true)}
      onEdit={() => {
        // Close the reader first: Goals renders the reader *instead of*
        // the inline form while `readingId` is set, so opening the edit
        // form without clearing readingId would leave the reader on top
        // (the form opened underneath, invisible). Mirrors Journal.
        closeReader();
        editEntry(entry);
      }}
      onClose={closeReader}
      onPrev={onPrev}
      onNext={onNext}
      position={position}
      total={total}
      eyebrow={eyebrow}
      {...(dateLabel !== undefined ? { dateLabel } : {})}
      title={entry.title}
      editLabel={t('goals.reader.edit')}
      closeLabel={t('goals.reader.close')}
      prevLabel={t('goals.reader.prev')}
      nextLabel={t('goals.reader.next')}
    >
      <div className="mt-1 mb-6 flex items-center gap-3">
        <StatusPill entry={entry} />
      </div>

      {entry.note ? (
        <div className="whitespace-pre-wrap text-[15px] leading-[1.7] text-ink">
          {entry.note}
        </div>
      ) : (
        <p className="text-[14px] italic text-muted">
          {t('goals.reader.emptyNote')}
        </p>
      )}
    </EntryReader>
  );
}
