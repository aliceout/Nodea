import type { NormalisedBook } from '@nodea/shared';

import { getMonthNames } from '@/core/i18n/date-format';

/**
 * UI constants for the now-inline module forms — labels, colour
 * ramps, placeholder copy. Originally lifted out of the legacy
 * `ComposerModal` body files ; kept here for now because the
 * inline forms (Mood / Goals / Journal / Library) still import
 * from this path. A follow-up move will fan them out per module.
 *
 * The Library label maps (status / format / review-kind / search
 * mode) that used to live here moved to the `library.*` i18n
 * namespace — Library components resolve them via `t()` now.
 */

/** Card chrome shared by every inline module composer (Mood / Goals /
 *  Journal / Library / HRT) — a muted-surface panel with a hairline
 *  border. Not `Surface`: that primitive rides a different token axis
 *  (`--surface-*` / injected flex gap) and would shift the look + add
 *  gaps these grids don't want. Factored per the « third copy » rule
 *  (nine call sites before this). */
export const FORM_CARD = 'rounded-md border border-hair bg-bg-2 p-4';

/** `FORM_CARD` plus the bottom margin the reader-shell composers
 *  (Mood / Goals / Journal / Library) want below them. The HRT forms
 *  sit flush in their own layout and use `FORM_CARD` directly. */
export const MODULE_FORM_CARD = `mb-5 ${FORM_CARD}`;

/** Two-digit month codes + locale-aware long labels for the
 *  « date » selector shared by Goal / Library bodies. Built
 *  on demand from `Intl.DateTimeFormat` so EN / FR / a future
 *  language all get their native month names. The first letter
 *  is uppercased to match the legacy FR labels (« Janvier » not
 *  « janvier ») and the EN convention. */
export function genMonthOptions(
  language: string,
): ReadonlyArray<{ value: string; label: string }> {
  const names = getMonthNames(language, 'long');
  return Array.from({ length: 12 }, (_, i) => {
    const value = String(i + 1).padStart(2, '0');
    const raw = names[i] ?? '';
    const label = raw.charAt(0).toUpperCase() + raw.slice(1);
    return { value, label };
  });
}

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
  done: 'border-accent bg-accent-strong font-semibold text-white',
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
