import ModulesManager from '@/app/flow/Settings/components/ModulesManager';

/** « Modules » tab — defers everything to the existing
 *  `ModulesManager` (under `/flow/Settings/components/`) and adds
 *  an explanatory sidebar. Disabling a module hides it from the
 *  sidebar without ever deleting its encrypted entries. */
export default function ModulesTab() {
  return (
    <div className="grid max-w-[1100px] grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
      <ModulesManager />
      <div className="space-y-2 text-[13px] leading-[1.55] text-muted">
        <p>Tous les modules sont activés par défaut.</p>
        <p>
          Désactive ceux que tu n’utilises pas — ils disparaîtront de la
          barre latérale et leurs données seront laissées intactes (rien
          n’est supprimé).
        </p>
      </div>
    </div>
  );
}
