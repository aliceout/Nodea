import { WrenchScrewdriverIcon } from '@heroicons/react/24/outline';
import { useNodeaStore } from '@/core/store/nodea-store';
import EmptyHint from '@/ui/dirk/EmptyHint';
import ModuleShell from '@/ui/dirk/ModuleShell';
import PageHeading from '@/ui/dirk/PageHeading';
import Topbar from '@/ui/dirk/Topbar';
import { useHabits } from './hooks/useHabits';

/**
 * Habits — Direction K · Sauge.
 *
 * Module documenté mais pas encore livré : le shell K · Sauge
 * remplace l'ancien layout `Subheader + bg-slate` pour que la
 * page ne dénote plus avec le reste de l'app, et un panneau
 * « en cours de construction » clarifie l'état au lecteur·trice.
 *
 * Les anciennes vues `Form` / `History` restent dans le repo
 * comme références — elles ne sont plus montées tant que le
 * module n'est pas finalisé.
 */
export default function HabitsIndex() {
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const { keyMissing, moduleMissing } = useHabits();

  if (keyMissing) {
    return (
      <ModuleShell
        topbar={<Topbar label="Habits" onOpenMenu={() => setMobileMenuOpen(true)} />}
      >
        <EmptyHint>
          Clé principale absente — reconnecte-toi pour voir tes habitudes.
        </EmptyHint>
      </ModuleShell>
    );
  }
  if (moduleMissing) {
    return (
      <ModuleShell
        topbar={<Topbar label="Habits" onOpenMenu={() => setMobileMenuOpen(true)} />}
      >
        <EmptyHint>
          Active le module Habits dans les paramètres pour commencer.
        </EmptyHint>
      </ModuleShell>
    );
  }

  return (
    <ModuleShell
      topbar={<Topbar label="Habits" onOpenMenu={() => setMobileMenuOpen(true)} />}
    >
      <PageHeading>Habits</PageHeading>

      <div className="mx-auto mt-12 max-w-md rounded-md border border-hair bg-bg-2 p-8 text-center">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-hair bg-bg text-muted">
          <WrenchScrewdriverIcon className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="mb-2 text-[15px] font-semibold tracking-[-0.005em] text-ink">
          En cours de construction
        </h2>
        <p className="text-[13px] leading-[1.55] text-ink-soft">
          Le suivi d'habitudes (heatmap quotidienne, séries, régularité) est
          documenté mais pas encore branché côté app. Reviens bientôt.
        </p>
      </div>
    </ModuleShell>
  );
}
