import type {
  LibraryFormat,
  LibraryReviewKind,
  LibraryStatus,
  NormalisedBook,
} from '@nodea/shared';

import { intlLocale } from '@/core/i18n/date-format';

/**
 * UI constants for the now-inline module forms — labels, colour
 * ramps, placeholder copy. Originally lifted out of the legacy
 * `ComposerModal` body files ; kept here for now because the
 * inline forms (Mood / Goals / Journal / Library) still import
 * from this path. A follow-up move will fan them out per module.
 *
 * Several constants here overlap with `flow/<Module>/lib/constants.ts`
 * (`SCORE_LABELS`, `GOAL_STATUS_LABEL`, `LIBRARY_*_LABEL`) ; rather
 * than cross-import (which would tie the shared atoms to a module's
 * internal lib), the duplicates stay local here. Promotion to a
 * shared atom can happen later if the labels start drifting.
 */

/** Two-digit month codes + locale-aware long labels for the
 *  « date » selector shared by Goal / Library bodies. Built
 *  on demand from `Intl.DateTimeFormat` so EN / FR / a future
 *  language all get their native month names. The first letter
 *  is uppercased to match the legacy FR labels (« Janvier » not
 *  « janvier ») and the EN convention. */
export function genMonthOptions(
  language: string,
): ReadonlyArray<{ value: string; label: string }> {
  const fmt = new Intl.DateTimeFormat(intlLocale(language), {
    month: 'long',
  });
  return Array.from({ length: 12 }, (_, i) => {
    const value = String(i + 1).padStart(2, '0');
    const raw = fmt.format(new Date(2000, i, 1));
    const label = raw.charAt(0).toUpperCase() + raw.slice(1);
    return { value, label };
  });
}

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
