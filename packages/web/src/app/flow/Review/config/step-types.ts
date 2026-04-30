/**
 * Type definitions for the YearCompass-faithful guided tour. The
 * actual step list lives in `steps.ts`; the field tables in
 * `step-fields.ts`. Splitting keeps each file under the project
 * 200–300 LOC ceiling.
 *
 * Wording, ordering and grouping mirror the official YearCompass A4
 * booklet (https://yearcompass.com/fr/) — see
 * `documentation/Modules/Review.md` for the canonical payload shape.
 *
 * The Wizard renders based on `kind` and never branches on step id —
 * keep this file declarative.
 */

export type StepGroup = 'welcome' | 'last_year' | 'next_year';

export type StepKind =
  | 'intro' // welcome screen, no payload
  | 'textarea'
  | 'string_list'
  | 'keyed_text' //   Record<key, string>     (e.g. six_phrases)
  | 'keyed_list' //   Record<key, string[]>   (e.g. life_areas, triplets)
  | 'keyed_mixed'; // Record<key, string | string[]> with a per-field editor

/** Tuple of the key in the payload + the label shown to the user.
 *  Used by `keyed_text` and `keyed_list` (uniform per-field editor). */
export interface KeyLabel {
  key: string;
  label: string;
  /** Optional inline note shown below the field (asterisk
   *  footnotes from the booklet, etc.). */
  hint?: string;
}

export type MixedFieldType = 'text' | 'textarea' | 'list' | 'date';

/** Field descriptor for `keyed_mixed` — each field declares its
 *  own editor type (text / textarea / list / date). */
export interface MixedKeyLabel {
  key: string;
  label: string;
  type: MixedFieldType;
  /** Optional inline note shown below the field. */
  hint?: string;
}

export interface BaseStep {
  id: string;
  group: StepGroup;
  /** Dotted path inside the payload (e.g. `last_year.six_phrases`).
   *  Empty string for `intro` steps that don't persist anything. */
  path: string;
  title: string;
  subtitle?: string;
  /** Optional asterisk-footnote-style note rendered under the
   *  step's editor — used for the « pardon » booklet footnote. */
  help?: string;
}

export interface IntroStep extends BaseStep {
  kind: 'intro';
  /** Welcome paragraphs, each rendered as its own <p>. */
  body: string[];
}
export interface TextareaStep extends BaseStep {
  kind: 'textarea';
  placeholder?: string;
}
export interface StringListStep extends BaseStep {
  kind: 'string_list';
  placeholder?: string;
}
export interface KeyedTextStep extends BaseStep {
  kind: 'keyed_text';
  fields: KeyLabel[];
}
export interface KeyedListStep extends BaseStep {
  kind: 'keyed_list';
  fields: KeyLabel[];
}
export interface KeyedMixedStep extends BaseStep {
  kind: 'keyed_mixed';
  fields: MixedKeyLabel[];
}

export type Step =
  | IntroStep
  | TextareaStep
  | StringListStep
  | KeyedTextStep
  | KeyedListStep
  | KeyedMixedStep;
