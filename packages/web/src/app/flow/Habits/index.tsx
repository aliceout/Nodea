import { useState } from 'react';
import Subheader from '@/ui/layout/headers/Subheader';
import HabitsFormView from './views/Form';
import HabitsHistoryView from './views/History';
import { useHabits } from './hooks/useHabits';

type Tab = 'form' | 'history';

export default function HabitsIndex() {
  const [active, setActive] = useState<Tab>('history');
  const { keyMissing, moduleMissing } = useHabits();

  const tabs = [
    { id: 'history' as const, label: 'Mes habitudes' },
    { id: 'form' as const, label: 'Nouvelle habitude' },
  ];

  if (keyMissing) {
    return (
      <>
        <Subheader />
        <p className="py-8 text-center text-sm text-red-600">
          Clé principale absente — reconnecte-toi.
        </p>
      </>
    );
  }
  if (moduleMissing) {
    return (
      <>
        <Subheader />
        <p className="py-8 text-center text-sm opacity-70">
          Active le module Habits dans les paramètres pour commencer.
        </p>
      </>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-slate-50 transition-colors dark:bg-slate-950">
      <Subheader
        tabs={tabs.map((t) => ({ id: t.id, label: t.label }))}
        onTabSelect={(id: string) => setActive(id as Tab)}
      />
      <div className="flex-1 bg-white px-4 pt-4 transition-colors dark:bg-slate-900 sm:px-6 lg:px-8">
        {active === 'form' ? <HabitsFormView /> : <HabitsHistoryView />}
      </div>
    </div>
  );
}
