import { XMarkIcon } from '@heroicons/react/24/outline';
import { useEffect, useMemo, useRef } from 'react';

import { intlLocale, parseLocalDate } from '@/core/i18n/date-format';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import InlinePanel from '@/ui/dirk/forms/InlinePanel';
import CollapseToggle from '@/ui/dirk/module/CollapseToggle';
import EmptyHint from '@/ui/dirk/module/EmptyHint';
import ModuleSettingsPanel from '@/ui/dirk/module/ModuleSettingsPanel';
import { useModuleSettings } from '@/ui/dirk/module/module-settings-context';
import PageHeading from '@/ui/dirk/module/PageHeading';
import { useEditScrollAnchor } from '@/ui/dirk/module/use-edit-scroll-anchor';
import GroupedVirtualList from '@/ui/atoms/layout/GroupedVirtualList';

import { usePreferences } from '@/core/auth/use-preferences';
import { useNodeaStore } from '@/core/store/nodea-store';

import JournalForm from '../components/JournalForm';
import MobileFilters from '../components/MobileFilters';
import MonthSelector from '../components/MonthSelector';
import YearSelector from '../components/YearSelector';
import { useJournalActions, useJournalData, useJournalFilters } from '../context';
import Chart from './Chart';
import EntryRow from './EntryRow';
import JournalSettings from './JournalSettings';
import OnThisDayPanel from './OnThisDayPanel';

/**
 * Main rendering surface for Journal — sticky H1 + year picker +
 * writing-density heatmap (#56) on top, then « Il y a un an » +
 * the grouped entries list below.
 *
 * Mirrors Mood's `PrimaryColumn` : the heatmap can be folded away
 * via the chevron toggle (`chartCollapsed`), and the year tab
 * strip narrows both the list and the heatmap to a single calendar
 * year (or « En cours » for the rolling-52-weeks default).
 *
 * Reads everything from the data + filters contexts ; no props.
 */
