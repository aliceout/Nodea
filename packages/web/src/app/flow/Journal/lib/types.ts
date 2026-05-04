import type { JournalAttachment } from '@nodea/shared';

/** Decrypted journal record + display-ready label. The K UI uses
 *  `dateLabel` for the inline list (« Aujourd'hui » / « Hier » /
 *  « samedi 12 mars »…) ; `dateIso` is the canonical sortable
 *  string for grouping and reader navigation. */
export interface JournalEntry {
  id: string;
  /** ISO timestamp (`YYYY-MM-DD` or full ISO datetime) from the
   *  saved record's `payload.date`. The only date we have for the
   *  record — server-side timestamps were dropped in the
   *  minimum-readable-surface refactor. */
  dateIso: string;
  /** Display label, computed once at fetch time : « Aujourd'hui »,
   *  « Hier », or a localised long-form date. */
  dateLabel: string;
  thread: string;
  title: string | null;
  content: string;
  attachments: JournalAttachment[];
}

/** Aggregate stats shown in the SideColumn « Stats » block. */
export interface JournalStats {
  totalEntries: number;
  totalWords: number;
  /** Days in a row, ending today (or yesterday if today's empty
   *  but the streak is otherwise live). 0 when there's no
   *  qualifying recent run. */
  streakDays: number;
  /** Whether today's date already has at least one entry. Drives
   *  the « jusqu'à aujourd'hui » vs « jusqu'à hier » caption next
   *  to the streak number. */
  streakIncludesToday: boolean;
}
