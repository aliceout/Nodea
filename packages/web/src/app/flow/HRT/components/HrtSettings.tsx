import { usePreferences } from '@/core/auth/use-preferences';
import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { SettingSelectRow, SettingsGrid } from '@/ui/dirk/module/SettingRow';

import type { MoleculeCount } from '../lib/admin-data';

/**
 * HRT « Paramètre du module » panel body.
 *
 * WHAT  The settings controls for the HRT module: the Synthèse dose-chart
 *       default molecule, the Analyses default target-band goal, and the
 *       default date-range period for the Administration / Analyses lists.
 * WHERE Mounted inside `SummaryView`'s `<ModuleSettingsPanel>` — so the
 *       molecule control can apply LIVE to the dose chart on that same view
 *       (`onSelectMolecule` is the chart picker's setter). The goal + date-range
 *       defaults only seed the NEXT mount of LabsView / the lists, so they merely
 *       persist (no live setter is reachable from here).
 * NOTE  Every setting is a DEFAULT seed read at mount + clamped — the live
 *       on-screen controls still override per session (« seed, never lock »,
 *       mirrors Goals). HRT prefs are health-sensitive ⇒ they ride the encrypted
 *       preferences blob only, never plaintext. The per-marker display unit
 *       (`hrtUnitByMarker`) is sticky and handled entirely in LabsView, so it has
 *       no row here (a dynamic per-marker grid would be awkward).
 */
interface HrtSettingsProps {
  /** Molecules with logged doses (most-logged first) — the chart picker's
   *  options, computed by SummaryView. */
  molecules: ReadonlyArray<MoleculeCount>;
  /** The molecule currently driving the dose chart (resolved default or the
   *  user's live pick). */
  activeMolecule: string | null;
  /** Live setter for the dose-chart molecule (SummaryView's `setSelectedMolecule`)
   *  — lets the default apply immediately on this view. */
  onSelectMolecule: (next: string) => void;
}

export default function HrtSettings({
  molecules,
  activeMolecule,
  onSelectMolecule,
}: HrtSettingsProps) {
  const { t } = useI18n();
  const { preferences, setPreferences } = usePreferences();

  const goal =
    preferences.hrtDefaultTargetGoal === 'feminizing' ||
    preferences.hrtDefaultTargetGoal === 'masculinizing'
      ? preferences.hrtDefaultTargetGoal
      : '';

  const dateRange =
    preferences.hrtDefaultDateRange === '30d' ||
    preferences.hrtDefaultDateRange === '3m' ||
    preferences.hrtDefaultDateRange === '6m' ||
    preferences.hrtDefaultDateRange === '12m'
      ? preferences.hrtDefaultDateRange
      : 'all';

  return (
    <SettingsGrid>
      {molecules.length > 0 ? (
        <SettingSelectRow
          id="hrt-setting-molecule"
          label={t('hrt.settings.defaultMoleculeLabel')}
          value={activeMolecule ?? (molecules[0]?.name ?? '')}
          onChange={(v) => {
            onSelectMolecule(v);
            const cur = useNodeaStore.getState().preferences.hrtDefaultMolecule;
            if (v !== cur) void setPreferences({ hrtDefaultMolecule: v });
          }}
          options={molecules.map((m) => ({ value: m.name, label: m.name }))}
        />
      ) : null}
      <SettingSelectRow
        id="hrt-setting-goal"
        label={t('hrt.settings.defaultTargetGoalLabel')}
        value={goal}
        onChange={(v) => {
          // Empty ⇒ undefined drops the key from the blob → « bands off », the
          // current opt-in-only default (zero regression when absent).
          const next: 'feminizing' | 'masculinizing' | undefined =
            v === 'feminizing' || v === 'masculinizing' ? v : undefined;
          if (next !== preferences.hrtDefaultTargetGoal) {
            void setPreferences({ hrtDefaultTargetGoal: next });
          }
        }}
        options={[
          { value: '', label: t('hrt.labs.goalNone') },
          { value: 'feminizing', label: t('hrt.labs.goalFeminizing') },
          { value: 'masculinizing', label: t('hrt.labs.goalMasculinizing') },
        ]}
      />
      <SettingSelectRow
        id="hrt-setting-daterange"
        label={t('hrt.settings.defaultDateRangeLabel')}
        value={dateRange}
        onChange={(v) => {
          const next =
            v === '30d' || v === '3m' || v === '6m' || v === '12m' ? v : 'all';
          if (next !== dateRange) void setPreferences({ hrtDefaultDateRange: next });
        }}
        options={[
          { value: 'all', label: t('hrt.dateRange.all') },
          { value: '30d', label: t('hrt.dateRange.last30Days') },
          { value: '3m', label: t('hrt.dateRange.months3') },
          { value: '6m', label: t('hrt.dateRange.months6') },
          { value: '12m', label: t('hrt.dateRange.months12') },
        ]}
      />
    </SettingsGrid>
  );
}
