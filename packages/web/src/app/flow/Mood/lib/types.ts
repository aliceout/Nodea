import type { MoodScore } from '@nodea/shared';

/** Decrypted Mood record + display-ready label. The K UI uses
 *  `date` for the inline list (« Aujourd'hui » / « Hier » /
 *  « lundi 12 mars »…) ; `dateIso` is the canonical sortable
 *  string for filters and grouping. */
export interface MoodEntry {
  /** Decrypted record id — needed by edit / delete handlers. */
  id: string;
  /** ISO `YYYY-MM-DD` — drives year / month filtering. */
  dateIso: string;
  /** Display label computed from `dateIso` + today. */
  date: string;
  score: MoodScore;
  positives: [string, string, string];
  comment?: string;
  question?: string;
  answer?: string;
}

/** One cell of the 52 × 7 heatmap grid. `null` is rendered as a
 *  faint outline (out-of-range or no entry) ; a populated cell
 *  carries its score, today flag, and a pre-formatted label for
 *  the hover tooltip. */
export interface HeatmapCell {
  score: MoodScore;
  isToday: boolean;
  /** Pre-formatted French label for the cell's date — `lundi 30
   *  mars`, with the year appended only when it differs from
   *  today's year. */
  dateLabel: string;
}

/** Month tick along the top of the heatmap. */
export interface MonthLabel {
  /** Index of the week this label sits over (0 = oldest, 51 =
   *  current). */
  weekIndex: number;
  label: string;
}

/** One observation in the SideColumn « Patterns » block. */
export interface Pattern {
  label: string;
  delta: string;
}
