import { usePreferences } from '@/core/auth/use-preferences';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { SettingSelectRow, SettingsGrid, SettingToggleRow } from '@/ui/dirk/module/SettingRow';

import { useGoalsFilters } from '../context';

/**
 * Goals « Paramètre du module » panel body.
 *
 * Each control reads its persisted default from the encrypted preferences blob
 * (`usePreferences`) and writes it back on change. Grouping + sort ALSO apply to
 * the live view at once (the filters-context setters) so the change is visible
 * immediately; the new-goal status + year-prefill only affect the next composer
 * open, so they merely persist. Rendered inside `GoalsProvider` (it's a child of
 * PrimaryColumn) so `useGoalsFilters` resolves.
 */
export default function GoalsSettings() {
  const { t } = useI18n();
  const { preferences, setPreferences } = usePreferences();
  const { setGroupBy, setSortBy } = useGoalsFilters();

  const groupBy = preferences.goalsGroupBy === 'thread' ? 'thread' : 'year';
  const sortBy =
    preferences.goalsSortBy === 'updated' || preferences.goalsSortBy === 'alpha'
      ? preferences.goalsSortBy
      : 'date';
  const defaultStatus = preferences.goalsDefaultStatus === 'wip' ? 'wip' : 'open';
  const prefillYear = preferences.goalsPrefillYear === true;

  return (
    <SettingsGrid>
      <SettingSelectRow
        id="goals-setting-groupby"
        label={t('goals.settings.groupByLabel')}
        value={groupBy}
        onChange={(v) => {
          const next = v === 'thread' ? 'thread' : 'year';
          setGroupBy(next);
          if (next !== groupBy) void setPreferences({ goalsGroupBy: next });
        }}
        options={[
          { value: 'year', label: t('goals.side.groupByYear') },
          { value: 'thread', label: t('goals.side.groupByThread') },
        ]}
      />
      <SettingSelectRow
        id="goals-setting-sortby"
        label={t('goals.settings.sortByLabel')}
        value={sortBy}
        onChange={(v) => {
          const next = v === 'updated' || v === 'alpha' ? v : 'date';
          setSortBy(next);
          if (next !== sortBy) void setPreferences({ goalsSortBy: next });
        }}
        options={[
          { value: 'date', label: t('goals.sort.date') },
          { value: 'updated', label: t('goals.sort.updated') },
          { value: 'alpha', label: t('goals.sort.alpha') },
        ]}
      />
      <SettingSelectRow
        id="goals-setting-status"
        label={t('goals.settings.defaultStatusLabel')}
        value={defaultStatus}
        onChange={(v) => {
          const next = v === 'wip' ? 'wip' : 'open';
          if (next !== defaultStatus) void setPreferences({ goalsDefaultStatus: next });
        }}
        options={[
          { value: 'open', label: t('goals.status.title.open') },
          { value: 'wip', label: t('goals.status.title.wip') },
        ]}
      />
      <SettingToggleRow
        id="goals-setting-prefill-year"
        label={t('goals.settings.prefillYearLabel')}
        hint={t('goals.settings.prefillYearHint')}
        checked={prefillYear}
        onChange={(v) => {
          if (v !== prefillYear) void setPreferences({ goalsPrefillYear: v });
        }}
      />
    </SettingsGrid>
  );
}
