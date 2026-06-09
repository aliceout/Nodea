import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { useRefocusTrigger } from '@/lib/use-refocus-trigger';
import Button from '@/ui/atoms/dirk/Button';
import ModuleShell from '@/ui/dirk/module/ModuleShell';
import Topbar from '@/ui/dirk/Topbar';

import CarryOverDialog from './components/CarryOverDialog';
import MobileFilters from './components/MobileFilters';
import SideColumn from './components/SideColumn';
import { GoalsProvider, useGoalsActions, useGoalsData } from './context';
import PrimaryColumn from './views/PrimaryColumn';
import GoalsReaderShell from './views/ReaderShell';

/**
 * Goals — Direction K · Sauge.
 *
 * Single detail view (no Form / History tabs). Sticky topbar +
 * page header + 2-column body : main = goals grouped by thread (or
 * year), side = filters and stats. Each row carries an inline
 * status pill (click to cycle open → wip → done → open) and a
 * trash affordance.
 *
 * Architecture :
 *   - `<GoalsProvider>` (`./context.tsx`) owns the page-local
 *     state — entries, filters, actions.
 *   - Three hooks (`useGoalsData`, `useGoalsFilters`,
 *     `useGoalsActions`) expose the slices ; consumers re-render
 *     only on the slice they read.
 *   - Sub-components in `components/` (sidebar, carry-over dialog)
 *     and `views/` (primary column, row, status pill) consume the
 *     contexts directly — no prop drilling.
 *   - Pure helpers in `lib/` (mappers, status cycle, sort, threads,
 *     date format) carry the Vitest coverage.
 *
 * Create / edit lifecycle : the « + Nouvel objectif » CTA opens
 * the global Composer with `type='goal'`. Edit prefills via the
 * Composer ; new entries flow through the Composer.
 */
export default function GoalsPage() {
  return (
    <GoalsProvider>
      <GoalsView />
    </GoalsProvider>
  );
}

/** Top-level rendering surface. Mounts the shared chrome (topbar /
 *  sidebar) and the always-rendered (self-conditional) carry-over
 *  dialog. State + actions live in the contexts.
 *
 *  Issue #64 — when a goal is being read full-screen
 *  (`readingId !== null`) the reader shell takes over the whole
 *  surface ; the regular two-column list yields. The carry-over
 *  dialog stays mounted unconditionally so closing the reader
 *  doesn't reset its draft state. */
function GoalsView() {
  const { t, tn } = useI18n();
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const { stats } = useGoalsData();
  const { readingId, formOpen, openCreateForm } = useGoalsActions();
  // Focus restore (audit 2026-06, lot G) — must run before the
  // reader early-return so the hook order stays stable.
  const newGoalRef = useRefocusTrigger(formOpen);

  if (readingId !== null) {
    return (
      <>
        <GoalsReaderShell />
        <CarryOverDialog />
      </>
    );
  }

  const topbarLabel = tn('goals.topbar.label', stats.total);

  return (
    <ModuleShell
      topbar={
        <Topbar label={topbarLabel} onOpenMenu={() => setMobileMenuOpen(true)}>
          {/* Hide the « + Nouvel objectif » button while the inline
              form is already open — same posture as Mood / HRT.
              Clicking it again while editing would reopen a fresh
              create form on top of an in-progress edit and lose
              the user's draft. */}
          {!formOpen ? (
            <Button
              ref={newGoalRef}
              variant="primary"
              size="sm"
              onClick={openCreateForm}
            >
              {t('goals.topbar.newCta')}
            </Button>
          ) : null}
        </Topbar>
      }
      side={<SideColumn />}
    >
      {/* Mobile-only filters collapse — sits at the top of the
          children flow (above PrimaryColumn) so it's the first
          thing the user sees below the topbar. Folded by default ;
          renders nothing at `lg+` because the right sidebar
          (`SideColumn`) takes over. */}
      <MobileFilters />
      <PrimaryColumn />
      <CarryOverDialog />
    </ModuleShell>
  );
}
