import { usePreferences } from '@/core/auth/use-preferences';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { SettingsGrid, SettingToggleRow } from '@/ui/dirk/module/SettingRow';

/**
 * Mood « Paramètre du module » panel body.
 *
 * Two toggles read their persisted default from the encrypted preferences blob
 * (`usePreferences`) and write it back on change:
 *   - `moodChartCollapsed` (absent ⇒ false / frise déployée) seeds the initial
 *     chart-collapse state in `use-mood-filters` and the « rien d'ouvert »
 *     re-expand branch in PrimaryColumn. Applying live is moot here since the
 *     frise is force-collapsed while this panel is open.
 *   - `moodOfferDailyQuestion` (absent ⇒ true / question proposée) gates whether
 *     `MoodForm` draws a « question du jour » on create.
 *
 * Rendered as a child of `ModuleSettingsPanel` inside PrimaryColumn's
 * InlinePanel — same posture as `GoalsSettings`.
 */
export default function MoodSettings() {
  const { t } = useI18n();
  const { preferences, setPreferences } = usePreferences();

  const chartCollapsed = preferences.moodChartCollapsed === true;
  const offerDailyQuestion = preferences.moodOfferDailyQuestion !== false;

  return (
    <SettingsGrid>
      <SettingToggleRow
        id="mood-setting-chart-collapsed"
        label={t('mood.settings.chartCollapsedLabel')}
        hint={t('mood.settings.chartCollapsedHint')}
        checked={chartCollapsed}
        onChange={(v) => {
          if (v !== chartCollapsed) void setPreferences({ moodChartCollapsed: v });
        }}
      />
      <SettingToggleRow
        id="mood-setting-offer-daily-question"
        label={t('mood.settings.offerDailyQuestionLabel')}
        hint={t('mood.settings.offerDailyQuestionHint')}
        checked={offerDailyQuestion}
        onChange={(v) => {
          if (v !== offerDailyQuestion)
            void setPreferences({ moodOfferDailyQuestion: v });
        }}
      />
    </SettingsGrid>
  );
}
