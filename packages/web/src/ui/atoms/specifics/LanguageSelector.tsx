import clsx from 'clsx';
import { useI18n } from '@/i18n/I18nProvider.jsx';

export interface LanguageSelectorProps {
  className?: string;
}

/**
 * Tri-state (or more) language picker rendered as a pill group — same
 * visual footprint as `ThemeSelector` so the two can live side-by-side
 * in the onboarding modal without a visual mismatch.
 *
 * The full settings page keeps using `LanguagePreferences` (a
 * card-wrapped dropdown) when room is less of a concern.
 */
export default function LanguageSelector({ className = '' }: LanguageSelectorProps) {
  const { t, language, setLanguage, availableLanguages } = useI18n();

  return (
    <div
      role="group"
      aria-label={t('settings.language.ariaLabel', { defaultValue: 'Préférence de langue' })}
      className={clsx(
        'flex flex-wrap items-center justify-between gap-2 rounded-full border border-gray-200 bg-white/80 p-1 shadow-sm sm:inline-flex sm:gap-px',
        'dark:border-slate-700 dark:bg-slate-800/80 dark:shadow-none',
        'w-full sm:w-auto',
        className,
      )}
    >
      {availableLanguages.map((lang) => {
        const active = language === lang.id;
        return (
          <button
            key={lang.id}
            type="button"
            onClick={() => setLanguage(lang.id)}
            className={clsx(
              'flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:flex-none',
              active
                ? 'bg-slate-700 text-white shadow-sm dark:bg-slate-600'
                : 'text-slate-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-700/60',
            )}
            aria-pressed={active}
          >
            {lang.label}
          </button>
        );
      })}
    </div>
  );
}
