import { WrenchScrewdriverIcon } from '@heroicons/react/24/outline';
import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import EmptyHint from '@/ui/dirk/module/EmptyHint';
import ModuleShell from '@/ui/dirk/module/ModuleShell';
import PageHeading from '@/ui/dirk/module/PageHeading';
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
  const { t } = useI18n();
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const { keyMissing, moduleMissing } = useHabits();

  if (keyMissing) {
    return (
      <ModuleShell
        topbar={<Topbar label={t('habits.title')} onOpenMenu={() => setMobileMenuOpen(true)} />}
      >
        <EmptyHint>{t('habits.empty.keyMissing')}</EmptyHint>
      </ModuleShell>
    );
  }
  if (moduleMissing) {
    return (
      <ModuleShell
        topbar={<Topbar label={t('habits.title')} onOpenMenu={() => setMobileMenuOpen(true)} />}
      >
        <EmptyHint>{t('habits.empty.moduleMissing')}</EmptyHint>
      </ModuleShell>
    );
  }

  return (
    <ModuleShell
      topbar={<Topbar label={t('habits.title')} onOpenMenu={() => setMobileMenuOpen(true)} />}
    >
      <PageHeading>{t('habits.title')}</PageHeading>

      <div className="mx-auto mt-12 max-w-md rounded-md border border-hair bg-bg-2 p-8 text-center">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-hair bg-bg text-muted">
          <WrenchScrewdriverIcon className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="mb-2 text-[15px] font-semibold tracking-[-0.005em] text-ink">
          {t('habits.construction.title')}
        </h2>
        <p className="text-[13px] leading-[1.55] text-ink-soft">
          {t('habits.construction.body')}
        </p>
      </div>
    </ModuleShell>
  );
}
