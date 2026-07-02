import type { MoodEntryLead, MoodSectionPlacement } from '@nodea/shared';

import { usePreferences } from '@/core/auth/use-preferences';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { SettingsGrid, SettingSelectRow, SettingToggleRow } from '@/ui/dirk/module/SettingRow';

import { moodPositivesPlacement, moodQuestionPlacement } from '../lib/placements';

/**
 * Mood « Paramètre du module » panel body.
 *
 * Reads its persisted defaults from the encrypted preferences blob
 * (`usePreferences`) and writes them back on change:
 *   - `moodChartCollapsed` (absent ⇒ false / frise déployée) seeds the initial
 *     chart-collapse state in `use-mood-filters` and the « rien d'ouvert »
 *     re-expand branch in PrimaryColumn. Applying live is moot here since the
 *     frise is force-collapsed while this panel is open.
 *   - `moodPositivesPlacement` / `moodQuestionPlacement` (both absent ⇒
 *     'accordion') decide where `MoodForm` offers the three positives and the
 *     « question du jour » — in the main questionnaire, in the expandable
 *     drawer, or not at all. The question falls back to the legacy
 *     `moodOfferDailyQuestion` boolean for blobs written before this setting
 *     (resolved in `../lib/placements`).
 *   - `moodEntryLead` (absent ⇒ 'positives') picks which block leads each row
 *     in the entries LIST — a display concern only (`moodEntryOrder`).
 *
 * Rendered as a child of `ModuleSettingsPanel` inside PrimaryColumn's
 * InlinePanel — same posture as `GoalsSettings`.
 */
export default function MoodSettings() {
  const { t } = useI18n();
  const { preferences, setPreferences } = usePreferences();

  const chartCollapsed = preferences.moodChartCollapsed === true;
  const entryLead = preferences.moodEntryLead ?? 'positives';
  const positivesPlacement = moodPositivesPlacement(preferences);
  const questionPlacement = moodQuestionPlacement(preferences);

  const placementOptions: ReadonlyArray<{ value: MoodSectionPlacement; label: string }> = [
    { value: 'form', label: t('mood.settings.placement.form') },
    { value: 'accordion', label: t('mood.settings.placement.accordion') },
    { value: 'off', label: t('mood.settings.placement.off') },
  ];
  const leadOptions: ReadonlyArray<{ value: MoodEntryLead; label: string }> = [
    { value: 'positives', label: t('mood.settings.entryLead.positives') },
    { value: 'comment', label: t('mood.settings.entryLead.comment') },
    { value: 'question', label: t('mood.settings.entryLead.question') },
  ];

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
      <SettingSelectRow
        id="mood-setting-entry-lead"
        label={t('mood.settings.entryLeadLabel')}
        hint={t('mood.settings.entryLeadHint')}
        value={entryLead}
        onChange={(v) => {
          if (v !== entryLead) void setPreferences({ moodEntryLead: v as MoodEntryLead });
        }}
        options={leadOptions}
      />
      <SettingSelectRow
        id="mood-setting-positives-placement"
        label={t('mood.settings.positivesPlacementLabel')}
        hint={t('mood.settings.positivesPlacementHint')}
        value={positivesPlacement}
        onChange={(v) => {
          if (v !== positivesPlacement)
            void setPreferences({ moodPositivesPlacement: v as MoodSectionPlacement });
        }}
        options={placementOptions}
      />
      <SettingSelectRow
        id="mood-setting-question-placement"
        label={t('mood.settings.questionPlacementLabel')}
        hint={t('mood.settings.questionPlacementHint')}
        value={questionPlacement}
        onChange={(v) => {
          if (v !== questionPlacement)
            void setPreferences({ moodQuestionPlacement: v as MoodSectionPlacement });
        }}
        options={placementOptions}
      />
    </SettingsGrid>
  );
}
