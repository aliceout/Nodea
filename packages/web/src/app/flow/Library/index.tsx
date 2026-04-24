import { useState } from 'react';
import Subheader from '@/ui/layout/headers/Subheader';
import LibraryGridView from './views/Grid';
import LibraryFormView from './views/Form';
import { useLibrary } from './hooks/useLibrary';

type Tab = 'grid' | 'form';

export default function LibraryIndex() {
  const [active, setActive] = useState<Tab>('grid');
  const { keyMissing, moduleMissing } = useLibrary();

  const tabs = [
    { id: 'grid' as const, label: 'Ma bibliothèque' },
    { id: 'form' as const, label: 'Ajouter' },
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
          Active le module Library dans les paramètres pour commencer.
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
        {active === 'form' ? (
          <LibraryFormView onDone={() => setActive('grid')} />
        ) : (
          <LibraryGridView />
        )}
      </div>
    </div>
  );
}
