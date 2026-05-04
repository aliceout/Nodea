import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import ModuleShell from '@/ui/dirk/module/ModuleShell';
import Topbar from '@/ui/dirk/Topbar';

import SideColumn from './components/SideColumn';
import {
  JournalProvider,
  useJournalActions,
  useJournalData,
} from './context';
import PrimaryColumn from './views/PrimaryColumn';
import ReaderShell from './views/ReaderShell';

/**
 * Journal — Direction K · Sauge.
 *
 * Free-form journal grouped by thread (or month), for evening
 * writes and life-transition moments. Date / thread / title /
 * content shape, attachments inline.
 *
 * Architecture :
 *   - `<JournalProvider>` (`./context.tsx`) owns the page-local
 *     state — entries, filters, reader UI state, actions.
 *   - Three hooks (`useJournalData`, `useJournalFilters`,
 *     `useJournalActions`) expose the slices ; consumers re-render
 *     only on the slice they read.
 *   - Sub-components in `components/` (sidebar) and `views/`
 *     (primary column, entry row, clamped content, reader shell)
 *     consume the contexts directly — no prop drilling.
 *   - Pure helpers in `lib/` (mappers, threads, date format,
 *     stats) carry the Vitest coverage.
 *
 * Create / edit lifecycle : the « + Nouvelle entrée » CTA opens
 * the global Composer with `type='journal'`. Edit prefills via
 * the Composer ; new entries flow through the Composer.
 */
export default function JournalPage() {
  return (
    <JournalProvider>
      <JournalView />
    </JournalProvider>
  );
}

/** Top-level rendering surface. Branches between the focus reader
 *  (when the user is reading an entry) and the regular module
 *  shell. Both routes rely on the `<JournalProvider>` for state. */
function JournalView() {
  const { t, tn } = useI18n();
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const openComposer = useNodeaStore((s) => s.openComposer);
  const { entries } = useJournalData();
  const { readingId } = useJournalActions();

  if (readingId !== null) {
    return <ReaderShell />;
  }

  const topbarLabel = tn('journal.topbar.label', entries.length);

  return (
    <ModuleShell
      topbar={
        <Topbar label={topbarLabel} onOpenMenu={() => setMobileMenuOpen(true)}>
          <Button variant="primary" size="sm" onClick={() => openComposer('journal')}>
            {t('journal.topbar.newCta')}
          </Button>
        </Topbar>
      }
      side={<SideColumn />}
    >
      <PrimaryColumn />
    </ModuleShell>
  );
}
