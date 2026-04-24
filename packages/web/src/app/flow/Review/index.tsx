import { useState } from 'react';
import Subheader from '@/ui/layout/headers/Subheader';
import { useReview, type ReviewRecord } from './hooks/useReview';
import ReviewListView from './views/List';
import ReviewWizard from './views/Wizard';
import ReviewReader from './views/Reader';

type Mode =
  | { kind: 'list' }
  | { kind: 'wizard'; year: number; existing?: ReviewRecord }
  | { kind: 'reader'; record: ReviewRecord };

/**
 * Review module (YearCompass-inspired yearly retrospective).
 *
 * Three modes share a single page: list of past reviews, guided wizard
 * (new or edit), and polished reader. The draft auto-save (encrypted
 * localStorage) lives in the wizard — see hooks/useDraft.ts.
 */
export default function ReviewIndex() {
  const { keyMissing, moduleMissing } = useReview();
  const [mode, setMode] = useState<Mode>({ kind: 'list' });

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
          Active le module Review dans les paramètres pour commencer.
        </p>
      </>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-slate-50 transition-colors dark:bg-slate-950">
      <Subheader />
      <div className="flex-1 bg-white px-4 pt-4 transition-colors dark:bg-slate-900 sm:px-6 lg:px-8">
        {mode.kind === 'list' ? (
          <ReviewListView
            onStartNew={(year) => setMode({ kind: 'wizard', year })}
            onOpen={(record) => setMode({ kind: 'reader', record })}
            onEdit={(record) =>
              setMode({ kind: 'wizard', year: record.payload.year, existing: record })
            }
          />
        ) : mode.kind === 'wizard' ? (
          <ReviewWizard
            year={mode.year}
            {...(mode.existing ? { existing: mode.existing } : {})}
            onDone={() => setMode({ kind: 'list' })}
            onCancel={() => setMode({ kind: 'list' })}
          />
        ) : (
          <ReviewReader
            record={mode.record}
            onBack={() => setMode({ kind: 'list' })}
          />
        )}
      </div>
    </div>
  );
}
