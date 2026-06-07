/**
 * HRT · LabFilterBar — the toolbar above the Analyses chart : marker
 * filter, display-unit toggle, and the opt-in target-band goal Select.
 *
 * Stateless / controlled : the parent view owns the selection state and
 * the derived marker/unit lists. Factored out so `LabsView` keeps to
 * orchestration ; each Select only renders when it has a real choice to
 * offer (≥ 2 markers, ≥ 2 units, a charted marker for the goal). The
 * goal Select is right-aligned (`ml-auto`) — target bands are off by
 * default and opting in is a deliberate, separate action.
 */
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
}: LabFilterBarProps) {
  if (markers.length <= 1 && !chartMarker) return null;

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      {markers.length > 1 ? (
        <Select
          aria-label="Filtrer par marqueur"
          className="w-auto"
          value={markerSel ?? ''}
          onChange={(e) => onMarkerChange(e.target.value === '' ? null : e.target.value)}
        >
          <option value="">Tous les marqueurs</option>
          {markers.map((m) => (
            <option key={m.key} value={m.key}>
              {markerLabel(m.key)} ({m.count})
            </option>
          ))}
        </Select>
      ) : null}
      {chartMarker && units.length > 1 ? (
        <Select
          aria-label="Unité d’affichage"
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
      {chartMarker ? (
        <Select
          aria-label="Plages cibles"
          className="ml-auto w-auto"
          value={goal ?? ''}
          onChange={(e) => onGoalChange(e.target.value === '' ? null : (e.target.value as HrtGoal))}
        >
          <option value="">Cibles : aucune</option>
          <option value="feminizing">Cibles : féminisant</option>
          <option value="masculinizing">Cibles : masculinisant</option>
        </Select>
      ) : null}
    </div>
  );
}
