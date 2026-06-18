import {
  ComputerDesktopIcon,
  MoonIcon,
  SunIcon,
} from '@heroicons/react/24/outline';

import { useTheme, type ThemePreference } from '@/core/theme/useTheme';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';

interface ThemeOption {
  id: ThemePreference;
  icon: typeof SunIcon;
  /** i18n key for the option label, e.g. `settings.theme.options.light`. */
  i18nKey: string;
  /** Fallback label when the i18n provider doesn't carry the key yet. */
  defaultLabel: string;
}

const OPTIONS: ReadonlyArray<ThemeOption> = [
  {
    id: 'light',
    icon: SunIcon,
    i18nKey: 'settings.theme.options.light',
    defaultLabel: 'Clair',
  },
  {
    id: 'system',
    icon: ComputerDesktopIcon,
    i18nKey: 'settings.theme.options.system',
    defaultLabel: 'Système',
  },
  {
    id: 'dark',
    icon: MoonIcon,
    i18nKey: 'settings.theme.options.dark',
    defaultLabel: 'Sombre',
  },
];

export interface ThemeSwitchProps {
  className?: string;
}

/**
 * Tri-state **segmented switch** — light / system / dark.
 *
 * Direction K · Sauge variant of the theme picker. Three icon-only
 * buttons sit in a hairline-bordered pill; the active one carries the
 * sage-soft fill.
 *
 * **Pick this variant or `<ThemeToggle>`** : ces deux composants
 * coexistent volontairement (REFACTO-13 audité, pas une duplication).
 * Use `<ThemeSwitch>` quand on a la place pour 3 boutons icônes
 * toujours visibles (docs topbar) — le switch segmenté évite le clic
 * supplémentaire de la dropdown. Use `<ThemeToggle>` quand l'espace
 * est contraint (sidebar) — la dropdown garde une empreinte visuelle
 * minimale.
 *
 * Pairs the same `useTheme` hook as `ThemeToggle` so preferences flow
 * through the same persistence chain (localStorage + encrypted blob
 * when authenticated).
 */
export default function ThemeSwitch({ className }: ThemeSwitchProps) {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t('settings.theme.ariaLabel', {
        defaultValue: 'Préférence de thème',
      })}
      className={cn(
        'inline-flex items-center gap-px rounded-md border border-hair bg-bg p-0.5',
        className,
      )}
    >
      {OPTIONS.map(({ id, icon: Icon, i18nKey, defaultLabel }) => {
        const active = theme === id;
        const label = t(i18nKey, { defaultValue: defaultLabel });
        return (
          <button
            key={id}
            type="button"
            onClick={() => setTheme(id)}
            aria-pressed={active}
            aria-label={label}
            title={label}
            className={cn(
              'inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
              active
                ? 'bg-accent-soft text-accent-deep'
                : 'text-muted hover:bg-bg-2 hover:text-ink',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
