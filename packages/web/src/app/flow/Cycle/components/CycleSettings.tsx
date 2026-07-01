/**
 * Cycle « Paramètre du module » panel body — one toggle for the
 * indicative hormone-curve band (`cycleShowHormones`, absent ⇒ shown).
 * Same posture as `MoodSettings` : reads/writes the encrypted
 * preferences blob via `usePreferences`, rendered inside
 * `ModuleSettingsPanel`.
 */
import { usePreferences } from '@/core/auth/use-preferences';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { SettingsGrid, SettingToggleRow } from '@/ui/dirk/module/SettingRow';

export default function CycleSettings() {
  const { t } = useI18n();
  const { preferences, setPreferences } = usePreferences();
  const showHormones = preferences.cycleShowHormones !== false;

  return (
    <SettingsGrid>
      <SettingToggleRow
        id="cycle-setting-hormones"
        label={t('cycle.settings.hormonesLabel')}
        hint={t('cycle.settings.hormonesHint')}
        checked={showHormones}
        onChange={(v) => {
          if (v !== showHormones) void setPreferences({ cycleShowHormones: v });
        }}
      />
    </SettingsGrid>
  );
}
