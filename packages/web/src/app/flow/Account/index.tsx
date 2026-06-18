import { useMemo, useState } from 'react';

import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Tabs from '@/ui/dirk/Tabs';
import Topbar from '@/ui/dirk/Topbar';
import PageHeading from '@/ui/dirk/module/PageHeading';

import { TAB_IDS } from './lib/constants';
import type { Tab } from './lib/types';
import DangerTab from './views/DangerTab';
import DataTab from './views/DataTab';
import IdentityTab from './views/IdentityTab';
import ModulesTab from './views/ModulesTab';
import PreferencesTab from './views/PreferencesTab';
import SecurityTab from './views/SecurityTab';

/**
 * Mon compte — Direction K · Sauge.
 *
 * Pixel-precise port of `K_Account` from the design handoff :
 * per-page topbar (« Paramètres · Mon compte »), H1 + 6 tab
 * buttons, then a tab content panel that re-mounts on each switch
 * (keyed on the tab id) so the `animate-fade-up` keyframe replays.
 *
 * Architecture :
 *   - `lib/` carries the pure helpers (security-mode label, the
 *     tab definition list, theme options) with their tests.
 *   - `components/` hosts the layout primitives shared between
 *     tabs : `Field`, `IdentityRow`, `DescribedSection`, `Stats`.
 *   - `views/` hosts one file per tab. The Data tab further nests
 *     `views/data/{ExportPanel,ImportPanel}.tsx` since both panels
 *     own their own state and don't share a parent provider.
 *   - This `index.tsx` only does the tab dispatch.
 *
 * No central provider : each tab's state is local to that tab,
 * and the `key={tab}` re-mount intentionally resets in-progress
 * drafts when the user switches away. Centralising would just
 * fight that behaviour.
 */
export default function AccountPage() {
  const { t } = useI18n();
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const [tab, setTab] = useState<Tab>('identity');

  const tabs = useMemo(
    () => TAB_IDS.map((id) => ({ id, label: t(`account.tabs.${id}`) })),
    [t],
  );

  return (
    <div className="animate-fade-up flex min-w-0 flex-1 flex-col">
      <Topbar
        label={t('account.topbar')}
        onOpenMenu={() => setMobileMenuOpen(true)}
      />

      <div className="flex flex-col gap-[18px] border-b border-hair px-6 pb-2 pt-6 sm:px-9">
        <PageHeading className="m-0">{t('account.title')}</PageHeading>
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
      </div>

      <div key={tab} className="animate-fade-up flex-1 overflow-auto px-6 py-7 sm:px-9">
        {tab === 'identity' ? <IdentityTab /> : null}
        {tab === 'security' ? <SecurityTab /> : null}
        {tab === 'preferences' ? <PreferencesTab /> : null}
        {tab === 'modules' ? <ModulesTab /> : null}
        {tab === 'data' ? <DataTab /> : null}
        {tab === 'danger' ? <DangerTab /> : null}
      </div>
    </div>
  );
}
