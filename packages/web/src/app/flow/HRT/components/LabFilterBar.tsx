/**
 * HRT · LabFilterBar — the toolbar above the Analyses chart : marker
 * filter, display-unit toggle, and the opt-in target-band goal Select.
 *
 * Stateless / controlled : the parent view owns the selection state and
 * the derived marker/unit lists. Factored out so `LabsView` keeps to
 * orchestration ; each Select only renders when it has a real choice to
 * offer (≥ 2 markers, ≥ 2 units, a charted marker for the goal). The
 * goal Select is right-aligned (`ml-auto`) — target bands are off by
 * default and opting in is a deliberate, separate action. `children`
 * (e.g. the date filter) render in the left group, before the goal.
 */
import type { ReactNode } from 'react';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import Select from '@/ui/atoms/dirk/Select';
import type { HrtGoal } from '@nodea/shared';

import type { MarkerCount } from '../lib/chart-data';
import { markerLabel } from '../lib/labels';

interface LabFilterBarProps {
  markers: ReadonlyArray<MarkerCount>;
  markerSel: string | null;
  onMarkerChange: (key: string | null) => void;
  chartMarker: string | null;
  units: ReadonlyArray<string>;
  unit: string;
  onUnitChange: (unit: string) => void;
  goal: HrtGoal | null;
  onGoalChange: (goal: HrtGoal | null) => void;
  children?: ReactNode;
  /** Rendered last, after the right-aligned goal Select — so it sits at
   *  the far right of the bar (e.g. the chart collapse toggle). */
  endSlot?: ReactNode;
}

export default function LabFilterBar({
  markers,
  markerSel,
  onMarkerChange,
  chartMarker,
  units,
  unit,
  onUnitChange,
  goal,
  onGoalChange,
  children,
  endSlot,
}: LabFilterBarProps) {
  const { t } = useI18n();
  if (markers.length <= 1 && !chartMarker) return null;

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      {markers.length > 1 ? (
        <Select
          aria-label={t('hrt.labs.markerFilterAria')}
          borderless
          className="w-auto"
          value={markerSel ?? ''}
          onChange={(e) => onMarkerChange(e.target.value === '' ? null : e.target.value)}
        >
          <option value="">{t('hrt.labs.allMarkers')}</option>
          {markers.map((m) => (
            <option key={m.key} value={m.key}>
              {markerLabel(m.key)} ({m.count})
            </option>
          ))}
        </Select>
      ) : null}
      {chartMarker && units.length > 1 ? (
        <Select
          aria-label={t('hrt.labs.unitAria')}
          borderless
          className="w-auto"
          value={unit}
          onChange={(e) => onUnitChange(e.target.value)}
        >
          {units.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </Select>
      ) : null}
      {children}
      {chartMarker ? (
        <Select
          aria-label={t('hrt.labs.goalAria')}
          borderless
          className="ml-auto w-auto"
          value={goal ?? ''}
          onChange={(e) => onGoalChange(e.target.value === '' ? null : (e.target.value as HrtGoal))}
        >
          <option value="">{t('hrt.labs.goalNone')}</option>
          <option value="feminizing">{t('hrt.labs.goalFeminizing')}</option>
          <option value="masculinizing">{t('hrt.labs.goalMasculinizing')}</option>
        </Select>
      ) : null}
      {endSlot}
    </div>
  );
}
