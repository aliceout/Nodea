import { MOOD_SCORE_VALUES, type MoodPayload, type MoodScore } from '@nodea/shared';

import type { DecryptedRecord } from '@/core/api/modules/collection-client';
import {
  formatEntryLabel,
  toIsoDate,
  type EntryLabelOptions,
} from '@/core/i18n/date-format';
import { buildSearchHaystack } from '@/lib/text-search';

import type { MoodEntry } from './types';

/** Set of canonical score strings the schema accepts. Used by
 *  `normalizeScore` to short-circuit unknown values onto the
 *  legacy 0..10 → −2..+2 mapping. Exported so Homepage can reuse
 *  it for its read-only projection — same source of truth, no
 *  drift risk if the schema's score domain ever changes. */
export const VALID_SCORES: ReadonlySet<string> = new Set(MOOD_SCORE_VALUES);

/**
 * Normalise a raw `payload.moodScore`. Canonical strings (`-2`,
 * `-1`, `0`, `1`, `2`) pass through ; legacy 0..10 values get
 * linearly mapped onto −2..+2 so older entries don't disappear
 * under the new scale. Anything non-finite collapses to `0`.
 */
export function normalizeScore(raw: string): MoodScore {
  if (VALID_SCORES.has(raw)) return raw as MoodScore;
  const n = Number(raw);
  if (!Number.isFinite(n)) return '0';
  const mapped = Math.max(-2, Math.min(2, Math.round((n - 5) / 2.5)));
  return String(mapped) as MoodScore;
}

/**
 * Map a decrypted Mood record onto the page-local `MoodEntry`
 * shape. Tolerates legacy values : `moodEmoji` is ignored, a
 * legacy 0..10 `moodScore` gets linearly mapped onto −2..+2.
 *
 * `today` is a parameter so the date label stays deterministic in
 * tests ; falls back to today's ISO if the payload's `date` is
 * missing or malformed (defensive — the entry won't sort
 * meaningfully but at least the UI doesn't crash).
 */
export function recordToEntry(
  record: DecryptedRecord<MoodPayload>,
  today: Date,
  labels: EntryLabelOptions,
): MoodEntry {
  const p = record.payload;
  // Defensive fallback for a malformed stored date : LOCAL today,
  // not `toISOString()` (UTC) — east of UTC after midnight the UTC
  // slice still reads yesterday (audit 2026-06). The whole module's
  // date convention is local.
  const dateIso =
    p.date && /^\d{4}-\d{2}-\d{2}/.test(p.date)
      ? p.date.slice(0, 10)
      : toIsoDate(today);
  const positives: [string, string, string] = [
    p.positive1 ?? '',
    p.positive2 ?? '',
    p.positive3 ?? '',
  ];
  const entry: MoodEntry = {
    id: record.id,
    dateIso,
    date: formatEntryLabel(dateIso, today, labels),
    score: normalizeScore(p.moodScore ?? '0'),
    positives,
    searchHaystack: buildSearchHaystack([
      ...positives,
      p.comment,
      p.question,
      p.answer,
    ]),
  };
  if (p.comment && p.comment.trim().length > 0) entry.comment = p.comment;
  if (p.question && p.question.trim().length > 0) entry.question = p.question;
  if (p.answer && p.answer.trim().length > 0) entry.answer = p.answer;
  return entry;
}
