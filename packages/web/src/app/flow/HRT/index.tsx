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
 * reads admin logs. After a pass that creates occurrences out-of-band, we
 * bump `dataVersion` to remount the active view so its journal hook
 * re-fetches the fresh entries (rare — at most once per day). See
 * `docs/Modules/HRT.md`.
 */
import { useCallback, useReducer } from 'react';

import { useNodeaStore, selectHrtSubview } from '@/core/store/nodea-store';
import ModuleShell from '@/ui/dirk/module/ModuleShell';
import Topbar from '@/ui/dirk/Topbar';

import { useHrtSchedules } from './hooks/use-schedules';
import { useScheduleMaterialization } from './hooks/use-schedule-materialization';
import AdministrationView from './views/AdministrationView';
import ExportView from './views/ExportView';
import LabsView from './views/LabsView';
import SummaryView from './views/SummaryView';

const TOPBAR_LABELS = {
  summary: 'HRT · Synthèse',
  administration: 'HRT · Administration',
  labs: 'HRT · Analyses',
  export: 'HRT · Import / Export',
} as const;

export default function HrtPage() {
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const subview = useNodeaStore(selectHrtSubview);

  // Generate recurring-schedule occurrences once the schedules load. A
  // pass that actually wrote entries bumps `dataVersion`, remounting the
  // view so its admin-logs hook re-fetches them.
  const [dataVersion, bumpData] = useReducer((v: number) => v + 1, 0);
  const schedules = useHrtSchedules();
  const reloadSchedules = schedules.reload;
  const onMaterialized = useCallback(() => {
    reloadSchedules();
    bumpData();
  }, [reloadSchedules]);
  useScheduleMaterialization(schedules.entries, schedules.ready, onMaterialized);

  return (
    <ModuleShell
      topbar={
        <Topbar label={TOPBAR_LABELS[subview]} onOpenMenu={() => setMobileMenuOpen(true)} />
      }
    >
      <div key={dataVersion} className="contents">
        {subview === 'administration' ? (
          <AdministrationView schedules={schedules} />
        ) : subview === 'labs' ? (
          <LabsView />
        ) : subview === 'export' ? (
          <ExportView />
        ) : (
          <SummaryView />
        )}
      </div>
    </ModuleShell>
  );
}
