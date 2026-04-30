import type { MoodScore } from '@nodea/shared';

/** Cell fill class per score for the heatmap grid. `bg-hair`
 *  (rather than `bg-bg-2`) for score 0 so empty cells (no entry)
 *  read as a faint outline while a neutral entry reads as a solid
 *  hair-colour fill — `outline → neutral fill → tinted fill →
 *  saturated fill` removes the ambiguity between « no entry » and
 *  « neutral entry ». */
export const SCORE_FILL: Record<MoodScore, string> = {
  '2': 'bg-accent',
  '1': 'bg-accent-soft',
  '0': 'bg-hair',
  '-1': 'bg-low-soft',
  '-2': 'bg-low',
};

/** Tailwind classes for the inline `<NoteBadge>` pill. Five
 *  tones ; saturated extremes flip text white, mild values keep
 *  ink-toned text on a soft background. */
export const SCORE_TONE: Record<MoodScore, string> = {
  '2': 'bg-accent text-white',
  '1': 'bg-accent-soft text-accent-deep',
  '0': 'bg-bg-2 text-ink-soft',
  '-1': 'bg-low-soft text-low-deep',
  '-2': 'bg-low text-white',
};

/** SVG `stroke` class per score — used by the donut arcs. */
export const SCORE_STROKE: Record<MoodScore, string> = {
  '2': 'stroke-accent',
  '1': 'stroke-accent-soft',
  '0': 'stroke-muted-soft',
  '-1': 'stroke-low-soft',
  '-2': 'stroke-low',
};

/** SVG `fill` class for the donut's per-segment text labels.
 *  Mirrors the magnitude of the score : extreme values get the
 *  deep shade of their family, mild values the medium shade,
 *  neutral stays muted. Always a readable tone — the soft
 *  variants used by the segments themselves would be invisible
 *  as text on the page background. */
export const SCORE_LABEL_FILL: Record<MoodScore, string> = {
  '2': 'fill-accent-deep',
  '1': 'fill-accent',
  '0': 'fill-ink-soft',
  '-1': 'fill-low',
  '-2': 'fill-low-deep',
};

/** Donut segment iteration order — descending so positive
 *  scores sit at the top of the donut. */
export const DONUT_ORDER: ReadonlyArray<MoodScore> = [
  '2',
  '1',
  '0',
  '-1',
  '-2',
];

/** Capitalised FR weekday names, Mon..Sun. Used by `computePatterns`
 *  for the « X est ton meilleur jour » label. */
export const DAY_NAMES_FR: ReadonlyArray<string> = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche',
];

/** Abbreviated FR month names — same shape as Intl's `month:
 *  'short'`, but stable across ICU versions. Used by the streak-
 *  range formatter inside `computePatterns`. */
export const SHORT_MONTHS_FR: ReadonlyArray<string> = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

/** Long FR month names for the entries section header (« Entrées ·
 *  2025 · mars »). */
export const MONTH_LABELS_LONG: ReadonlyArray<string> = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/** Capitalised short FR month names for the month selector chips. */
export const MONTH_LABELS_SHORT: ReadonlyArray<string> = [
  'Janv',
  'Févr',
  'Mars',
  'Avr',
  'Mai',
  'Juin',
  'Juil',
  'Août',
  'Sept',
  'Oct',
  'Nov',
  'Déc',
];
