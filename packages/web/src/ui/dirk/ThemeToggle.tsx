import { ComputerDesktopIcon, MoonIcon, SunIcon } from '@heroicons/react/24/outline';

import { useTheme, type ThemePreference } from '@/core/theme/useTheme';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';

/**
 * Tri-state light / system / dark toggle, Direction K · Sauge.
 *
 * Same `useTheme` hook as the legacy `ThemeSelector` (so the
 * encrypted `preferences.theme` stays the source of truth). Two
 * variants:
 *
 * - `compact` (default) — icon-only buttons, sized to fit in the
 *   sidebar footer next to the sync indicator.
 * - `labeled` — icon + i18n label, sized for the Settings page.
 */

const OPTIONS: Array<{ id: ThemePreference; icon: typeof SunIcon }> = [
  { id: 'light', icon: SunIcon },
  { id: 'system', icon: ComputerDesktopIcon },
  { id: 'dark', icon: MoonIcon },
];

export type ThemeToggleVariant = 'compact' | 'labeled';

export interface ThemeToggleProps {
  variant?: ThemeToggleVariant;
  className?: string;
}

export default function ThemeToggle({ variant = 'compact', className }: ThemeToggleProps) {
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
              'inline-flex cursor-pointer items-center gap-1.5 rounded-[5px] transition-colors',
              variant === 'compact'
                ? 'h-6 w-6 justify-center'
                : 'px-3 py-1.5 text-[12.5px]',
              active
                ? 'bg-accent text-white'
                : 'text-muted hover:bg-bg-2 hover:text-ink',
            )}
          >
            <Icon
              className={variant === 'compact' ? 'h-3.5 w-3.5' : 'h-4 w-4'}
              aria-hidden="true"
            />
            {variant === 'labeled' ? <span>{label}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
