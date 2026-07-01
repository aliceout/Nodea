/**
 * Cycle « Paramètre du module » panel body — the hormone-curve reference
 * profile (`cycleHormoneProfile`, absent ⇒ 'natal') : off / natal cycle /
 * masculinising HRT. Same posture as `MoodSettings` : reads/writes the
 * encrypted preferences blob via `usePreferences`, rendered inside
 * `ModuleSettingsPanel`.
 */
import type { CycleHormoneProfile } from '@nodea/shared';
import { usePreferences } from '@/core/auth/use-preferences';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { SettingsGrid, SettingSelectRow } from '@/ui/dirk/module/SettingRow';

const PROFILES: ReadonlyArray<CycleHormoneProfile> = ['off', 'natal', 'masc'];

export default function CycleSettings() {
  const { t } = useI18n();
  const { preferences, setPreferences } = usePreferences();
  const profile = preferences.cycleHormoneProfile ?? 'natal';

  return (
    <SettingsGrid>
      <SettingSelectRow
        id="cycle-setting-hormone-profile"
        label={t('cycle.settings.hormoneProfileLabel')}
        hint={t('cycle.settings.hormoneProfileHint')}
        value={profile}
        onChange={(v) => {
          if (v !== profile) void setPreferences({ cycleHormoneProfile: v as CycleHormoneProfile });
        }}
        options={PROFILES.map((p) => ({ value: p, label: t(`cycle.settings.profile.${p}`) }))}
      />
    </SettingsGrid>
  );
}
