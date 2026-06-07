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
 * and deep-link to the two detail views. See `docs/Modules/HRT.md`.
 */
import { useNodeaStore, selectHrtSubview } from '@/core/store/nodea-store';
import ModuleShell from '@/ui/dirk/module/ModuleShell';
import Topbar from '@/ui/dirk/Topbar';

import AdministrationView from './views/AdministrationView';
import LabsView from './views/LabsView';
import SummaryView from './views/SummaryView';

const TOPBAR_LABELS = {
  summary: 'HRT · Synthèse',
  administration: 'HRT · Administration',
  labs: 'HRT · Analyses',
} as const;

export default function HrtPage() {
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const subview = useNodeaStore(selectHrtSubview);

  return (
    <ModuleShell
      topbar={
        <Topbar label={TOPBAR_LABELS[subview]} onOpenMenu={() => setMobileMenuOpen(true)} />
      }
    >
      {subview === 'administration' ? (
        <AdministrationView />
      ) : subview === 'labs' ? (
        <LabsView />
      ) : (
        <SummaryView />
      )}
    </ModuleShell>
  );
}
