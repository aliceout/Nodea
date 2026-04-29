import type { PassagePayload } from '@nodea/shared';

import type { DecryptedRecord } from '@/core/api/modules/collection-client';
import { formatEntryLabel } from '@/core/i18n/date-fr';

import type { JournalEntry } from './types';

/** Flatten a decrypted Passage record into the in-memory shape the
 *  Journal page hands around. `today` is a parameter so the date
 *  label stays deterministic in tests. Falls back to today's ISO
 *  if the payload's `date` is missing — defensive against legacy /
 *  malformed records, the UI doesn't crash. */
export function recordToEntry(
  record: DecryptedRecord<PassagePayload>,
  today: Date,
): JournalEntry {
  const p = record.payload;
  const todayIso = today.toISOString().slice(0, 10);
  const dateIso = p.date ?? todayIso;
  return {
    id: record.id,
    dateIso,
    dateLabel: formatEntryLabel(dateIso, today),
    thread: p.thread ?? '',
    title: p.title ?? null,
    content: p.content ?? '',
    attachments: Array.isArray(p.attachments) ? p.attachments : [],
  };
}
