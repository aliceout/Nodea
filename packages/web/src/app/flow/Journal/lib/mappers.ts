import type { JournalPayload } from '@nodea/shared';

import type { DecryptedRecord } from '@/core/api/modules/collection-client';
import {
  formatEntryLabel,
  type EntryLabelOptions,
} from '@/core/i18n/date-format';

import type { JournalEntry } from './types';

/** Flatten a decrypted journal record into the in-memory shape the
 *  Journal page hands around. `today` + `labels` are parameters so
 *  the date label stays deterministic in tests and locale-aware in
 *  production. Falls back to today's ISO if the payload's `date`
 *  is missing — defensive against legacy / malformed records, the
 *  UI doesn't crash. */
export function recordToEntry(
  record: DecryptedRecord<JournalPayload>,
  today: Date,
  labels: EntryLabelOptions,
): JournalEntry {
  const p = record.payload;
  const todayIso = today.toISOString().slice(0, 10);
  const dateIso = p.date ?? todayIso;
  return {
    id: record.id,
    dateIso,
    dateLabel: formatEntryLabel(dateIso, today, labels),
    thread: p.thread ?? '',
    title: p.title ?? null,
    content: p.content ?? '',
    attachments: Array.isArray(p.attachments) ? p.attachments : [],
  };
}
