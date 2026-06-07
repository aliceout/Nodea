/**
 * HRT · Administration — the dose / injection log (catalog-only).
 *
 * Loads the `hrt-admin-logs` collection plus the product catalog. Each
 * log references a product by name ; this view joins them live so rows
 * and the chart can show molecule / route / concentration. Grouping,
 * filtering and the mg-equivalent dose series are pure helpers in
 * `lib/admin-data` ; a single row is `AdminLogRow`. The filter +
 * chart follow the MOLECULE, not the product. See `docs/Modules/HRT.md`.
 */
import { useMemo, useState } from 'react';

import type { HrtAdminLogPayload, HrtProductPayload } from '@nodea/shared';
import Button from '@/ui/atoms/dirk/Button';
import Select from '@/ui/atoms/dirk/Select';

import AdminLogForm, { type ProductOption } from '../components/AdminLogForm';
import AdminLogRow from '../components/AdminLogRow';
import DateRangeFilter from '../components/DateRangeFilter';
import LabChart from '../components/LabChart';
import { useHrtAdminLogs, type AdminLogEntry } from '../hooks/use-admin-logs';
import { useHrtProducts } from '../hooks/use-products';
import {
  buildDoseSeries,
  distinctMolecules,
  moleculeOf,
} from '../lib/admin-data';
import { EMPTY_RANGE, inDateRange, type DateRange } from '../lib/date-range';
import { formatLogDate } from '../lib/labels';

export default function AdministrationView() {
  const { entries, load, ready, create, update, remove } = useHrtAdminLogs();
  const { entries: productEntries, create: createProduct } = useHrtProducts();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<AdminLogEntry | null>(null);
  const [chartSel, setChartSel] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_RANGE);

  const formOpen = adding || editing !== null;

  // Catalog → picker options + a name→product map for the live join.
  const productOptions = useMemo<ProductOption[]>(
    () =>
      productEntries.map((p) => {
        const base: ProductOption = {
          name: p.payload.name,
          medication: p.payload.medication,
          category: p.payload.category,
          unit: p.payload.unit,
        };
        return typeof p.payload.concentration === 'number'
          ? { ...base, concentration: p.payload.concentration }
          : base;
      }),
    [productEntries],
  );
  const productByName = useMemo(() => {
    const m = new Map<string, HrtProductPayload>();
    for (const p of productEntries) m.set(p.payload.name, p.payload);
    return m;
  }, [productEntries]);

  // The molecule picker is also a filter : a specific molecule narrows
  // the list (and charts it) ; « Toutes » shows every dose and hides the
  // chart. A lone molecule charts without a picker.
  const molecules = useMemo(
    () => distinctMolecules(entries, productByName),
    [entries, productByName],
  );
  const filterMolecule =
    chartSel && molecules.some((m) => m.name === chartSel) ? chartSel : null;
  const chartMolecule =
    filterMolecule ?? (molecules.length === 1 ? (molecules[0]?.name ?? null) : null);

  // Date range narrows both the list and the chart ; the molecule
  // options stay computed from all entries so the picker doesn't flicker.
  const dateFiltered = useMemo(
    () => entries.filter((e) => inDateRange(e.payload.date, dateRange)),
    [entries, dateRange],
  );

  const series = useMemo(
    () =>
      chartMolecule
        ? buildDoseSeries(dateFiltered, chartMolecule, productByName)
        : { points: [], skipped: 0 },
    [dateFiltered, chartMolecule, productByName],
  );

  const listEntries = filterMolecule
    ? dateFiltered.filter((e) => moleculeOf(e, productByName) === filterMolecule)
    : dateFiltered;
  const showChart =
    (molecules.length === 1 || filterMolecule != null) &&
    chartMolecule != null &&
    series.points.length > 0;

  function closeForm() {
    setAdding(false);
    setEditing(null);
  }

  async function onSubmit(payload: HrtAdminLogPayload, id?: string): Promise<void> {
    if (id) await update(id, payload);
    else await create(payload);
  }

  async function onCreateProduct(payload: HrtProductPayload): Promise<void> {
    await createProduct(payload);
  }

  async function onDelete(entry: AdminLogEntry): Promise<void> {
    const label = `${entry.payload.product} — ${formatLogDate(entry.payload.date)}`;
    if (!window.confirm(`Supprimer cette prise ?\n${label}`)) return;
    await remove(entry.id);
  }

  return (
    <section className="min-w-0">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-medium text-ink">Journal de prises</h2>
        {!formOpen ? (
          <Button variant="primary" size="sm" onClick={() => setAdding(true)} disabled={!ready}>
            + Nouvelle prise
          </Button>
        ) : null}
      </div>

      {formOpen ? (
        <div className="mb-5">
          <AdminLogForm
            {...(editing ? { initial: editing } : {})}
            products={productOptions}
            onSubmit={onSubmit}
            onCreateProduct={onCreateProduct}
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
            Aucune prise enregistrée. Ajoute ta première avec « + Nouvelle prise ».
          </p>
        </div>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {molecules.length > 1 ? (
              <Select
                aria-label="Filtrer par molécule"
                borderless
                className="w-auto"
                value={chartSel ?? ''}
                onChange={(e) => setChartSel(e.target.value === '' ? null : e.target.value)}
              >
                <option value="">Toutes les molécules</option>
                {molecules.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name} ({m.count})
                  </option>
                ))}
              </Select>
            ) : null}
            <DateRangeFilter onChange={setDateRange} />
          </div>
          {showChart && chartMolecule ? (
            <div className="mb-6">
              <LabChart points={series.points} unit="mg" label={chartMolecule} />
            </div>
          ) : null}
          <ul className="flex flex-col">
            {listEntries.map((entry) => (
              <AdminLogRow
                key={entry.id}
                entry={entry}
                product={productByName.get(entry.payload.product)}
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
    </section>
  );
}
