import type {
  BackgroundShade,
  BackgroundShadeDark,
} from '@/core/theme/useBackgroundShade';
import type { ThemePreference } from '@/core/theme/useTheme';

import type { Tab } from './types';

/** Tab strip rendered under the H1, in the order the user sees
 *  them. Adding a tab here is enough — the orchestrator dispatches
 *  on the discriminated union to render the matching view, and
 *  surfaces the localised label via `t('account.tabs.<id>')`. */
export const TAB_IDS: ReadonlyArray<Tab> = [
  'identity',
  'security',
  'preferences',
  'data',
  'modules',
  'danger',
];

/** The three theme preferences the Preferences tab `<select>`
 *  surfaces. The actual mapping (cookie / system / DOM class) is
 *  owned by `useTheme` ; this is only the order used in the UI. */
export const THEME_OPTIONS: ReadonlyArray<ThemePreference> = [
  'light',
  'system',
  'dark',
];

/** Light-mode background shades surfaced by the Preferences tab.
 *  Cream sits first as the default ; the rest walk from warmest
 *  (ivory) to coolest (mist) so the eye can compare adjacent
 *  options without surprise. The actual colour values live in
 *  `dirk.css` keyed by `data-bg-shade`. */
export const BACKGROUND_SHADE_OPTIONS: ReadonlyArray<BackgroundShade> = [
  'cream',
  'alabaster',
  'ivory',
  'pearl',
  'pebble',
];

/** Dark-mode background shades surfaced by the Preferences tab.
 *  `graphite` sits first as the default (the existing warm
 *  paper-at-night surface) ; `onyx` is the neutral near-black, then
 *  the variants. Colour values live in `dirk.css` keyed by
 *  `data-bg-shade-dark`. */
export const BACKGROUND_SHADE_DARK_OPTIONS: ReadonlyArray<BackgroundShadeDark> = [
  'graphite',
  'onyx',
  'obsidian',
  'forest',
  'taupe',
];
