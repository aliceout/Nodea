/**
 * HRT · Administration — the dose / injection log (catalog-only).
 *
 * Loads the `hrt-admin-logs` collection plus the product catalog. Each
 * log references a product by name ; this view joins them live for
 * display — molecule / route / unit / concentration all come from the
 * product, and a mL dose shows its mg-equivalent
 * (`dose × product.concentration`). See `docs/Modules/HRT.md`.
 */
import { useMemo, useState } from 'react';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

import type { HrtAdminLogPayload, HrtProductPayload } from '@nodea/shared';
import Button from '@/ui/atoms/dirk/Button';
import Select from '@/ui/atoms/dirk/Select';

import AdminLogForm, { type ProductOption } from '../components/AdminLogForm';
import LabChart, { type ChartPoint } from '../components/LabChart';
import { useHrtAdminLogs, type AdminLogEntry } from '../data/use-admin-logs';
import { useHrtProducts } from '../data/use-products';
import { HRT_CATEGORY_LABELS, HRT_ROUTE_LABELS, formatLogDate } from '../lib/labels';

export default function AdministrationView() {
  const { entries, load, ready, create, update, remove } = useHrtAdminLogs();
  const { entries: productEntries, create: createProduct } = useHrtProducts();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<AdminLogEntry | null>(null);
  const [chartSel, setChartSel] = useState<string | null>(null);

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

  // Dose-over-time chart : pick a product (most-logged first) and plot
  // each intake. Volume doses (mL) with a known concentration are
  // plotted in mg so the curve is comparable across products.
  const loggedProducts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) {
      counts.set(e.payload.product, (counts.get(e.payload.product) ?? 0) + 1);
    }
    return Array.from(counts, ([name, count]) => ({ name, count })).sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    );
  }, [entries]);
  const chartProduct =
    chartSel && loggedProducts.some((p) => p.name === chartSel)
      ? chartSel
      : (loggedProducts[0]?.name ?? null);
  const chartSeries = useMemo(() => {
    if (!chartProduct) return { points: [] as ChartPoint[], unit: '' };
    const prod = productByName.get(chartProduct);
    const useMg = prod?.unit === 'mL' && typeof prod.concentration === 'number';
    const unit = useMg ? 'mg' : (prod?.unit ?? '');
    const points: ChartPoint[] = entries
      .filter((e) => e.payload.product === chartProduct)
      .map((e) => ({
        dateIso: e.payload.date,
        value: useMg ? e.payload.dose * (prod!.concentration as number) : e.payload.dose,
        context: 'unknown' as const,
      }))
      .sort((a, b) => a.dateIso.localeCompare(b.dateIso));
    return { points, unit };
  }, [entries, chartProduct, productByName]);
  const chartMed = chartProduct ? productByName.get(chartProduct)?.medication : undefined;
  const chartLabel = chartProduct
    ? `${chartProduct}${chartMed ? ` · ${chartMed}` : ''}`
    : '';

  // The product picker is also a filter : a specific product narrows the
  // list below (and the chart) ; « Tous » (chartSel = null) shows every
  // entry while the chart falls back to the most-logged product.
  const filterProduct =
    chartSel && loggedProducts.some((p) => p.name === chartSel) ? chartSel : null;
  const listEntries = filterProduct
    ? entries.filter((e) => e.payload.product === filterProduct)
    : entries;
  // Chart shows for a specific product only ; « Tous » hides it. A lone
  // product needs no picker, so it charts directly.
  const showChart =
    (loggedProducts.length === 1 || filterProduct != null) && chartProduct != null;

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
          {loggedProducts.length > 1 ? (
            <div className="mb-2">
              <Select
                aria-label="Filtrer par produit"
                className="w-auto"
                value={chartSel ?? ''}
                onChange={(e) => setChartSel(e.target.value === '' ? null : e.target.value)}
              >
                <option value="">Tous les produits</option>
                {loggedProducts.map((p) => {
                  const med = productByName.get(p.name)?.medication;
                  return (
                    <option key={p.name} value={p.name}>
                      {p.name}
                      {med ? ` · ${med}` : ''} ({p.count})
                    </option>
                  );
                })}
              </Select>
            </div>
          ) : null}
          {showChart ? (
            <div className="mb-6">
              <LabChart points={chartSeries.points} unit={chartSeries.unit} label={chartLabel} />
            </div>
          ) : null}
          <ul className="flex flex-col">
            {listEntries.map((entry) => {
              const product = productByName.get(entry.payload.product);
            const unit = product?.unit ?? '';
            const mgEq =
              unit === 'mL' && typeof product?.concentration === 'number'
                ? Math.round(entry.payload.dose * product.concentration * 10) / 10
                : null;
            return (
              <li
                key={entry.id}
                className="group flex items-start gap-4 border-b border-hair py-3"
              >
                <span className="w-[112px] shrink-0 text-[12px] tabular-nums text-muted">
                  {formatLogDate(entry.payload.date)}
                  {entry.payload.time ? (
                    <span className="block text-[11px] text-muted-soft">{entry.payload.time}</span>
                  ) : null}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-ink">
                    {entry.payload.product}
                    {!product ? (
                      <span className="ml-1 text-[11px] text-muted-soft">(produit supprimé)</span>
                    ) : null}
                    <span className="ml-2 font-normal text-muted">
                      {entry.payload.dose}
                      {unit ? ` ${unit}` : ''}
                      {mgEq != null ? ` ≈ ${mgEq} mg` : ''}
                    </span>
                  </p>
                  {product ? (
                    <p className="mt-0.5 text-[12px] text-muted">
                      {product.medication ? `${product.medication} · ` : ''}
                      {HRT_CATEGORY_LABELS[product.category]} ·{' '}
                      {HRT_ROUTE_LABELS[product.route]}
                      {typeof product.concentration === 'number'
                        ? ` · ${product.concentration} mg/mL`
                        : ''}
                    </p>
                  ) : null}
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
            );
          })}
          </ul>
        </>
      )}
    </section>
  );
}
