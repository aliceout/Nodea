import clsx from 'clsx';
import { ComputerDesktopIcon, MoonIcon, SunIcon } from '@heroicons/react/24/outline';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { useTheme, type ThemePreference } from '@/core/theme/useTheme';

const OPTIONS: Array<{ id: ThemePreference; icon: typeof SunIcon }> = [
  { id: 'light', icon: SunIcon },
  { id: 'system', icon: ComputerDesktopIcon },
  { id: 'dark', icon: MoonIcon },
];

export interface ThemeSelectorProps {
  variant?: 'compact' | 'card';
  className?: string;
}

/**
 * Tri-state light / system / dark toggle.
 *
 * Persistence is local to the browser (localStorage) — the legacy
 * per-user remote preference via PB is gone. Add it back here when
 * the new back grows a user-preferences endpoint.
 */
export default function ThemeSelector({
  variant = 'compact',
  className = '',
}: ThemeSelectorProps) {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label={t('settings.theme.ariaLabel', { defaultValue: 'Préférence de thème' })}
      className={clsx(
        'rounded-full border border-gray-200 bg-white/80 p-1 shadow-sm',
        'dark:border-slate-700 dark:bg-slate-800/80 dark:shadow-none',
        variant === 'compact'
          ? 'inline-flex items-center gap-px'
          : 'flex flex-wrap items-center justify-between gap-2 sm:inline-flex sm:gap-px',
        variant === 'card' ? 'w-full sm:w-auto' : '',
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
            className={clsx(
              'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
              active
                ? 'bg-slate-700 text-white shadow-sm dark:bg-slate-600'
                : 'text-slate-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-700/60',
              variant === 'card' ? 'sm:px-4 sm:py-2 sm:text-sm' : '',
            )}
            aria-pressed={active}
            aria-label={label}
            title={label}
          >
            <Icon
              className={clsx(variant === 'card' ? 'size-5' : 'size-4', active ? 'opacity-100' : 'opacity-80')}
            />
            {variant === 'card' ? <span>{label}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
