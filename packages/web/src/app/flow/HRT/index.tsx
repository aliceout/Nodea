/**
 * HRT — hormone replacement therapy tracking.
 *
 * Where it sits : a `/flow` data module (lazy-loaded from
 * `modules-registry.tsx`), built on the Library two-sub-view pattern.
 * The active lens lives in the global flow slice (`hrtSubview`), never
 * in the URL — same privacy contract as Library, which matters doubly
 * here given how sensitive trans-health data is.
 *
 * Three lenses on the encrypted collections :
 *   - `summary`        → read-only dashboard (latest doses + labs) plus
 *                        the product catalog it absorbed (its only home)
 *   - `administration` → the dose / injection log (`hrt_admin_logs`)
 *   - `labs`           → lab results + their chart (`hrt_lab_results`)
 *
 * `summary` is the default landing. Product CRUD lives on it (the
 * Produits sub-view was folded in) ; the dose / lab lists are read-only
 * and deep-link to the two detail views.
 *
 * Recurring schedules are **materialised here, at module level** : the
 * generator must run regardless of the open sub-view, since every lens
 * reads admin logs. After a pass that creates occurrences out-of-band,
 * the shared admin-logs hook re-fetches (`adminLogs.reload()`).
 *
 * The admin-logs hook is owned HERE and passed to the views (audit
 * 2026-06) : each view used to mount its own instance, so the same
 * collection was listed 2-3× per module mount, once more per
 * sub-view switch, and the whole view tree was remounted via a
 * `key={dataVersion}` after materialisation. One shared instance +
 * a targeted reload replaces all of that. See `docs/Modules/HRT.md`.
 */
import { useCallback, useState } from 'react';

import { useNodeaStore, selectHrtSubview } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import ModuleShell from '@/ui/dirk/module/ModuleShell';
import Topbar from '@/ui/dirk/Topbar';

import { useHrtAdminLogs } from './hooks/use-admin-logs';
import { useHrtLabResults } from './hooks/use-lab-results';
import { useHrtProducts } from './hooks/use-products';
import { useHrtSchedules } from './hooks/use-schedules';
import { useScheduleMaterialization } from './hooks/use-schedule-materialization';
import AdministrationView from './views/AdministrationView';
import ExportView from './views/ExportView';
import LabsView from './views/LabsView';
import SummaryView from './views/SummaryView';

export default function HrtPage() {
  const { t } = useI18n();
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const subview = useNodeaStore(selectHrtSubview);

  // Topbar actions slot — each sub-view portals its desktop CTA(s) here
  // (issue: HRT CTAs belonged in the page, not the topbar). A portal
  // keeps every view's form state + handlers intact (the buttons stay in
  // the view's React tree, only their DOM home is the topbar), which
  // matters on this sensitive module. `display:contents` lets the
  // portalled buttons sit as direct flex items of the topbar row.
  const [topbarSlot, setTopbarSlot] = useState<HTMLElement | null>(null);

  // Single shared instances — schedules drive the materialisation
  // engine, admin logs feed every lens. Products + lab results are
  // hoisted here too (audit 2026-06 passe 2) so switching sub-views
  // doesn't re-LIST + re-decrypt either collection : Summary reads
  // both, Labs reads labs, Administration reads products, Export
  // reads all four. One instance each, mounted for the module's life.
  const schedules = useHrtSchedules();
  const adminLogs = useHrtAdminLogs();
  const products = useHrtProducts();
  const labResults = useHrtLabResults();
  const reloadSchedules = schedules.reload;
  const reloadAdminLogs = adminLogs.reload;
  const onMaterialized = useCallback(() => {
    reloadSchedules();
    reloadAdminLogs();
  }, [reloadSchedules, reloadAdminLogs]);
  useScheduleMaterialization(schedules.entries, schedules.ready, onMaterialized);

  return (
    <ModuleShell
      topbar={
        <Topbar label={t(`hrt.topbar.${subview}`)} onOpenMenu={() => setMobileMenuOpen(true)}>
          <span ref={setTopbarSlot} className="contents" />
        </Topbar>
      }
    >
      {subview === 'administration' ? (
        <AdministrationView
          schedules={schedules}
          adminLogs={adminLogs}
          products={products}
          topbarSlot={topbarSlot}
        />
      ) : subview === 'labs' ? (
        <LabsView labResults={labResults} topbarSlot={topbarSlot} />
      ) : subview === 'export' ? (
        <ExportView
          adminLogs={adminLogs}
          products={products}
          labResults={labResults}
          schedules={schedules}
        />
      ) : (
        <SummaryView
          adminLogs={adminLogs}
          products={products}
          labResults={labResults}
          topbarSlot={topbarSlot}
        />
      )}
    </ModuleShell>
  );
}
