/**
 * HRT · Analyses — lab results + time-series chart (orchestration).
 *
 * Owns the marker / unit / goal / date selection state and wires the
 * pieces : `LabFilterBar` + `DateRangeFilter` (toolbar), `LabChart` +
 * `ChartNotes` (curve + captions), `LabResultRow` (list), `LabResultForm`
 * (create/edit). All derivation lives in pure helpers (`lib/chart-data`,
 * `lib/date-range`). Target bands are opt-in + informational (WPATH /
 * Endocrine Society) ; the disclaimer is permanent. See
 * `docs/Modules/HRT.md`.
 */
import { useMemo, useState } from 'react';

import { type HrtGoal, type HrtLabResultPayload } from '@nodea/shared';
import Button from '@/ui/atoms/dirk/Button';

import ChartNotes from '../components/ChartNotes';
import DateRangeFilter from '../components/DateRangeFilter';
import LabChart from '../components/LabChart';
import LabFilterBar from '../components/LabFilterBar';
import LabResultForm from '../components/LabResultForm';
import LabResultRow from '../components/LabResultRow';
import { useHrtLabResults, type LabResultEntry } from '../hooks/use-lab-results';
import {
  buildChartSeries,
  buildTargetBand,
  defaultUnitForMarker,
  distinctMarkers,
  unitsForMarker,
} from '../lib/chart-data';
import { EMPTY_RANGE, inDateRange, type DateRange } from '../lib/date-range';
import { formatLogDate, markerLabel } from '../lib/labels';

export default function LabsView() {
  const { entries, load, ready, create, update, remove } = useHrtLabResults();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<LabResultEntry | null>(null);
  const [markerSel, setMarkerSel] = useState<string | null>(null);
  const [unitSel, setUnitSel] = useState<string | null>(null);
  // Target bands are off by default — opting in picks a goal.
  const [goal, setGoal] = useState<HrtGoal | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_RANGE);

  const formOpen = adding || editing !== null;

  const markers = useMemo(() => distinctMarkers(entries), [entries]);
  // The picker is also a filter : a specific marker narrows the list +
  // shows the chart ; « Tous » (markerSel null) shows every result and
  // hides the chart. A lone marker charts without a picker.
  const activeMarker =
    markerSel && markers.some((m) => m.key === markerSel) ? markerSel : null;
  const chartMarker =
    activeMarker ?? (markers.length === 1 ? (markers[0]?.key ?? null) : null);

  const units = useMemo(
    () => (chartMarker ? unitsForMarker(entries, chartMarker) : []),
    [entries, chartMarker],
  );
  const unit =
    chartMarker == null
      ? ''
      : unitSel && units.includes(unitSel)
        ? unitSel
        : defaultUnitForMarker(entries, chartMarker);

  // Date range narrows the list + chart (options stay from all entries).
  const dateFiltered = useMemo(
    () => entries.filter((e) => inDateRange(e.payload.date, dateRange)),
    [entries, dateRange],
  );

  const series = useMemo(
    () =>
      chartMarker
        ? buildChartSeries(dateFiltered, chartMarker, unit)
        : { points: [], skipped: 0 },
    [dateFiltered, chartMarker, unit],
  );

  const target = useMemo(
    () => buildTargetBand(chartMarker, goal, unit),
    [chartMarker, goal, unit],
  );

  function closeForm() {
    setAdding(false);
    setEditing(null);
  }

  async function onSubmit(payload: HrtLabResultPayload, id?: string): Promise<void> {
    if (id) await update(id, payload);
    else await create(payload);
  }

  async function onDelete(entry: LabResultEntry): Promise<void> {
    const label = `${markerLabel(entry.payload.marker)} — ${formatLogDate(entry.payload.date)}`;
    if (!window.confirm(`Supprimer ce résultat ?\n${label}`)) return;
    await remove(entry.id);
  }

  // Newest-first for the list (the hook keeps entries oldest-first for
  // the chart's time axis) ; filtered to the active marker when picked.
  const listEntries = useMemo(() => {
    const base = activeMarker
      ? dateFiltered.filter((e) => e.payload.marker === activeMarker)
      : dateFiltered;
    return [...base].reverse();
  }, [dateFiltered, activeMarker]);

  return (
    <section className="min-w-0">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-medium text-ink">Résultats d’analyses</h2>
        {!formOpen ? (
          <Button variant="primary" size="sm" onClick={() => setAdding(true)} disabled={!ready}>
            + Nouveau résultat
          </Button>
        ) : null}
      </div>

      {formOpen ? (
        <div className="mb-5">
          <LabResultForm
            {...(editing ? { initial: editing } : {})}
            onSubmit={onSubmit}
            onClose={closeForm}
          />
        </div>
      ) : null}

      {load.status === 'loading' ? (
        <p className="py-8 text-center text-[13px] text-muted">Chargement…</p>
      ) : load.status === 'error' ? (
        <p className="py-8 text-center text-[13px] text-danger">{load.message}</p>
      ) : entries.length === 0 && !formOpen ? (
        <div className="rounded-md border border-dashed border-hair bg-bg-2 p-8 text-center">
          <p className="text-[13px] text-muted">
            Aucun résultat enregistré. Ajoute le premier avec « + Nouveau résultat ».
          </p>
        </div>
      ) : (
        <>
          <LabFilterBar
            markers={markers}
            markerSel={markerSel}
            onMarkerChange={(key) => {
              setMarkerSel(key);
              setUnitSel(null);
            }}
            chartMarker={chartMarker}
            units={units}
            unit={unit}
            onUnitChange={setUnitSel}
            goal={goal}
            onGoalChange={setGoal}
          >
            <DateRangeFilter onChange={setDateRange} />
          </LabFilterBar>
          {chartMarker ? (
            <div className="mb-6">
              <LabChart
                points={series.points}
                unit={unit}
                label={markerLabel(chartMarker)}
                {...(target.band ? { target: target.band } : {})}
              />
              <ChartNotes
                targetText={target.text ?? null}
                goalActive={goal !== null}
                skipped={series.skipped}
                unit={unit}
              />
            </div>
          ) : null}

          <ul className="flex flex-col">
            {listEntries.map((entry) => (
              <LabResultRow
                key={entry.id}
                entry={entry}
                onEdit={() => {
                  setAdding(false);
                  setEditing(entry);
                }}
                onDelete={() => void onDelete(entry)}
              />
            ))}
          </ul>
        </>
      )}

      <p className="mx-auto mt-6 max-w-md text-center text-[11.5px] leading-relaxed text-muted-soft">
        Outil de suivi personnel — pas un avis médical. Les plages cibles
        sont informatives (WPATH / Endocrine Society) ; discutez-en avec
        votre médecin.
      </p>
    </section>
  );
}
