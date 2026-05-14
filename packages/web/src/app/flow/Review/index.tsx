import { useState } from 'react';
import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import EmptyHint from '@/ui/dirk/module/EmptyHint';
import ModuleShell from '@/ui/dirk/module/ModuleShell';
import Topbar from '@/ui/dirk/Topbar';
import { useReview, type ReviewRecord } from './hooks/useReview';
import ReviewListView from './views/List';
import ReviewWizard from './views/Wizard';
import ReviewReader from './views/Reader';

type Mode =
  | { kind: 'list' }
  | { kind: 'wizard'; year: number; existing?: ReviewRecord; resume?: boolean }
  | { kind: 'reader'; record: ReviewRecord };

/**
 * Review module — Direction K · Sauge.
 *
 * YearCompass-inspired yearly retrospective. Three modes share a
 * single page: list of past reviews, guided wizard (new or edit),
 * and polished reader. The draft auto-save (encrypted localStorage)
 * lives in the wizard — see hooks/useDraft.ts.
 *
 * Each mode renders its own `<ModuleShell>` so the topbar label and
 * right-side action can adapt to context (« + Nouveau bilan » in
 * list mode, « Quitter » during the wizard, « ← Retour » when
 * reading). The index just dispatches.
 */
export default function ReviewIndex() {
  const { t } = useI18n();
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const { keyMissing, moduleMissing } = useReview();
  const [mode, setMode] = useState<Mode>({ kind: 'list' });

  if (keyMissing) {
    return (
      <ModuleShell
        topbar={<Topbar label={t('review.title')} onOpenMenu={() => setMobileMenuOpen(true)} />}
      >
        <EmptyHint>{t('review.errors.keyMissing')}</EmptyHint>
      </ModuleShell>
    );
  }
  if (moduleMissing) {
    return (
      <ModuleShell
        topbar={<Topbar label={t('review.title')} onOpenMenu={() => setMobileMenuOpen(true)} />}
      >
        <EmptyHint>{t('review.errors.moduleMissing')}</EmptyHint>
      </ModuleShell>
    );
  }

  if (mode.kind === 'wizard') {
    return (
      <ReviewWizard
        year={mode.year}
        {...(mode.existing ? { existing: mode.existing } : {})}
        {...(mode.resume ? { resume: true } : {})}
        onDone={() => setMode({ kind: 'list' })}
        onCancel={() => setMode({ kind: 'list' })}
      />
    );
  }

  if (mode.kind === 'reader') {
    return (
      <ReviewReader
        record={mode.record}
        onBack={() => setMode({ kind: 'list' })}
      />
    );
  }

  return (
    <ReviewListView
      onStartNew={(year) => setMode({ kind: 'wizard', year })}
      onResume={(year) => setMode({ kind: 'wizard', year, resume: true })}
      onOpen={(record) => setMode({ kind: 'reader', record })}
      onEdit={(record) =>
        setMode({ kind: 'wizard', year: record.payload.year, existing: record })
      }
    />
  );
}
