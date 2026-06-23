import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { useRefocusTrigger } from '@/lib/use-refocus-trigger';
import Button from '@/ui/atoms/dirk/Button';
import ModuleShell from '@/ui/dirk/module/ModuleShell';
import SpeedDial from '@/ui/dirk/SpeedDial';
import Topbar from '@/ui/dirk/Topbar';
import TopbarSearch from '@/ui/dirk/TopbarSearch';

import SideColumn from './components/SideColumn';
import {
  JournalProvider,
  useJournalActions,
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
  const { t } = useI18n();
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const { search, setSearch } = useJournalFilters();
  const { readingId, formOpen, openCreateForm } = useJournalActions();
  // Focus restore (audit 2026-06, lot G) — must run before the
  // reader early-return so the hook order stays stable.
  const newEntryRef = useRefocusTrigger(formOpen);

  if (readingId !== null) {
    return <ReaderShell />;
  }

  // Just the bold module name (no count) — see Mood for the rationale.
  const topbarLabel = t('journal.title');
  const searchProps = {
    value: search,
    onChange: setSearch,
    placeholder: t('journal.topbar.searchPlaceholder'),
    clearLabel: t('common.search.clearAria'),
  };

  return (
    <ModuleShell
      topbar={
        <Topbar
          label={topbarLabel}
          onOpenMenu={() => setMobileMenuOpen(true)}
          search={
            <TopbarSearch
              {...searchProps}
              openLabel={t('common.search.openAria')}
              closeLabel={t('common.search.closeAria')}
              className="max-w-[35rem]"
            />
          }
        >
          {/* Hide the « + Nouvelle entrée » button while the inline
              form is already open — same posture as Mood / Goals /
              HRT : clicking again would reopen a fresh create form
              on top of an in-progress edit and lose the draft.
              Desktop-only : on mobile the <SpeedDial> below takes over. */}
          {!formOpen ? (
            <Button
              ref={newEntryRef}
              variant="primary"
              size="sm"
              onClick={openCreateForm}
              className="hidden lg:inline-flex"
            >
              {t('journal.topbar.newCta')}
            </Button>
          ) : null}
        </Topbar>
      }
      fab={
        <SpeedDial
          addLabel={t('common.actions.add')}
          closeLabel={t('common.actions.close')}
          hidden={formOpen}
          actions={[{ label: t('journal.topbar.newCta'), onClick: openCreateForm }]}
        />
      }
      side={<SideColumn />}
    >
      <PrimaryColumn />
    </ModuleShell>
  );
}
