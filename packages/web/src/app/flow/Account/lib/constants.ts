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
  'modules',
  'data',
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
