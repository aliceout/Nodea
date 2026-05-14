import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from '@headlessui/react';
import {
  CheckIcon,
  ChevronDownIcon,
  ComputerDesktopIcon,
  MoonIcon,
  SunIcon,
} from '@heroicons/react/24/outline';

import { useTheme, type ThemePreference } from '@/core/theme/useTheme';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';

/**
 * Tri-state theme picker (light / system / dark) rendered as a
 * **dropdown** — same visual footprint as the sidebar's
 * `<LanguageToggle>` so the two read as peer widgets.
 *
 * **Pick this variant or `<ThemeSwitch>`** : ces deux composants
 * coexistent volontairement (REFACTO-13 audité, pas une
 * duplication). Use `<ThemeToggle>` quand l'espace est contraint
 * (sidebar) — la dropdown garde une empreinte visuelle minimale.
 * Use `<ThemeSwitch>` quand on a la place pour 3 boutons icônes
 * toujours visibles (docs topbar) — le switch segmenté évite le
 * clic supplémentaire.
 *
 * Why Headless UI's `Listbox` rather than a native `<select>`: the
 * user wanted an icon next to each option, and `<option>` only
 * renders plain text — browsers strip any custom HTML / SVG inside.
 * Listbox gives us the same accessibility (focus management, arrow
 * keys, Esc to close) with full control over the rendered options.
 *
 * The sidebar lives at the bottom of the viewport, so we anchor the
 * options *above* the trigger (`anchor="top start"`) — opening
 * downwards would clip against the viewport edge.
 */

interface ThemeOption {
  id: ThemePreference;
  icon: typeof SunIcon;
  /** i18n key for the option label, e.g. `settings.theme.options.light`. */
  i18nKey: string;
  /** Fallback label when the i18n provider doesn't carry the key yet. */
  defaultLabel: string;
}

const OPTIONS: readonly ThemeOption[] = [
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

export interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();

  const active = OPTIONS.find((o) => o.id === theme) ?? OPTIONS[1]!;
  const ActiveIcon = active.icon;
  const activeLabel = t(active.i18nKey, { defaultValue: active.defaultLabel });

  return (
    <Listbox value={theme} onChange={setTheme}>
      <div className={cn('relative inline-flex min-w-0', className)}>
        <ListboxButton
          aria-label={t('settings.theme.ariaLabel', {
            defaultValue: 'Préférence de thème',
          })}
          className={cn(
            // Same chrome as <LanguageToggle> so the two widgets
            // sit at exactly the same height and visual weight.
            // `w-full min-w-0` lets the parent wrapper drive the
            // width (the sidebar footer passes `flex-1`) — without
            // `min-w-0` the button keeps its content as a min-width
            // and ends up resizing whenever the active label
            // changes (« Clair » vs « Système »).
            'inline-flex h-7 w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-md border border-hair bg-bg pl-2.5 pr-7 text-[12px] text-ink',
            'focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none',
          )}
        >
          <ActiveIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-left">{activeLabel}</span>
          <ChevronDownIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-1.5 h-3.5 w-3.5 -translate-y-1/2 text-muted"
          />
        </ListboxButton>
        <ListboxOptions
          anchor="top end"
          className={cn(
            // The `[--anchor-gap:6px]` CSS var is read by Headless
            // UI's anchor positioning — it's the offset between
            // the trigger and the panel.
            'z-50 mt-0 mb-1.5 min-w-[var(--button-width)] origin-bottom rounded-md border border-hair bg-bg p-1 shadow-[0_8px_20px_rgba(0,0,0,0.08)] [--anchor-gap:6px]',
            'focus:outline-none',
          )}
        >
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const label = t(opt.i18nKey, { defaultValue: opt.defaultLabel });
            return (
              <ListboxOption
                key={opt.id}
                value={opt.id}
                className={({ focus, selected }) =>
                  cn(
                    'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[12px] transition-colors',
                    selected
                      ? 'bg-accent-soft text-accent-deep'
                      : focus
                        ? 'bg-bg-2 text-ink'
                        : 'text-ink-soft',
                  )
                }
              >
                {({ selected }) => (
                  <>
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="flex-1">{label}</span>
                    {selected ? (
                      <CheckIcon
                        className="h-3.5 w-3.5 shrink-0 text-accent"
                        aria-hidden="true"
                      />
                    ) : null}
                  </>
                )}
              </ListboxOption>
            );
          })}
        </ListboxOptions>
      </div>
    </Listbox>
  );
}
