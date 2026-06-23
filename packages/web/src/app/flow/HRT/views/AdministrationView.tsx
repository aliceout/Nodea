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
import { createPortal } from 'react-dom';

import type {
  HrtAdminLogPayload,
  HrtProductPayload,
  HrtSchedulePayload,
} from '@nodea/shared';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { useConfirm } from '@/ui/dirk/confirm/confirm-context';
import Button from '@/ui/atoms/dirk/Button';
import SpeedDial from '@/ui/dirk/SpeedDial';

import AdminJournal from '../components/AdminJournal';
import AdminLogForm, { type ProductOption } from '../components/AdminLogForm';
import ScheduleForm from '../components/ScheduleForm';
import SchedulesPanel from '../components/SchedulesPanel';
import { type AdminLogEntry, type UseHrtAdminLogs } from '../hooks/use-admin-logs';
import type { UseHrtProducts } from '../hooks/use-products';
import type { ScheduleEntry, UseHrtSchedules } from '../hooks/use-schedules';
import { formatLogDate, todayIso } from '../lib/labels';

interface AdministrationViewProps {
  /** The single shared schedules instance — owned by `HrtPage` so that
   *  creating a series here triggers the materialisation engine there. */
  schedules: UseHrtSchedules;
  /** The single shared admin-logs instance — owned by `HrtPage` so the
   *  collection is listed once per module mount, not once per view
   *  (audit 2026-06). */
  adminLogs: UseHrtAdminLogs;
  /** Shared products instance — owned by `HrtPage` (audit 2026-06
   *  passe 2 : hoisted so switching sub-views doesn't re-LIST it). */
  products: UseHrtProducts;
  /** Topbar actions slot (owned by `HrtPage`) — the desktop CTAs portal
   *  here so they sit in the topbar instead of the page body. */
  topbarSlot?: HTMLElement | null;
}

export default function AdministrationView({
  schedules,
  adminLogs,
  products,
  topbarSlot,
}: AdministrationViewProps) {
  const { t, language } = useI18n();
  const confirm = useConfirm();
  const { entries, load, ready, create, update, remove } = adminLogs;
  const { entries: productEntries, create: createProduct } = products;

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
    const label = `${entry.payload.product} — ${formatLogDate(entry.payload.date, language)}`;
    const ok = await confirm({
      message: t('hrt.administration.confirmDelete', { values: { label } }),
      tone: 'danger',
    });
    if (!ok) return;
    await remove(entry.id);
  }
  async function onStop(s: ScheduleEntry): Promise<void> {
    const ok = await confirm({
      message: t('hrt.administration.confirmStop', { values: { product: s.payload.product } }),
      tone: 'danger',
    });
    if (!ok) return;
    await schedules.update(s.id, { ...s.payload, endDate: todayIso(), updatedAt: new Date().toISOString() });
  }

  return (
    <section className="min-w-0">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-medium text-ink">{t('hrt.administration.title')}</h2>
      </div>

      {/* Desktop CTAs live in the topbar (portalled). Hidden while a form
          is open; on mobile the SpeedDial below takes over. */}
      {topbarSlot && !formOpen
        ? createPortal(
            <>
              <Button
                variant="secondary"
                size="sm"
                disabled={!ready}
                onClick={() => {
                  setEditingSchedule(null);
                  setMode('schedule');
                }}
                className="hidden lg:inline-flex"
              >
                {t('hrt.administration.newSchedule')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!ready}
                onClick={() => {
                  setEditing(null);
                  setMode('manual');
                }}
                className="hidden lg:inline-flex"
              >
                {t('hrt.administration.newManual')}
              </Button>
            </>,
            topbarSlot,
          )
        : null}

      {/* Mobile speed-dial — one bubble fanning out to both header
          actions (primary « prise manuelle » nearest the thumb). The
          in-body buttons above are desktop-only. */}
      <SpeedDial
        addLabel={t('common.actions.add')}
        closeLabel={t('common.actions.close')}
        hidden={formOpen}
        actions={[
          {
            label: t('hrt.administration.newSchedule'),
            onClick: () => {
              setEditingSchedule(null);
              setMode('schedule');
            },
            disabled: !ready,
          },
          {
            label: t('hrt.administration.newManual'),
            onClick: () => {
              setEditing(null);
              setMode('manual');
            },
            disabled: !ready,
          },
        ]}
      />


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
        <p className="py-8 text-center text-[13px] text-muted">{t('common.states.loading')}</p>
      ) : load.status === 'error' ? (
        <p className="py-8 text-center text-[13px] text-danger">{load.message}</p>
      ) : entries.length === 0 && !formOpen ? (
        <div className="rounded-md border border-dashed border-hair bg-bg-2 p-8 text-center">
          <p className="text-[13px] text-muted">{t('hrt.administration.empty')}</p>
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
