/**
 * HRT · Analyses — lab results + time-series chart.
 *
 * Loads the `hrt-lab-results` collection, lets the user pick a marker
 * (and a display unit when several are in play), plots it with the
 * hand-rolled `LabChart`, and manages an inline create/edit form + a
 * results list. Unit conversion is delegated to the shared marker
 * presets via `lib/chart-data`. See `docs/Modules/HRT.md`.
 *
 * The medical disclaimer is permanent — the target bands (off by
 * default, opt-in via the goal Select) are informational guidance
 * (WPATH / Endocrine Society), never a recommendation.
 */
import { useMemo, useState } from 'react';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

import {
  convertFromCanonical,
  findMarker,
  targetFor,
  type HrtGoal,
  type HrtLabResultPayload,
} from '@nodea/shared';
import Button from '@/ui/atoms/dirk/Button';
import Select from '@/ui/atoms/dirk/Select';

import LabChart from '../components/LabChart';
import LabResultForm from '../components/LabResultForm';
import { useHrtLabResults, type LabResultEntry } from '../data/use-lab-results';
import {
  buildChartSeries,
  defaultUnitForMarker,
  distinctMarkers,
  unitsForMarker,
} from '../lib/chart-data';
import { HRT_DRAW_CONTEXT_LABELS, formatLogDate, markerLabel } from '../lib/labels';

export default function LabsView() {
  const { entries, load, ready, create, update, remove } = useHrtLabResults();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<LabResultEntry | null>(null);
  const [markerSel, setMarkerSel] = useState<string | null>(null);
  const [unitSel, setUnitSel] = useState<string | null>(null);
  // Target bands are off by default — opting in picks a goal.
  const [goal, setGoal] = useState<HrtGoal | null>(null);

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

  const series = useMemo(
    () =>
      chartMarker
        ? buildChartSeries(entries, chartMarker, unit)
        : { points: [], skipped: 0 },
    [entries, chartMarker, unit],
  );

  // Informational target band for the chart, converted to the display
  // unit. `undefined` when no goal is picked or the marker has none.
  const chartTarget = useMemo(() => {
    if (!goal || !chartMarker) return undefined;
    const preset = findMarker(chartMarker);
    if (!preset) return undefined;
    const t = targetFor(preset, goal);
    if (!t) return undefined;
    const conv = (v: number | undefined): number | undefined => {
      if (v == null) return undefined;
      const c = convertFromCanonical(preset, v, unit);
      return c == null ? undefined : c;
    };
    const min = conv(t.min);
    const max = conv(t.max);
    if (min == null && max == null) return undefined;
    return { ...(min != null ? { min } : {}), ...(max != null ? { max } : {}) };
  }, [goal, chartMarker, unit]);

  const targetText = useMemo(() => {
    if (!chartTarget) return null;
    const f = (v: number) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10);
    const { min, max } = chartTarget;
    const range =
      min != null && max != null
        ? `${f(min)}–${f(max)}`
        : max != null
          ? `≤ ${f(max)}`
          : min != null
            ? `≥ ${f(min)}`
            : '';
    return `Cible indicative : ${range} ${unit}`;
  }, [chartTarget, unit]);

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
  // the chart's left-to-right time axis). Filtered to the active marker
  // when one is picked.
  const listEntries = useMemo(() => {
    const base = activeMarker
      ? entries.filter((e) => e.payload.marker === activeMarker)
      : entries;
    return [...base].reverse();
  }, [entries, activeMarker]);

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
          {markers.length > 1 || chartMarker ? (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {markers.length > 1 ? (
                <Select
                  aria-label="Filtrer par marqueur"
                  className="w-auto"
                  value={markerSel ?? ''}
                  onChange={(e) => {
                    setMarkerSel(e.target.value === '' ? null : e.target.value);
                    setUnitSel(null);
                  }}
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
                  onChange={(e) => setUnitSel(e.target.value)}
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
                  onChange={(e) =>
                    setGoal(e.target.value === '' ? null : (e.target.value as HrtGoal))
                  }
                >
                  <option value="">Cibles : aucune</option>
                  <option value="feminizing">Cibles : féminisant</option>
                  <option value="masculinizing">Cibles : masculinisant</option>
                </Select>
              ) : null}
            </div>
          ) : null}
          {chartMarker ? (
            <div className="mb-6">
              <LabChart
                points={series.points}
                unit={unit}
                label={markerLabel(chartMarker)}
                {...(chartTarget ? { target: chartTarget } : {})}
              />
              {targetText ? (
                <p className="mt-1 text-[11px] text-muted-soft">
                  {targetText} — informatif, pas un avis médical.
                </p>
              ) : goal ? (
                <p className="mt-1 text-[11px] text-muted-soft">
                  Pas de cible définie pour ce marqueur.
                </p>
              ) : null}
              {series.skipped > 0 ? (
                <p className="mt-1 text-[11px] text-muted-soft">
                  {series.skipped} résultat{series.skipped > 1 ? 's' : ''} non convertible
                  {series.skipped > 1 ? 's' : ''} en {unit} — masqué
                  {series.skipped > 1 ? 's' : ''} du graphique.
                </p>
              ) : null}
            </div>
          ) : null}

          <ul className="flex flex-col">
            {listEntries.map((entry) => (
              <li
                key={entry.id}
                className="group flex items-start gap-4 border-b border-hair py-3"
              >
                <span className="w-[112px] shrink-0 text-[12px] tabular-nums text-muted">
                  {formatLogDate(entry.payload.date)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-ink">
                    {markerLabel(entry.payload.marker)}
                    <span className="ml-2 font-normal text-muted tabular-nums">
                      {entry.payload.value} {entry.payload.unit}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted">
                    {entry.payload.context !== 'unknown'
                      ? HRT_DRAW_CONTEXT_LABELS[entry.payload.context]
                      : null}
                    {entry.payload.context !== 'unknown' && entry.payload.lab ? ' · ' : ''}
                    {entry.payload.lab}
                  </p>
                  {entry.payload.notes ? (
                    <p className="mt-0.5 text-[12px] text-muted-soft">{entry.payload.notes}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    aria-label="Modifier"
                    onClick={() => {
                      setAdding(false);
                      setEditing(entry);
                    }}
                  >
                    <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="danger-ghost"
                    size="sm"
                    iconOnly
                    aria-label="Supprimer"
                    onClick={() => void onDelete(entry)}
                  >
                    <TrashIcon className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </li>
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
