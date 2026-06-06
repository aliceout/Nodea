/**
 * HRT — hormone replacement therapy tracking.
 *
 * Where it sits : a `/flow` data module (lazy-loaded from
 * `modules-registry.tsx`), built on the Library two-sub-view pattern.
 * The active lens lives in the global flow slice (`hrtSubview`), never
 * in the URL — same privacy contract as Library, which matters doubly
 * here given how sensitive trans-health data is.
 *
 * Two lenses on two encrypted collections (wired in a later phase) :
 *   - `administration` → the dose / injection log (`hrt_admin_logs`)
 *   - `labs`           → lab results + their chart (`hrt_lab_results`)
 *
 * Phase 0 scaffold : the module mounts, appears in the sidebar with its
 * two sub-menus, and toggles between two placeholder views. Data layer,
 * forms and the SVG chart land in the following phases — see
 * `docs/Modules/HRT.md`.
 */
import { useNodeaStore, selectHrtSubview } from '@/core/store/nodea-store';
import ModuleShell from '@/ui/dirk/module/ModuleShell';
import Topbar from '@/ui/dirk/Topbar';

import AdministrationView from './views/AdministrationView';
import LabsView from './views/LabsView';
import ProductsView from './views/ProductsView';

const TOPBAR_LABELS = {
  administration: 'HRT · Administration',
  labs: 'HRT · Analyses',
  products: 'HRT · Produits',
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
        <ProductsView />
      )}
    </ModuleShell>
  );
}
