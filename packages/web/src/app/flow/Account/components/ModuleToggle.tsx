import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';

/**
 * On/off switch widget for a module row in `ModulesManager`. A custom
 * checkbox styled as a sliding pill — the native input stays as the
 * accessible, focusable control (visually transparent, overlaid on the
 * track + knob spans).
 *
 * A top-level component (REFACTO-08, extracted from ModulesManager) so
 * its identity stays stable across parent re-renders.
 */
export default function ModuleToggle({
  checked,
  isBusy,
  onChange,
  label,
}: {
  checked: boolean;
  isBusy: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center',
        isBusy && 'pointer-events-none opacity-60',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-0 rounded-full transition-colors duration-150 ease-out',
          checked ? 'bg-accent' : 'bg-hair',
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          'absolute left-0.5 top-0.5 h-5 w-5 rounded-full border border-hair bg-bg transition-transform duration-150 ease-out',
          checked ? 'translate-x-5' : '',
        )}
      />
      <input
        type="checkbox"
        aria-label={t('settings.modules.toggle', {
          defaultValue: `Activer ${label}`,
          values: { module: label },
        })}
        className="absolute inset-0 cursor-pointer appearance-none focus:outline-hidden"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={isBusy}
      />
    </div>
  );
}
