import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { useRefocusTrigger } from '@/lib/use-refocus-trigger';
import Button from '@/ui/atoms/dirk/Button';
import ModuleShell from '@/ui/dirk/module/ModuleShell';
import SpeedDial from '@/ui/dirk/SpeedDial';
import Topbar from '@/ui/dirk/Topbar';
import TopbarSearch from '@/ui/dirk/TopbarSearch';

import SideColumn from './components/SideColumn';
import { MoodProvider, useMoodActions, useMoodFilters } from './context';
import PrimaryColumn from './views/PrimaryColumn';

/**
 * Mood — Direction K · Sauge.
 *
 * Single detail view (no more tabs) : a 52 × 7 heatmap of mood
 * scores + the latest entries listed in the canonical Mood shape —
 * three positives, a −2..+2 note, an optional « question du jour »
 * answer and an optional free-form comment. Emoji has been dropped
 * per the redesign ; old entries that still carry one are
 * read-tolerant via `MoodPayloadSchema.moodEmoji.optional()`.
 *
 * Architecture (matches Library / Goals / Journal) :
 *   - `<MoodProvider>` (`./context.tsx`) owns the page-local state
 *     — entries, filters (year / month / chart fold), actions.
 *   - Three hooks (`useMoodData`, `useMoodFilters`, `useMoodActions`)
 *     expose the slices ; consumers re-render only on the slice
 *     they read.
 *   - Sub-components in `components/` (selectors, sidebar, donut,
 *     score chip) and `views/` (primary column, heatmap, entry
 *     row) consume the contexts directly — no prop drilling.
 *   - Pure helpers in `lib/` (mappers, date-format, heatmap, stats)
 *     carry the Vitest coverage.
 *
 * Create / edit lifecycle : the « + Nouvelle entrée » CTA opens
 * the global Composer with `type='mood'`. Edit prefills via the
 * Composer ; new entries flow through the Composer.
 */
export default function MoodPage() {
  return (
    <MoodProvider>
      <MoodView />
    </MoodProvider>
  );
}

/** Top-level rendering surface. Reads only the data slice for the
 *  topbar entry count ; everything else lives inside the sticky
 *  primary column and the sidebar, which subscribe to the contexts
 *  themselves. */
function MoodView() {
  const { t } = useI18n();
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const { searchQuery, setSearchQuery } = useMoodFilters();
  const { formOpen, openCreateForm } = useMoodActions();
  // Focus restore (audit 2026-06, lot G) : the CTA below unmounts
  // while the form is open ; when it comes back, hand focus to it
  // again unless the user already moved on.
  const newEntryRef = useRefocusTrigger(formOpen);

  // Topbar shows just the bold module name — the entry count lived here
  // before but carried little value, and on mobile the name doubles as
  // the page title (the big in-content heading is `lg:`-only now).
  const topbarLabel = t('mood.title');

  return (
    <ModuleShell
      topbar={
        <Topbar label={topbarLabel} onOpenMenu={() => setMobileMenuOpen(true)}>
          <TopbarSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t('mood.topbar.searchPlaceholder')}
            clearLabel={t('common.search.clearAria')}
            openLabel={t('common.search.openAria')}
            closeLabel={t('common.search.closeAria')}
          />
          {/* Hide the « + Nouvelle entrée » button while the inline
              form is already open — same affordance as HRT
              `AdministrationView` (`{!formOpen ? <Button…/> : null}`).
              Otherwise clicking it again while editing would reopen
              a fresh create form on top of an in-progress edit and
              lose the user's draft. */}
          {/* Desktop CTA. On mobile it gives way to the <SpeedDial>
              below — the 52px topbar can't hold search + CTA + burger
              at once (the search was already truncating on phones). */}
          {!formOpen ? (
            <Button
              ref={newEntryRef}
              variant="primary"
              size="sm"
              onClick={openCreateForm}
              className="hidden lg:inline-flex"
            >
              {t('mood.topbar.newCta')}
            </Button>
          ) : null}
        </Topbar>
      }
      fab={
        <SpeedDial
          addLabel={t('common.actions.add')}
          closeLabel={t('common.actions.close')}
          hidden={formOpen}
          actions={[{ label: t('mood.topbar.newCta'), onClick: openCreateForm }]}
        />
      }
      side={<SideColumn />}
    >
      <PrimaryColumn />
    </ModuleShell>
  );
}
