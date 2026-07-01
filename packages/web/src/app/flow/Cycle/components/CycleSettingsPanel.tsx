/**
 * The « Paramètre du module » inline panel, mounted inside the module
 * content so it sits UNDER ModuleShell's `ModuleSettingsProvider` (the
 * trigger lives in the sidebar). Reading the context from the page
 * component itself would return null — the page renders ModuleShell, so
 * it's above the provider. Same posture as Mood's PrimaryColumn.
 */
import InlinePanel from '@/ui/dirk/forms/InlinePanel';
import ModuleSettingsPanel from '@/ui/dirk/module/ModuleSettingsPanel';
import { useModuleSettings } from '@/ui/dirk/module/module-settings-context';
import CycleSettings from './CycleSettings';

export default function CycleSettingsPanel() {
  const settings = useModuleSettings();
  return (
    <InlinePanel open={!!settings?.open}>
      <ModuleSettingsPanel onClose={() => settings?.close()}>
        <CycleSettings />
      </ModuleSettingsPanel>
    </InlinePanel>
  );
}
