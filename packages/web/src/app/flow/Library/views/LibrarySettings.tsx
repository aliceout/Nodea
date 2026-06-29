import { usePreferences } from '@/core/auth/use-preferences';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { SEARCH_LANGUAGES } from '@/ui/dirk/forms/constants';
import { SettingSelectRow, SettingsGrid } from '@/ui/dirk/module/SettingRow';

import { LIBRARY_VIEW_MODES, useLibraryFilters } from '../context';
import { LIBRARY_GROUP_BY_VALUES, type LibraryGroupBy } from '../lib/grouping';
import type { LibraryViewMode } from '../state/use-library-filters';

/**
 * Library « Paramètre du module » panel body.
 *
 * WHAT  The three persisted defaults the catalogue + add-book form open on:
 *       the default grouping axis, the status pre-selected for a new book, and
 *       the lookup search language. Each reads its default from the encrypted
 *       preferences blob (`usePreferences`) and writes back on change.
 * WHERE `Library/views/`, mounted inside `<ModuleSettingsPanel>` by
 *       `PrimaryColumn`. Rendered under `LibraryProvider` (it's a child of
 *       PrimaryColumn) so `useLibraryFilters` resolves.
 * NOTE  Grouping ALSO applies to the live view at once (the filters-context
 *       `setGroupBy`) so the change is visible immediately ; the default status
 *       + search language only affect the next add-book form open, so they
 *       merely persist. « Seed, never lock » — the sidebar chips + the form's
 *       own `<select>` still override per session.
 */
export default function LibrarySettings() {
  const { t, language } = useI18n();
  const { preferences, setPreferences } = usePreferences();
  const { groupBy, setGroupBy, viewMode, setViewMode } = useLibraryFilters();

  // Default add-book status — absent ⇒ 'planned' (the form's current default).
  const defaultStatus =
    preferences.libraryDefaultStatus === 'in_progress' ||
    preferences.libraryDefaultStatus === 'finished' ||
    preferences.libraryDefaultStatus === 'abandoned'
      ? preferences.libraryDefaultStatus
      : 'planned';

  // Default lookup search language — absent ⇒ the app UI language (the form's
  // current fallback). Fall back to 'fr' if the app language isn't one of the
  // search options. Clamp to the SEARCH_LANGUAGES set defensively.
  const appLangFallback = SEARCH_LANGUAGES.some((l) => l.code === language)
    ? language
    : 'fr';
  const searchLang =
    preferences.librarySearchLang &&
    SEARCH_LANGUAGES.some((l) => l.code === preferences.librarySearchLang)
      ? preferences.librarySearchLang
      : appLangFallback;

  return (
    <SettingsGrid>
      <SettingSelectRow
        id="library-setting-groupby"
        label={t('library.settings.groupByLabel')}
        value={groupBy}
        onChange={(v) => {
          const next = (LIBRARY_GROUP_BY_VALUES as readonly string[]).includes(v)
            ? (v as LibraryGroupBy)
            : 'status';
          setGroupBy(next);
          if (next !== groupBy) void setPreferences({ libraryDefaultGroupBy: next });
        }}
        options={LIBRARY_GROUP_BY_VALUES.map((value) => ({
          value,
          label: t(`library.groupByOptions.${value}`),
        }))}
      />
      <SettingSelectRow
        id="library-setting-view"
        label={t('library.settings.defaultViewLabel')}
        value={viewMode}
        onChange={(v) => {
          if ((LIBRARY_VIEW_MODES as readonly string[]).includes(v)) {
            setViewMode(v as LibraryViewMode);
          }
        }}
        options={LIBRARY_VIEW_MODES.map((value) => ({
          value,
          label: t(`library.viewMode.${value}`),
        }))}
      />
      <SettingSelectRow
        id="library-setting-status"
        label={t('library.settings.defaultStatusLabel')}
        value={defaultStatus}
        onChange={(v) => {
          const next =
            v === 'in_progress' || v === 'finished' || v === 'abandoned'
              ? v
              : 'planned';
          if (next !== defaultStatus) void setPreferences({ libraryDefaultStatus: next });
        }}
        options={[
          { value: 'planned', label: t('library.status.planned') },
          { value: 'in_progress', label: t('library.status.in_progress') },
          { value: 'finished', label: t('library.status.finished') },
          { value: 'abandoned', label: t('library.status.abandoned') },
        ]}
      />
      <SettingSelectRow
        id="library-setting-search-lang"
        label={t('library.settings.searchLangLabel')}
        hint={t('library.settings.searchLangHint')}
        value={searchLang}
        onChange={(v) => {
          if (!SEARCH_LANGUAGES.some((l) => l.code === v)) return;
          if (v !== preferences.librarySearchLang) void setPreferences({ librarySearchLang: v });
        }}
        options={SEARCH_LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
      />
    </SettingsGrid>
  );
}
