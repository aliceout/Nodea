import type { ThemePreference } from '@/core/theme/useTheme';

import type { Tab } from './types';

/** Tab strip rendered under the H1, in the order the user sees
 *  them. Adding a tab here is enough — the orchestrator dispatches
 *  on the discriminated union to render the matching view. */
export const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'identity', label: 'Identité' },
  { id: 'security', label: 'Sécurité' },
  { id: 'preferences', label: 'Préférences' },
  { id: 'modules', label: 'Modules' },
  { id: 'data', label: 'Données' },
  { id: 'danger', label: 'Suppression du compte' },
];

/** The three theme preferences the Preferences tab `<select>`
 *  surfaces. The actual mapping (cookie / system / DOM class) is
 *  owned by `useTheme` ; this is only the order used in the UI. */
export const THEME_OPTIONS: ReadonlyArray<ThemePreference> = [
  'light',
  'system',
  'dark',
];
