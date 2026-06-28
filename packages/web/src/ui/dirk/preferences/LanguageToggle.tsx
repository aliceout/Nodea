import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';

/**
 * Plain-text language cycler for the sidebar footer. Renders the
 * active language's autonym (« Français », « English »…) as an
 * inline button ; clicking advances to the next entry in
 * `availableLanguages`, wrapping after the last.
 *
 * The text-link affordance pairs with `<ThemeToggle>` so the two
 * sit in the footer as a status line à la macOS menu bar :
 * « Synchronisé · à l'instant » on the first line,
 * « Français · Clair » on the second. No icon chrome, no chip — the
 * footer stays purely typographic, in line with Nodea's paper
 * aesthetic. The « what happens if I click ? » signal is carried by
 * a hover-fill pill (matching the collapse toggle) + a `current → next`
 * tooltip.
 *
 * Driven entirely by `useI18n()` — `availableLanguages` is the
 * source of truth so adding a locale just lengthens the cycle.
 */
export interface LanguageToggleProps {
  className?: string;
}

export default function LanguageToggle({ className }: LanguageToggleProps) {
  const { language, setLanguage, availableLanguages, t } = useI18n();
  const currentIdx = availableLanguages.findIndex((l) => l.id === language);
  const current = availableLanguages[currentIdx] ?? availableLanguages[0];
  if (!current) return null;
  const nextLang =
    availableLanguages[(currentIdx + 1) % availableLanguages.length] ?? current;
  return (
    <button
      type="button"
      onClick={() => setLanguage(nextLang.id)}
      aria-label={t('settings.language.ariaLabel', {
        defaultValue: 'Préférence de langue',
      })}
      title={`${current.label} → ${nextLang.label}`}
      className={cn(
        'cursor-pointer rounded px-1.5 py-0.5 transition-colors hover:bg-bg hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
        className,
      )}
    >
      {current.label}
    </button>
  );
}
