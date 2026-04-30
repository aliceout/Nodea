import ModulesManager from '@/app/flow/Settings/components/ModulesManager';
import { useI18n } from '@/i18n/I18nProvider.jsx';

/** « Modules » tab — defers everything to the existing
 *  `ModulesManager` (under `/flow/Settings/components/`) and adds
 *  an explanatory sidebar. Disabling a module hides it from the
 *  sidebar without ever deleting its encrypted entries. */
export default function ModulesTab() {
  const { t } = useI18n();
  return (
    <div className="grid max-w-[1100px] grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
      <ModulesManager />
      <div className="space-y-2 text-[13px] leading-[1.55] text-muted">
        <p>{t('account.modules.intro1')}</p>
        <p>{t('account.modules.intro2')}</p>
      </div>
    </div>
  );
}
