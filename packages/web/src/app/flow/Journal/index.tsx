import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import ModuleShell from '@/ui/dirk/module/ModuleShell';
import Topbar from '@/ui/dirk/Topbar';
import TopbarSearchInput from '@/ui/dirk/TopbarSearchInput';

import SideColumn from './components/SideColumn';
import {
  JournalProvider,
  useJournalActions,
  useJournalData,
  useJournalFilters,
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
 * Create / edit lifecycle : the « + Nouvelle entrée » CTA flips
 * `formOpen` on the actions context ; `PrimaryColumn` renders
 * `JournalForm` inline above the list. The row's edit affordance
 * routes through `openEditForm` (aliased as `editEntry`) and the
 * form pre-fills via the entry payload. Same posture as Mood /
 * Goals / HRT — no global Composer modal.
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
  const { entries } = useJournalData();
  const { search, setSearch } = useJournalFilters();
  const { readingId, formOpen, openCreateForm } = useJournalActions();

  if (readingId !== null) {
    return <ReaderShell />;
  }

  const topbarLabel = tn('journal.topbar.label', entries.length);

  return (
    <ModuleShell
      topbar={
        <Topbar label={topbarLabel} onOpenMenu={() => setMobileMenuOpen(true)}>
          <TopbarSearchInput
            value={search}
            onChange={setSearch}
            placeholder={t('journal.topbar.searchPlaceholder')}
            clearLabel={t('common.search.clearAria')}
            className="w-44 md:w-56"
          />
          {/* Hide the « + Nouvelle entrée » button while the inline
              form is already open — same posture as Mood / Goals /
              HRT : clicking again would reopen a fresh create form
              on top of an in-progress edit and lose the draft. */}
          {!formOpen ? (
            <Button variant="primary" size="sm" onClick={openCreateForm}>
              {t('journal.topbar.newCta')}
            </Button>
          ) : null}
        </Topbar>
      }
      side={<SideColumn />}
    >
      <PrimaryColumn />
    </ModuleShell>
  );
}
