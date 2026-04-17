import { useState } from 'react';
import Subheader from '@/ui/layout/headers/Subheader';
import MoodFormView from './views/Form';
import MoodHistoryView from './views/History';

type Tab = 'form' | 'history';

/**
 * Mood module entry point (TSX).
 *
 * MVP port: two tabs (form + history), encrypted CRUD against the new
 * back via the typed `moodClient`. The legacy features (mood chart,
 * emoji picker, random questions, three-positives prompts) will be
 * layered back on once the round-trip is validated in the wild.
 */
export default function MoodIndex() {
  const [active, setActive] = useState<Tab>('form');

  const tabs = [
    { id: 'form' as const, label: 'Nouvelle entrée' },
    { id: 'history' as const, label: 'Historique' },
  ];

  return (
    <div className="flex min-h-full flex-col bg-slate-50 transition-colors dark:bg-slate-950">
      <Subheader
        tabs={tabs.map((t) => ({ id: t.id, label: t.label }))}
        onTabSelect={(id: string) => setActive(id as Tab)}
      />

      <div className="flex-1 bg-white px-4 pt-4 transition-colors dark:bg-slate-900 sm:px-6 lg:px-8">
        {active === 'form' ? <MoodFormView /> : <MoodHistoryView />}
      </div>
    </div>
  );
}
