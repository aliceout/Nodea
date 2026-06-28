/**
 * HRT · Synthèse — the module's landing dashboard. Two sections over the
 * three HRT collections, joined live : (1) a dose chart (3/4) whose
 * molecule is picked from a Select, beside the **full** product catalog
 * (1/4) — absorbed here, so product CRUD lives on this page ; the chart
 * fills the product list's height (grid stretch + LabChart `fillHeight`).
 * (2) the latest doses + lab results (1/2 each), read-only, linking to
 * the Administration / Analyses views.
 *
 * On `lg+` the page is locked to the viewport height — `100dvh` minus the
 * 52 px Topbar and the 56 px (`py-7`) content padding — so section 2
 * fills the space left under section 1, each list scrolling within. If
 * the Topbar / ModuleShell padding changes, update the `108px` offset.
 *
 * Orchestration only : grouping + mg-equivalent series from
 * `lib/admin-data` ; rows / chart / form / panel are components. See
 * `docs/Modules/HRT.md`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { HrtProductPayload } from '@nodea/shared';
import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import Select from '@/ui/atoms/dirk/Select';
import InlinePanel from '@/ui/dirk/forms/InlinePanel';
import ModuleSettingsPanel from '@/ui/dirk/module/ModuleSettingsPanel';
import ModuleSettingsTrigger from '@/ui/dirk/module/ModuleSettingsTrigger';
import PageHeading from '@/ui/dirk/module/PageHeading';
import { useModuleSettings } from '@/ui/dirk/module/module-settings-context';
import SpeedDial from '@/ui/dirk/SpeedDial';

import AdminLogRow from '../components/AdminLogRow';
import DoseChartPanel from '../components/DoseChartPanel';
import LabResultRow from '../components/LabResultRow';
import ProductForm from '../components/ProductForm';
import ProductRow from '../components/ProductRow';
import RecentPanel from '../components/RecentPanel';
import type { UseHrtAdminLogs } from '../hooks/use-admin-logs';
import type { UseHrtLabResults } from '../hooks/use-lab-results';
import { type ProductEntry, type UseHrtProducts } from '../hooks/use-products';
import { buildDoseSeries, distinctMolecules } from '../lib/admin-data';

// The recent lists render into a height-capped, scrollable panel : keep a
// generous slice so a tall screen fills the area, while the « Voir les… »
// link reaches the rest in the detail view.
const RECENT = 12;

interface SummaryViewProps {
  /** Shared instances owned by `HrtPage` (audit 2026-06 : one LIST
   *  per module mount, not per view nor per sub-view switch). */
  adminLogs: UseHrtAdminLogs;
  products: UseHrtProducts;
  labResults: UseHrtLabResults;
  /** Topbar actions slot (owned by `HrtPage`) — the product CTA portals
   *  here so it sits in the topbar instead of the catalog card header. */
  topbarSlot?: HTMLElement | null;
}

