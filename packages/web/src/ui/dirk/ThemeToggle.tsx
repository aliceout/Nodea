import { ComputerDesktopIcon, MoonIcon, SunIcon } from '@heroicons/react/24/outline';

import { useTheme, type ThemePreference } from '@/core/theme/useTheme';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';

/**
 * Compact tri-state light / system / dark toggle, Direction K · Sauge.
 *
 * Used in the sidebar footer for one-click switching. The
 * full-text "labeled" variant lived here briefly during the
 * Settings → Account merge, then got replaced by a native
 * `<select>` in the Préférences tab so the theme control matches
 * the language one. The icon row stays here because in the
 * sidebar the labels would crowd the sync indicator.
 */

const OPTIONS: Array<{ id: ThemePreference; icon: typeof SunIcon }> = [
  { id: 'light', icon: SunIcon },
  { id: 'system', icon: ComputerDesktopIcon },
  { id: 'dark', icon: MoonIcon },
];

export interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t('settings.theme.ariaLabel', { defaultValue: 'Préférence de thème' })}
      className={cn(
        'inline-flex items-center gap-px rounded-md border border-hair bg-bg p-0.5',
        className,
      )}
    >
      {OPTIONS.map(({ id, icon: Icon }) => {
        const active = theme === id;
        const label = t(`settings.theme.options.${id}`, { defaultValue: id });
        return (
          <button
            key={id}
            type="button"
            onClick={() => setTheme(id)}
            aria-pressed={active}
            aria-label={label}
            title={label}
            className={cn(
              'inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-[5px] transition-colors',
              active
                ? 'bg-accent text-white'
                : 'text-muted hover:bg-bg-2 hover:text-ink',
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
