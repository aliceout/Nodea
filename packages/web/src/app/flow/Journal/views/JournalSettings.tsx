import { usePreferences } from '@/core/auth/use-preferences';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { SettingSelectRow, SettingsGrid, SettingToggleRow } from '@/ui/dirk/module/SettingRow';

import { useJournalFilters } from '../context';

/**
 * Journal « Paramètre du module » panel body.
 *
 * Each control reads its persisted default from the encrypted preferences blob
 * (`usePreferences`) and writes it back on change. The default grouping ALSO
 * applies to the live view at once (the filters-context `setGroupBy`) so the
 * change is visible immediately; the « Il y a quelques années » toggle only
 * gates the memory panel's render, so it merely persists. Rendered inside the
 * Journal provider (it's a child of PrimaryColumn) so `useJournalFilters`
 * resolves.
 *
 * Defaults reproduce current behaviour when a pref is absent: groupBy ⇒
 * 'month', show-on-this-day ⇒ true — so an untouched preferences blob lands on
 * exactly today's layout (zero regression).
 */
export default function JournalSettings() {
  const { t } = useI18n();
  const { preferences, setPreferences } = usePreferences();
  const { setGroupBy } = useJournalFilters();

  const groupBy = preferences.journalGroupBy === 'thread' ? 'thread' : 'month';
  // Absent ⇒ true (the panel shows by default today); store only the override.
  const showOnThisDay = preferences.journalShowOnThisDay !== false;
  // Absent ⇒ false (frise expanded today); store only the override.
  const chartCollapsed = preferences.journalChartCollapsed === true;

  return (
    <SettingsGrid>
      <SettingSelectRow
        id="journal-setting-groupby"
        label={t('journal.settings.groupByLabel')}
        value={groupBy}
        onChange={(v) => {
          const next = v === 'thread' ? 'thread' : 'month';
          setGroupBy(next);
          if (next !== groupBy) void setPreferences({ journalGroupBy: next });
        }}
        options={[
          { value: 'month', label: t('journal.side.viewByMonth') },
          { value: 'thread', label: t('journal.side.viewByThread') },
        ]}
      />
      <SettingToggleRow
        id="journal-setting-chart-collapsed"
        label={t('journal.settings.chartCollapsedLabel')}
        hint={t('journal.settings.chartCollapsedHint')}
        checked={chartCollapsed}
        onChange={(v) => {
          if (v !== chartCollapsed) void setPreferences({ journalChartCollapsed: v });
        }}
      />
      <SettingToggleRow
        id="journal-setting-on-this-day"
        label={t('journal.settings.showOnThisDayLabel')}
        hint={t('journal.settings.showOnThisDayHint')}
        checked={showOnThisDay}
        onChange={(v) => {
          if (v !== showOnThisDay) void setPreferences({ journalShowOnThisDay: v });
        }}
      />
    </SettingsGrid>
  );
}