export default function SummaryView({
  adminLogs,
  products: productsHook,
  labResults,
  topbarSlot,
}: SummaryViewProps) {
  const { t } = useI18n();
  const moduleSettings = useModuleSettings();
  const setHrtSubview = useNodeaStore((s) => s.setHrtSubview);
  const { entries: products, ready, create, update } = productsHook;
  const { entries: adminEntries } = adminLogs;
  const { entries: labEntries } = labResults;

  const [selectedMolecule, setSelectedMolecule] = useState<string | null>(null);
  const [addingProduct, setAddingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductEntry | null>(null);
  const [productView, setProductView] = useState<'active' | 'archived'>('active');
  const productFormOpen = addingProduct || editingProduct !== null;

  // The name→product map joins ALL products (incl. archived) so past
  // doses keep their molecule / unit display ; the list below filters.
  const productByName = useMemo(() => {
    const m = new Map<string, HrtProductPayload>();
    for (const p of products) m.set(p.payload.name, p.payload);
    return m;
  }, [products]);
  const archivedCount = useMemo(
    () => products.filter((p) => p.payload.archived).length,
    [products],
  );
  const visibleProducts = products.filter((p) =>
    productView === 'archived' ? p.payload.archived : !p.payload.archived,
  );

  // Molecules that have logged doses, most-logged first — the options of
  // the chart's molecule picker. Defaults to the most-logged ; a stale
  // selection (molecule no longer logged) falls back to it.
  const molecules = useMemo(
    () => distinctMolecules(adminEntries, productByName),
    [adminEntries, productByName],
  );
  const activeMolecule =
    selectedMolecule && molecules.some((m) => m.name === selectedMolecule)
      ? selectedMolecule
      : (molecules[0]?.name ?? null);

  const series = useMemo(
    () =>
      activeMolecule
        ? buildDoseSeries(adminEntries, activeMolecule, productByName)
        : { points: [], skipped: 0 },
    [adminEntries, activeMolecule, productByName],
  );

  const latestAdmins = adminEntries.slice(0, RECENT); // hook is newest-first
  const latestLabs = useMemo(() => [...labEntries].reverse().slice(0, RECENT), [labEntries]);

  const closeProductForm = useCallback(() => {
    setAddingProduct(false);
    setEditingProduct(null);
  }, []);

  // Mutual exclusion — the product form and the « Paramètre du module » panel
  // both open at the top of this view; the just-opened one wins, never both at
  // once (mirrors Mood / Journal / Goals / Library).
  const openPanelsRef = useRef({ form: false, settings: false });
  useEffect(() => {
    const settingsOpen = !!moduleSettings?.open;
    const prev = openPanelsRef.current;
    if (settingsOpen && !prev.settings && productFormOpen) closeProductForm();
    else if (productFormOpen && !prev.form && settingsOpen) moduleSettings?.close();
    openPanelsRef.current = { form: productFormOpen, settings: settingsOpen };
  }, [productFormOpen, moduleSettings, closeProductForm]);
  async function onSubmitProduct(payload: HrtProductPayload, id?: string): Promise<void> {
    if (id) await update(id, payload);
    else await create(payload);
  }
  async function setArchived(entry: ProductEntry, archived: boolean): Promise<void> {
    await update(entry.id, { ...entry.payload, archived, updatedAt: new Date().toISOString() });
  }

  return (
    <section className="flex min-w-0 flex-col lg:h-[calc(100dvh-108px)]">
      {/* Module title + « Paramètre du module » link on one row — HRT has no
          sidebar to carry the title or the settings link, so Synthèse holds
          both (title left, trigger far right), like every other module. The
          trigger uses `ml-auto` so it stays right even when the title hides on
          mobile (desktop-only, like Mood / Journal / Goals / Library). */}
      <div className="mb-4 flex shrink-0 items-center gap-4">
        <PageHeading className="mb-0 hidden lg:block">{t('hrt.title')}</PageHeading>
        <ModuleSettingsTrigger className="ml-auto shrink-0" />
      </div>
      <InlinePanel open={!!moduleSettings?.open} className="mb-5 shrink-0">
        <ModuleSettingsPanel onClose={() => moduleSettings?.close()} />
      </InlinePanel>

      {productFormOpen ? (
        <div className="mb-5 shrink-0">
          <ProductForm
            {...(editingProduct ? { initial: editingProduct } : {})}
            onSubmit={onSubmitProduct}
            onClose={closeProductForm}
          />
        </div>
      ) : null}

      {/* Section 1 — chart (3/4) + the FULL product catalog (1/4). The
          product list is shown complete (no scroll) and the chart fills
          the matching height : grid `items-stretch` + LabChart `fillHeight`.
          The chart's molecule is picked from a Select in its header. */}
      <div className="mb-4 grid shrink-0 grid-cols-1 items-stretch gap-4 lg:grid-cols-4">
        <DoseChartPanel
          molecules={molecules}
          activeMolecule={activeMolecule}
          onSelectMolecule={setSelectedMolecule}
          points={series.points}
          hasProducts={products.length > 0}
        />

        <div className="flex min-h-[17.5rem] min-w-0 flex-col rounded-lg border border-hair p-4 lg:col-span-1">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h2 className="text-[13px] font-medium text-ink">{t('hrt.summary.products.title')}</h2>
            {archivedCount > 0 || productView === 'archived' ? (
              <Select
                aria-label={t('hrt.summary.products.viewAria')}
                borderless
                className="w-auto text-[12px]"
                value={productView}
                onChange={(e) => setProductView(e.target.value as 'active' | 'archived')}
              >
                <option value="active">{t('hrt.summary.products.active')}</option>
                <option value="archived">
                  {t('hrt.summary.products.archived', { values: { count: archivedCount } })}
                </option>
              </Select>
            ) : null}
          </div>

          {/* Desktop CTA lives in the topbar (portalled) — only on the
              actives lens, hidden while the form is open ; mobile uses
              the SpeedDial below. */}
          {topbarSlot && !productFormOpen && productView === 'active'
            ? createPortal(
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setAddingProduct(true)}
                  disabled={!ready}
                  className="hidden lg:inline-flex"
                >
                  {t('hrt.summary.products.new')}
                </Button>,
                topbarSlot,
              )
            : null}

          {/* Mobile speed-dial — « ajouter un produit ». Only on the
              actives view (no add on the archive lens), hidden while the
              form is open. */}
          <SpeedDial
            addLabel={t('common.actions.add')}
            closeLabel={t('common.actions.close')}
            hidden={productFormOpen || productView !== 'active'}
            actions={[
              {
                label: t('hrt.summary.products.new'),
                onClick: () => setAddingProduct(true),
                disabled: !ready,
              },
            ]}
          />

          {visibleProducts.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-muted">
              {productView === 'archived'
                ? t('hrt.summary.products.emptyArchived')
                : t('hrt.summary.products.empty')}
            </p>
          ) : (
            <ul className="flex flex-col">
              {visibleProducts.map((entry) =>
                entry.payload.archived ? (
                  <ProductRow
                    key={entry.id}
                    entry={entry}
                    onReactivate={() => void setArchived(entry, false)}
                  />
                ) : (
                  <ProductRow
                    key={entry.id}
                    entry={entry}
                    onEdit={() => {
                      setAddingProduct(false);
                      setEditingProduct(entry);
                    }}
                    onArchive={() => void setArchived(entry, true)}
                  />
                ),
              )}
            </ul>
          )}
        </div>
      </div>

      {/* Section 2 — latest doses (1/2) + latest labs (1/2), read-only.
          Fills the viewport height left below section 1 (lg) ; each
          panel's list scrolls within. */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:min-h-0 lg:flex-1 lg:auto-rows-fr">
        <RecentPanel
          title={t('hrt.summary.recentDoses.title')}
          linkLabel={t('hrt.summary.recentDoses.link')}
          onOpen={() => setHrtSubview('administration')}
          empty={latestAdmins.length === 0}
          emptyText={t('hrt.summary.recentDoses.empty')}
        >
          <div className="flex flex-col">
            {latestAdmins.map((entry) => (
              <AdminLogRow
                key={entry.id}
                entry={entry}
                product={productByName.get(entry.payload.product)}
              />
            ))}
          </div>
        </RecentPanel>

        <RecentPanel
          title={t('hrt.summary.recentLabs.title')}
          linkLabel={t('hrt.summary.recentLabs.link')}
          onOpen={() => setHrtSubview('labs')}
          empty={latestLabs.length === 0}
          emptyText={t('hrt.summary.recentLabs.empty')}
        >
          <ul className="flex flex-col">
            {latestLabs.map((entry) => (
              <LabResultRow key={entry.id} entry={entry} />
            ))}
          </ul>
        </RecentPanel>
      </div>
    </section>
  );
}
