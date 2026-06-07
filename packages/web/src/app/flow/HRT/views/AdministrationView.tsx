/**
 * HRT · Administration — the dose journal + recurring schedules.
 *
 * Two ways to log a dose : a manual one-off (`AdminLogForm`) or a
 * recurring series (`ScheduleForm`) that materialises real occurrences
 * (see `hooks/use-schedule-materialization`). Orchestration only — the
 * filtered journal (molecule/date filter + chart + list) is
 * `AdminJournal`, the active series are `SchedulesPanel`. Catalog-only :
 * every dose references a product by name. See `docs/Modules/HRT.md`.
 */
import { useMemo, useState } from 'react';

import type {
  HrtAdminLogPayload,
  HrtProductPayload,
  HrtSchedulePayload,
} from '@nodea/shared';
import Button from '@/ui/atoms/dirk/Button';

import AdminJournal from '../components/AdminJournal';
import AdminLogForm, { type ProductOption } from '../components/AdminLogForm';
import ScheduleForm from '../components/ScheduleForm';
import SchedulesPanel from '../components/SchedulesPanel';
import { useHrtAdminLogs, type AdminLogEntry } from '../hooks/use-admin-logs';
import { useHrtProducts } from '../hooks/use-products';
import type { ScheduleEntry, UseHrtSchedules } from '../hooks/use-schedules';
import { formatLogDate, todayIso } from '../lib/labels';

interface AdministrationViewProps {
  /** The single shared schedules instance — owned by `HrtPage` so that
   *  creating a series here triggers the materialisation engine there. */
  schedules: UseHrtSchedules;
}

export default function AdministrationView({ schedules }: AdministrationViewProps) {
  const { entries, load, ready, create, update, remove } = useHrtAdminLogs();
  const { entries: productEntries, create: createProduct } = useHrtProducts();

  const [mode, setMode] = useState<'manual' | 'schedule' | null>(null);
  const [editing, setEditing] = useState<AdminLogEntry | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleEntry | null>(null);
  const formOpen = mode !== null;

  // Catalog → picker options (active only — archived products stay
  // joinable for past doses but aren't offered for new ones) + a
  // name→product map for the live display join (all products).
  const productOptions = useMemo<ProductOption[]>(
    () =>
      productEntries
        .filter((p) => !p.payload.archived)
        .map((p) => {
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

  function closeForm() {
    setMode(null);
    setEditing(null);
    setEditingSchedule(null);
  }

  async function onSubmit(payload: HrtAdminLogPayload, id?: string): Promise<void> {
    if (id) await update(id, payload);
    else await create(payload);
  }
  async function onSubmitSchedule(payload: HrtSchedulePayload, id?: string): Promise<void> {
    if (id) await schedules.update(id, payload);
    else await schedules.create(payload);
  }
  async function onCreateProduct(payload: HrtProductPayload): Promise<void> {
    await createProduct(payload);
  }
  async function onDelete(entry: AdminLogEntry): Promise<void> {
    const label = `${entry.payload.product} — ${formatLogDate(entry.payload.date)}`;
    if (!window.confirm(`Supprimer cette prise ?\n${label}`)) return;
    await remove(entry.id);
  }
  async function onStop(s: ScheduleEntry): Promise<void> {
    if (
      !window.confirm(
        `Arrêter la série « ${s.payload.product} » ?\nLes prises déjà enregistrées sont conservées.`,
      )
    )
      return;
    await schedules.update(s.id, { ...s.payload, endDate: todayIso(), updatedAt: new Date().toISOString() });
  }

  return (
    <section className="min-w-0">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-medium text-ink">Journal de prises</h2>
        {!formOpen ? (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!ready}
              onClick={() => {
                setEditingSchedule(null);
                setMode('schedule');
              }}
            >
              + Prise récurrente
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!ready}
              onClick={() => {
                setEditing(null);
                setMode('manual');
              }}
            >
              + Prise manuelle
            </Button>
          </div>
        ) : null}
      </div>

      {mode === 'manual' ? (
        <div className="mb-5">
          <AdminLogForm
            {...(editing ? { initial: editing } : {})}
            products={productOptions}
            onSubmit={onSubmit}
            onCreateProduct={onCreateProduct}
            onClose={closeForm}
          />
        </div>
      ) : mode === 'schedule' ? (
        <div className="mb-5">
          <ScheduleForm
            {...(editingSchedule ? { initial: editingSchedule } : {})}
            products={productOptions}
            onSubmit={onSubmitSchedule}
            onCreateProduct={onCreateProduct}
            onClose={closeForm}
          />
        </div>
      ) : null}

      {!formOpen ? (
        <SchedulesPanel
          schedules={schedules.entries}
          productByName={productByName}
          onEdit={(s) => {
            setEditing(null);
            setEditingSchedule(s);
            setMode('schedule');
          }}
          onStop={(s) => void onStop(s)}
        />
      ) : null}

      {load.status === 'loading' ? (
        <p className="py-8 text-center text-[13px] text-muted">Chargement…</p>
      ) : load.status === 'error' ? (
        <p className="py-8 text-center text-[13px] text-danger">{load.message}</p>
      ) : entries.length === 0 && !formOpen ? (
        <div className="rounded-md border border-dashed border-hair bg-bg-2 p-8 text-center">
          <p className="text-[13px] text-muted">
            Aucune prise enregistrée. Ajoute-en une, ou lance une prise récurrente.
          </p>
        </div>
      ) : (
        <AdminJournal
          entries={entries}
          productByName={productByName}
          onEditEntry={(entry) => {
            setEditingSchedule(null);
            setEditing(entry);
            setMode('manual');
          }}
          onDeleteEntry={(entry) => void onDelete(entry)}
        />
      )}
    </section>
  );
}
