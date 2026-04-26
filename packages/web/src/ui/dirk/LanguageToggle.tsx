import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';

/**
 * Compact language picker for the sidebar footer — sits to the left
 * of the `<ThemeToggle>` and reads as a peer widget.
 *
 * Why a custom chevron rather than `DirkSelect`'s native rendering:
 * the OS-default arrow on dark macOS is a thin grey "v" that's
 * easy to miss, and the user explicitly called it out as not
 * looking like a select. We strip the platform chrome with
 * `appearance-none` and overlay a Heroicon `ChevronDownIcon` so
 * it reads as a dropdown on every platform / theme combo.
 *
 * Driven entirely by `useI18n()` — `availableLanguages` is the
 * source of truth, so a new locale dropped into the I18n provider
 * shows up here automatically.
 */
export interface LanguageToggleProps {
  className?: string;
}

export default function LanguageToggle({ className }: LanguageToggleProps) {
  const { language, setLanguage, availableLanguages, t } = useI18n();
  return (
    <div className={cn('relative inline-flex', className)}>
      <select
        aria-label={t('settings.language.ariaLabel', {
          defaultValue: 'Préférence de langue',
        })}
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        className={cn(
          // `appearance-none` strips the OS chrome so the chevron
          // we paint over the right edge is the only one. `pr-7`
          // reserves room for the icon. `bg-bg` on dark mode keeps
          // the field colour consistent with the rest of the app
          // chrome — Webkit otherwise paints selects with a system
          // background that breaks K · Sauge's dark surface.
          'h-7 w-full cursor-pointer appearance-none rounded-md border border-hair bg-bg pl-2.5 pr-7 text-[12px] text-ink',
          'focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none',
        )}
      >
        {availableLanguages.map((lang) => (
          <option key={lang.id} value={lang.id}>
            {lang.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-1.5 h-3.5 w-3.5 -translate-y-1/2 text-muted"
      />
    </div>
  );
}
