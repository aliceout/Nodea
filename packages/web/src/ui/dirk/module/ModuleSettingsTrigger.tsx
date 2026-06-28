import { AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';

import { useModuleSettings } from './module-settings-context';

/**
 * « Paramètre du module » trigger — the mini settings link that toggles the
 * inline `ModuleSettingsPanel` through the shell's `useModuleSettings` context.
 *
 * ONE source for the link across every entry point: the right-column shell
 * (`ModuleSidebar`) for the four sidebar modules, and inline in the content for
 * the two without a sidebar (HRT Synthèse top, Home greeting row). Positioning
 * is the caller's job (`className`); the visual + toggle wiring live here so the
 * three call sites can't drift apart. `label` overrides the default text for
 * surfaces that aren't a module (Home → « Paramètre de la page d'accueil »).
 */
export default function ModuleSettingsTrigger({
  className,
  label,
}: {
  className?: string;
  label?: string;
}) {
  const { t } = useI18n();
  const settings = useModuleSettings();
  return (
    <button
      type="button"
      onClick={() => settings?.toggle()}
      aria-expanded={settings?.open ?? false}
      className={cn(
        'flex items-center gap-2 text-[12px] font-medium text-muted transition-colors hover:text-ink focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        className,
      )}
    >
      <AdjustmentsHorizontalIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {label ?? t('modules.moduleSettings')}
    </button>
  );
}