export default function PrimaryColumn() {
  const { t, language } = useI18n();
  const { entries, load } = useJournalData();
  const {
    groupBy,
    groups,
    year,
    chartCollapsed,
    dayFilter,
    toggleChart,
    setChartCollapsed,
    setDayFilter,
  } = useJournalFilters();
  const { formOpen, editingEntry, closeForm } = useJournalActions();
  const { preferences } = usePreferences();
  // « Il y a quelques années » memory panel. Absent ⇒ true (shown by default).
  const showOnThisDay = preferences.journalShowOnThisDay !== false;
  // Editing a row far down: jump to the form on open, glide back to the row
  // on save/cancel (Journal previously stayed put, stranding the user at the
  // off-screen form). Create flows (editingEntry === null) keep their place.
  useEditScrollAnchor(editingEntry !== null);
  const moduleSettings = useModuleSettings();
  // Fold the heatmap whenever an inline panel is open, unfold it when none is —
  // same as Mood, so the fold ANIMATES on every open (Journal used to leave the
  // chart folded after the form, so a later open had nothing to animate). The
  // form's open-fold lives in use-journal-actions; this effect adds the unfold
  // on close. « Nothing open » resets to the persisted default
  // (`journalChartCollapsed`, absent ⇒ expanded) so the start-of-session
  // preference is honoured once an inline panel closes (mirrors Mood).
  useEffect(() => {
    if (moduleSettings?.open) setChartCollapsed(true);
    else if (!formOpen)
      setChartCollapsed(
        useNodeaStore.getState().preferences.journalChartCollapsed === true,
      );
  }, [moduleSettings?.open, formOpen, setChartCollapsed]);
  // The form and « Paramètre du module » are mutually exclusive — opening one
  // closes the other so they never stack (the just-opened panel wins).
  const openPanelsRef = useRef({ form: false, settings: false });
  useEffect(() => {
    const settingsOpen = !!moduleSettings?.open;
    const prev = openPanelsRef.current;
    if (settingsOpen && !prev.settings && formOpen) closeForm();
    else if (formOpen && !prev.form && settingsOpen) moduleSettings?.close();
    openPanelsRef.current = { form: formOpen, settings: settingsOpen };
  }, [formOpen, moduleSettings, closeForm]);
  // Group headers match Goals : uppercase « eyebrow » for both the
  // by-month and by-thread groupings (the « par fil » headers used to
  // be the heavier 15px subtitle, out of step with the rest).
  const groupVariant = 'eyebrow' as const;

  const chartToggleLabel = chartCollapsed
    ? t('journal.primary.showChart')
    : t('journal.primary.hideChart');

  // « Lun. 4 juin 2026 » format for the dismissible day-filter chip.
  // See Mood's PrimaryColumn for the rationale on the local-zone
  // date parsing — same shape so the two modules read alike.
  const dayFilterLabel = useMemo(() => {
    if (!dayFilter) return '';
    const d = parseLocalDate(dayFilter);
    return new Intl.DateTimeFormat(intlLocale(language), {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  }, [dayFilter, language]);

  // While an existing entry is being edited it already shows in the
  // inline form above ; keep it out of the list below so the user
  // isn't looking at the same entry twice (which reads as a duplicate).
  // A group left empty by the removal is dropped so no stray header
  // lingers. Create flows (`editingEntry === null`) pass through.
  const visibleGroups = useMemo(() => {
    if (!editingEntry) return groups;
    return groups
      .map(([label, items]) => [label, items.filter((e) => e.id !== editingEntry.id)] as const)
      .filter(([, items]) => items.length > 0);
  }, [groups, editingEntry]);

  // Fold the heatmap away on the first downward scroll (same posture
  // as Mood) — it opens on landing, then gets out of the way once the
  // user starts reading the entries. Only armed while open ; the
  // listener re-attaches when the toggle reopens it.
  const lastScrollYRef = useRef(0);
  useEffect(() => {
    if (chartCollapsed) return undefined;
    lastScrollYRef.current = window.scrollY;
    function handleScroll() {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollYRef.current;
      lastScrollYRef.current = currentY;
      if (delta > 0 && currentY > 80) {
        // Detach BEFORE toggling — see Mood's PrimaryColumn for the full
        // rationale. A fast scroll (plus the fold's own layout shift)
        // fires several events before the cleanup detaches us; since
        // `toggleChart` flips, the extra calls re-open/re-close the chart
        // (the « sursaut »). Removing the listener here fires it once.
        window.removeEventListener('scroll', handleScroll);
        toggleChart();
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [chartCollapsed, toggleChart]);

  // Defined once, rendered in two places : the mobile filters row
  // (via MobileFilters' `trailing`) and the desktop entries-heading
  // row. Only one is visible per breakpoint (the other's container is
  // hidden), so there's no duplicate on screen.
  // Hidden while an inline panel (form OR « Paramètre du module ») is open: the
  // heatmap is folded away then, so the toggle would be a no-op.
  const chartToggleButton =
    formOpen || moduleSettings?.open ? null : (
      <CollapseToggle open={!chartCollapsed} onToggle={toggleChart} label={chartToggleLabel} />
    );

  return (
    <section className="flex min-w-0 flex-col">
      {/* Sticky upper region — H1 + year picker + heatmap + the
          « Entrées · … » section heading all stay pinned flush
          against the topbar so the user always sees where they are
          while scrolling the entries list. Same `-mt-7 pt-7 top-13`
          pattern as Mood's sticky header. */}
      <div className="sticky top-13 z-10 -mt-7 bg-bg pt-7 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          {/* lg+ only — on mobile the topbar carries the module name.
              `items-start` top-aligns the year selector with the
              sidebar's first heading (« Vue ») across the two columns,
              instead of baseline-pushing it below. */}
          <PageHeading className="mb-0 hidden lg:block">{t('journal.title')}</PageHeading>
          <YearSelector />
        </div>

        {/* Mobile-only filters collapse — sits above the heatmap so
            the toggle stays inside the sticky header, accessible from
            any scroll position. The « carte d'écriture » toggle shares
            this row on mobile (passed as `trailing`). Renders nothing
            at `lg+`, where the sidebar (`SideColumn`) + the desktop
            heading row below take over. */}
        <div className="mt-3 lg:landscape:hidden">
          <MobileFilters trailing={chartToggleButton} />
        </div>

        {/* Animatable collapse — same pattern as Mood : the chart
            stays mounted and rides a CSS grid-rows transition
            (`1fr` ↔ `0fr`) so the writing heatmap unfurls / folds
            smoothly without knowing its height ahead of time. The
            inner `overflow-hidden` clips as the row shrinks ; the
            `pt-6` lives inside so the gap closes with the chart. */}
        <div
          className={cn(
            'grid transition-[grid-template-rows,opacity] duration-300 ease-out',
            chartCollapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
          )}
        >
          <div className="overflow-hidden pt-6">
            <Chart />
          </div>
        </div>

        {/* Desktop entries heading + « carte d'écriture » toggle.
            Hidden on mobile : there the toggle rides the filters row
            above and the heading is redundant with the topbar name.
            The day-filter chip lives here (desktop-only for now). */}
        <div className="mt-3 hidden flex-wrap items-center justify-between gap-x-4 gap-y-2 lg:landscape:flex">
          <div className="flex flex-wrap items-center gap-2">
            {/* Active day-filter chip — explicit clear affordance
                for the heatmap-driven date narrowing. Same shape as
                Mood's so the two modules read alike. */}
            {dayFilter ? (
              <button
                type="button"
                onClick={() => setDayFilter(null)}
                title={t('journal.primary.clearDayFilterTitle')}
                aria-label={t('journal.primary.clearDayFilterAria')}
                className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-hair bg-bg-2 px-2 py-0.5 text-[11px] text-ink-soft transition-colors hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <span>{dayFilterLabel}</span>
                <XMarkIcon className="h-3 w-3" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {/* Month strip — appears when a year is selected, like
                Mood's. Narrows the list to one month ; the heatmap
                above stays full-year. */}
            {year !== null ? <MonthSelector /> : null}
            {chartToggleButton}
          </div>
        </div>
      </div>

      {/* Inline composer — rendered above the « Il y a un an » block
          and the entries list. Same posture as Mood / Goals : a
          bordered card that takes over the writing flow without
          stealing the surrounding chrome. Keyed on the edited entry
          id so switching from edit-A to edit-B remounts the form
          with the right initial values. */}
      {/* « Paramètre du module » — inline panel like the entry composer,
          toggled from the sidebar link; mutually exclusive with the form. */}
      <InlinePanel open={!!moduleSettings?.open}>
        <ModuleSettingsPanel onClose={() => moduleSettings?.close()}>
          <JournalSettings />
        </ModuleSettingsPanel>
      </InlinePanel>

      {formOpen ? (
        <JournalForm
          key={editingEntry?.id ?? 'create'}
          {...(editingEntry ? { initial: editingEntry } : {})}
          onClose={closeForm}
        />
      ) : null}

      {/* « Il y a un an » — issue #58. Renders only on days when
          past-them left a trail ; returns null otherwise. Gated on the
          `journalShowOnThisDay` pref (absent ⇒ shown). */}
      {showOnThisDay ? <OnThisDayPanel /> : null}

      {load.status === 'error' ? (
        <InlineAlert className="mb-4">{load.message}</InlineAlert>
      ) : null}

      <div>
        {load.status === 'loading' && entries.length === 0 ? (
          <EmptyHint>{t('journal.list.loading')}</EmptyHint>
        ) : visibleGroups.length === 0 ? (
          <EmptyHint>{t('journal.list.empty')}</EmptyHint>
        ) : (
          // Single flattened virtualized list across all groups
          // (audit 2026-06 passe 2) : the old per-group
          // VirtualWindowList never crossed its threshold inside any
          // one thread, so nothing was virtualized at scale.
          <GroupedVirtualList
            groups={visibleGroups}
            getItemKey={(e) => e.id}
            renderItem={(entry, isLast) => (
            <EntryRow
              entry={entry}
              showThread={groupBy === 'month'}
              isLast={isLast}
            />
          )}
            variant={groupVariant}
            estimateRowHeight={110}
          />
        )}
      </div>
    </section>
  );
}
