import type {
  LibraryFormat,
  LibraryReviewKind,
  LibraryStatus,
  NormalisedBook,
} from '@nodea/shared';

import type { ComposerType } from '@/core/store/nodea-store';

/**
 * UI constants for the ComposerModal — labels, colour ramps,
 * placeholder copy. Lifted out of the monolithic component so a
 * tweak to a label propagates everywhere it surfaces.
 *
 * Several constants here overlap with `flow/<Module>/lib/constants.ts`
 * (`SCORE_LABELS`, `GOAL_STATUS_LABEL`, `LIBRARY_*_LABEL`) ; rather
 * than cross-import (which would tie the global Composer to the
 * module's internal lib), the duplicates stay local here. Promotion
 * to a shared atom can happen later if the labels start drifting.
 */

/** Two-digit month codes + FR labels for the « date » selector
 *  shared by Goal / Library bodies. Lives at the top so the
 *  dropdown options render in calendar order. */
export const MONTH_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '01', label: 'Janvier' },
  { value: '02', label: 'Février' },
  { value: '03', label: 'Mars' },
  { value: '04', label: 'Avril' },
  { value: '05', label: 'Mai' },
  { value: '06', label: 'Juin' },
  { value: '07', label: 'Juillet' },
  { value: '08', label: 'Août' },
  { value: '09', label: 'Septembre' },
  { value: '10', label: 'Octobre' },
  { value: '11', label: 'Novembre' },
  { value: '12', label: 'Décembre' },
];

/** Top tab strip of the modal — picks which body renders.
 *  Library variants (`library-item`, `library-review`) are not
 *  here because their entry points live elsewhere (the Library
 *  page itself opens the composer pre-typed for those). */
export const TYPE_OPTIONS: Array<{ id: ComposerType; label: string }> = [
  { id: 'mood', label: 'Mood' },
  { id: 'journal', label: 'Journal' },
  { id: 'goal', label: 'Goal' },
  { id: 'habit', label: 'Habit' },
  { id: 'note', label: 'Note libre' },
];

/** Modules with a free-text body (no structured fields). The
 *  union mirrors `ComposerType` minus the four typed bodies. */
export type SimpleType = Exclude<
  ComposerType,
  'mood' | 'goal' | 'journal' | 'library-item' | 'library-review'
>;

/** Placeholder copy for the free-text body. Each module gets a
 *  one-liner so the empty textarea isn't intimidating. */
export const SIMPLE_PLACEHOLDERS: Record<SimpleType, string> = {
  habit: 'Une habitude à suivre — quoi, à quel rythme.',
  note: 'Une note libre. Aucune contrainte.',
};

/** Placeholder copy for the three « positive » fields on the
 *  Mood body. Each one nudges the user toward a different angle
 *  on the day so the prompt feels less repetitive. */
export const POSITIVE_PLACEHOLDERS: ReadonlyArray<string> = [
  'Un premier moment qui a tenu la journée debout.',
  'Un deuxième — plus discret peut-être.',
  'Un troisième — même tout petit.',
];

/** Three-state goal status as the picker exposes it. Narrower
 *  than the canonical `CanonicalStatus` (which still tolerates
 *  legacy `active` / `archived` on read) — the Composer never
 *  produces those legacy values. */
export type GoalStatus = 'open' | 'wip' | 'done';

export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  open: 'Ouvert',
  wip: 'En cours',
  done: 'Terminé',
};

/** Active-state classes for the goal status pill picker. The
 *  inactive state shares `border-hair bg-bg text-muted` for
 *  every status, so only the active variant is per-status. */
export const GOAL_STATUS_ACTIVE_TONE: Record<GoalStatus, string> = {
  open: 'border-ink-soft bg-bg-2 font-semibold text-ink',
  wip: 'border-accent-soft bg-accent-soft font-semibold text-accent-deep',
  done: 'border-accent bg-accent font-semibold text-white',
};

export const LIBRARY_STATUS_LABEL: Record<LibraryStatus, string> = {
  planned: 'À lire',
  in_progress: 'En cours',
  finished: 'Terminé',
  abandoned: 'Abandonné',
};

export const LIBRARY_FORMAT_LABEL: Record<LibraryFormat, string> = {
  paper: 'Papier',
  ebook: 'eBook',
  audio: 'Audio',
  unknown: '—',
};

export const LIBRARY_REVIEW_KIND_LABEL: Record<LibraryReviewKind, string> = {
  quote: 'Extrait',
  note: 'Note',
};

/** Filter chip in the LookupBar — narrower than
 *  `LIBRARY_FORMAT_LABEL` because the lookup never has the
 *  `unknown` bucket (a provider with no format is dropped from
 *  the filter row). */
export const FORMAT_LABEL: Record<NonNullable<NormalisedBook['format']>, string> = {
  paper: 'Papier',
  ebook: 'eBook',
  audio: 'Audio',
};

/** Mode dropdown next to the LookupBar's Search button — picks
 *  whether the search returns full metadata or just a cover
 *  grid. */
export const SEARCH_MODE_LABEL: Record<'all' | 'cover-only', string> = {
  all: 'Métadonnées + couverture',
  'cover-only': 'Couverture seule',
};

/** Languages surfaced in the LookupBar's language `<select>`.
 *  Order is the most-likely first ; users searching in a less
 *  common language will tend to know the exact code already. */
export const SEARCH_LANGUAGES: ReadonlyArray<{ code: string; label: string }> = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
  { code: 'ja', label: '日本語' },
];

/** Compact provider names rendered in the result row's badge
 *  cluster. Keeps the row line height stable across providers
 *  with much longer canonical names (« Bibliothèque nationale de
 *  France » → « BNF »). */
export const PROVIDER_LABEL: Record<NormalisedBook['source'], string> = {
  openlibrary: 'OL',
  googlebooks: 'GB',
  bnf: 'BNF',
  wikidata: 'WD',
  bne: 'BNE',
  amazon: 'Amz',
};

/** Canonical sort order of the provider badges — most-trusted
 *  / most-coverage first. Picked at design time, not by
 *  popularity, so a provider going down doesn't rearrange the
 *  badges. */
export const PROVIDER_ORDER: ReadonlyArray<NormalisedBook['source']> = [
  'openlibrary',
  'googlebooks',
  'bnf',
  'wikidata',
  'bne',
  'amazon',
];
