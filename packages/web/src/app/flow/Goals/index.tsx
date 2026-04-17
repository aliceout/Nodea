import { useState } from 'react';
import Subheader from '@/ui/layout/headers/Subheader';
import GoalsFormView from './views/Form';
import GoalsHistoryView from './views/History';

type Tab = 'form' | 'history';

export default function GoalsIndex() {
  const [active, setActive] = useState<Tab>('form');

  const tabs = [
    { id: 'form' as const, label: 'Nouvel objectif' },
    { id: 'history' as const, label: 'Historique' },
  ];

  return (
    <div className="flex min-h-full flex-col bg-slate-50 transition-colors dark:bg-slate-950">
      <Subheader
        tabs={tabs.map((t) => ({ id: t.id, label: t.label }))}
        onTabSelect={(id: string) => setActive(id as Tab)}
      />
      <div className="flex-1 bg-white px-4 pt-4 transition-colors dark:bg-slate-900 sm:px-6 lg:px-8">
        {active === 'form' ? <GoalsFormView /> : <GoalsHistoryView />}
      </div>
    </div>
  );
}
