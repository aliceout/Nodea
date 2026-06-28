import { useTheme, type ThemePreference } from '@/core/theme/useTheme';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';

/**
 * Plain-text theme cycler for the sidebar footer. Renders the
 * active theme's label (« Clair », « Système », « Sombre ») as an
 * inline button ; clicking advances through
 * light → system → dark → light. Pairs with `<LanguageToggle>` so
 * the footer reads as a macOS-menu-bar status line :
 * « Synchronisé · à l'instant » on top, « Français · Clair » below.
 *
 * No icon chrome, no chip — the footer stays purely typographic.
 * Hover gives a fill pill (matching the collapse toggle) + a
 * `current → next` tooltip so the affordance reads as « click cycles ».
 *
 * **`<ThemeToggle>` vs `<ThemeSwitch>`** : volontairement coexistants.
 * Use this in tight chrome (sidebar). `<ThemeSwitch>` (docs topbar)
 * keeps the segmented look where horizontal real-estate is abundant.
 */
interface ThemeOption {
  id: ThemePreference;
  i18nKey: string;
  defaultLabel: string;
}

const OPTIONS: readonly ThemeOption[] = [
  {
    id: 'light',
    i18nKey: 'settings.theme.options.light',
    defaultLabel: 'Clair',
  },
  {
    id: 'system',
    i18nKey: 'settings.theme.options.system',
    defaultLabel: 'Système',
  },
  {
    id: 'dark',
    i18nKey: 'settings.theme.options.dark',
    defaultLabel: 'Sombre',
  },
];

export interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();

  const currentIdx = OPTIONS.findIndex((o) => o.id === theme);
  const current = OPTIONS[currentIdx] ?? OPTIONS[1]!;
  const next = OPTIONS[(currentIdx + 1) % OPTIONS.length] ?? OPTIONS[0]!;
  const currentLabel = t(current.i18nKey, { defaultValue: current.defaultLabel });
  const nextLabel = t(next.i18nKey, { defaultValue: next.defaultLabel });

  return (
    <button
      type="button"
      onClick={() => setTheme(next.id)}
      aria-label={t('settings.theme.ariaLabel', {
        defaultValue: 'Préférence de thème',
      })}
      title={`${currentLabel} → ${nextLabel}`}
      className={cn(
        'cursor-pointer rounded px-1.5 py-0.5 transition-colors hover:bg-bg hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
        className,
      )}
    >
      {currentLabel}
    </button>
  );
}
