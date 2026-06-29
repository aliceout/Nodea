import { useEffect, useMemo, useRef } from 'react';

import { intlLocale, parseLocalDate } from '@/core/i18n/date-format';
import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';
import ActiveFilterChip from '@/ui/dirk/module/ActiveFilterChip';
import CollapseToggle from '@/ui/dirk/module/CollapseToggle';
import InlinePanel from '@/ui/dirk/forms/InlinePanel';
import EmptyHint from '@/ui/dirk/module/EmptyHint';
import ModuleSettingsPanel from '@/ui/dirk/module/ModuleSettingsPanel';
import { useModuleSettings } from '@/ui/dirk/module/module-settings-context';
import PageHeading from '@/ui/dirk/module/PageHeading';
import { useEditScrollAnchor } from '@/ui/dirk/module/use-edit-scroll-anchor';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import VirtualWindowList from '@/ui/atoms/layout/VirtualWindowList';

import MonthSelector from '../components/MonthSelector';
import MoodForm from '../components/MoodForm';
import YearSelector from '../components/YearSelector';
import { useMoodActions, useMoodData, useMoodFilters } from '../context';
import Chart from './Chart';
import EntryRow from './EntryRow';
import MoodSettings from './MoodSettings';

/** Primary column for the Mood page : sticky header (H1, year
 *  picker, heatmap, section heading + month picker + frise toggle)
 *  on top, scrollable entry list below.
 *
 *  The sticky region pins flush against the topbar so the heatmap
 *  + filters always stay visible while the user scrolls through
 *  entries. The frise can be folded away to reclaim vertical
 *  space ; the toggle's chevron lives inside the sticky pane.
 *
 *  All state is read from the contexts ; no props. */
export default function PrimaryColumn() {
  const { t, language } = useI18n();
  const { entries, load } = useMoodData();
  const {
    year,
    chartCollapsed,
    searchQuery,
    dayFilter,
    scoreFilter,
    filtered,
    toggleChart,
    setChartCollapsed,
    setDayFilter,
    setScoreFilter,
  } = useMoodFilters();
  const { formOpen, editingEntry, closeForm } = useMoodActions();
  const moduleSettings = useModuleSettings();
  // Opening « Paramètre du module » folds the heatmap, exactly like opening the
  // entry form (use-mood-actions folds it for the form) — so the two inline
  // panels open identically. Reopen on close, unless the form still holds it
  // folded (formOpen is a dep so this re-evaluates when the form closes first).
  // « Nothing open » resets to the persisted default (`moodChartCollapsed`,
  // absent ⇒ expanded) rather than hardcoding expanded, so the user's
  // start-of-session preference is honoured once an inline panel closes.
  useEffect(() => {
    if (moduleSettings?.open) setChartCollapsed(true);
    else if (!formOpen)
      setChartCollapsed(useNodeaStore.getState().preferences.moodChartCollapsed === true);
  }, [moduleSettings?.open, formOpen, setChartCollapsed]);
  // The entry form and « Paramètre du module » are mutually exclusive — opening
  // one closes the other so they never stack (the just-opened panel wins).
  const openPanelsRef = useRef({ form: false, settings: false });
  useEffect(() => {
    const settingsOpen = !!moduleSettings?.open;
    const prev = openPanelsRef.current;
    if (settingsOpen && !prev.settings && formOpen) closeForm();
    else if (formOpen && !prev.form && settingsOpen) moduleSettings?.close();
    openPanelsRef.current = { form: formOpen, settings: settingsOpen };
  }, [formOpen, moduleSettings, closeForm]);
  // Editing a row far down: jump to the form on open, glide back to the row
  // on save/cancel. Create flows (editingEntry === null) keep their place.
  useEditScrollAnchor(editingEntry !== null);
  const chartToggleLabel = chartCollapsed
    ? t('mood.primary.showChart')
    : t('mood.primary.hideChart');

  // « Lun. 4 juin 2026 » format for the dismissible day-filter chip.
  // Parses the ISO bits directly to a local-zone date so the label
  // never drifts by a day depending on the user's tz (constructing
  // `new Date('2026-06-04')` treats it as UTC midnight).
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
  // isn't looking at the same entry twice (reads as a duplicate).
  // Create flows (`editingEntry === null`) pass through unchanged.
  const visibleEntries = useMemo(
    () => (editingEntry ? filtered.filter((e) => e.id !== editingEntry.id) : filtered),
    [filtered, editingEntry],
  );

  // Auto-collapse the frise when the user scrolls DOWN past a small
  // threshold — the heatmap is the heaviest visual element in the
  // sticky header, so folding it as the entries-list comes into view
  // reclaims the vertical real-estate the user is actually looking
  // at. No auto-restore on scroll-up : reopening stays user-driven
  // via the toggle, otherwise scrolling near the top would feel
  // jumpy. The effect short-circuits when already collapsed so the
  // listener is detached as soon as there's nothing left to do, and
  // re-attaches when the user clicks the toggle to reopen.
  const lastScrollYRef = useRef(0);
  useEffect(() => {
    if (chartCollapsed) return undefined;
    lastScrollYRef.current = window.scrollY;
    function handleScroll() {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollYRef.current;
      lastScrollYRef.current = currentY;
      if (delta > 0 && currentY > 80) {
        // Detach BEFORE toggling. A fast scroll fires several events
        // before React re-renders and this effect's cleanup detaches us,
        // and the fold animation itself shifts layout (yet more scroll
        // events). `toggleChart` flips, so each extra call re-opens then
        // re-closes the chart — the visible « sursaut ». Removing the
        // listener here makes the collapse fire exactly once.
        window.removeEventListener('scroll', handleScroll);
        toggleChart();
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [chartCollapsed, toggleChart]);

  return (
    <section className="flex min-w-0 flex-col">
      {/* Sticky upper region — H1 + year picker + frise (with its
          legend) + the « Entrées · … » section header all stay
          pinned flush against the topbar so the user always sees
          where they are while scrolling the entries list.
          The `-mt-7 pt-7` pair pulls the wrapper's box up into the
          parent's `py-7` padding while keeping content at its
          original visual position ; combined with `top-13` (the
          topbar's height) this means the wrapper's natural top
          already sits at the sticky threshold, so it pins the
          instant the user starts scrolling. The `bg-bg` then
          opaque-covers any entry scrolling underneath ; `z-10`
          keeps it below the topbar (`z-20`). */}
      <div className="sticky top-13 z-10 -mt-7 bg-bg pt-7 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          {/* lg+ only — on mobile the topbar carries the module name.
              `items-start` top-aligns the year selector with the
              sidebar's first heading (« Répartition ») across the two
              columns, instead of baseline-pushing it below. */}
          <PageHeading className="mb-0 hidden lg:block">{t('mood.title')}</PageHeading>
          <YearSelector />
        </div>

        {/* Animatable collapse — the chart stays mounted and rides a
            CSS grid-rows transition (`1fr` ↔ `0fr`) so the heatmap
            unfurls / folds smoothly without us knowing its natural
            height ahead of time. The inner `overflow-hidden` clips
            the content as the row shrinks ; the `pt-6` lives inside
            the collapsing region so the top-margin gap closes with
            the chart rather than snapping. */}
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

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* Active day-filter chip — surfaces the date picked on the
                heatmap with an explicit clear (otherwise the only undo
                is re-clicking the same cell, not discoverable). */}
            {dayFilter ? (
              <ActiveFilterChip
                label={dayFilterLabel}
                onClear={() => setDayFilter(null)}
                title={t('mood.primary.clearDayFilterTitle')}
                ariaLabel={t('mood.primary.clearDayFilterAria')}
              />
            ) : null}
            {/* Active score-filter chip — set by clicking a segment of
                the Répartition donut. */}
            {scoreFilter !== null ? (
              <ActiveFilterChip
                label={t(`mood.scoreLabels.${scoreFilter}`)}
                onClear={() => setScoreFilter(null)}
                title={t('mood.primary.clearScoreFilterTitle')}
                ariaLabel={t('mood.primary.clearScoreFilterAria')}
              />
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {year !== null ? <MonthSelector /> : null}
            {/* Frise toggle — folds / unfolds the heatmap above. Hidden while an
                inline panel (form OR « Paramètre du module ») is open: the
                heatmap is folded away then, so the toggle would be a no-op. */}
            {formOpen || moduleSettings?.open ? null : (
              <CollapseToggle
                open={!chartCollapsed}
                onToggle={toggleChart}
                label={chartToggleLabel}
              />
            )}
          </div>
        </div>
      </div>

      {/* Inline form — sits above the entries list when the topbar
          « + Nouvelle entrée » button or an edit affordance opens
          it. The form's own Cancel / Save buttons toggle
          `formOpen` back off via `closeForm`. Keyed on
          `editingEntry?.id` so switching from « edit row A » to
          « edit row B » without closing in between remounts the
          form with the right initial values rather than
          re-applying defaults to a still-mounted draft. */}
      {/* « Paramètre du module » — same InlinePanel mount + fade-up as the
          entry form below; only the child + toggle source differ. */}
      <InlinePanel open={!!moduleSettings?.open}>
        <ModuleSettingsPanel onClose={() => moduleSettings?.close()}>
          <MoodSettings />
        </ModuleSettingsPanel>
      </InlinePanel>

      <InlinePanel open={formOpen}>
        <MoodForm
          key={editingEntry?.id ?? 'create'}
          {...(editingEntry ? { initial: editingEntry } : {})}
          onClose={closeForm}
        />
      </InlinePanel>

      {load.status === 'error' ? (
        <InlineAlert className="mt-4">{load.message}</InlineAlert>
      ) : null}

      <div>
        {load.status === 'loading' && entries.length === 0 ? (
          <EmptyHint>{t('mood.primary.loading')}</EmptyHint>
        ) : visibleEntries.length === 0 ? (
          <EmptyHint>
            {searchQuery.trim().length > 0
              ? t('mood.primary.emptySearch')
              : t('mood.primary.empty')}
          </EmptyHint>
        ) : (
          <VirtualWindowList
            items={visibleEntries}
            estimateRowHeight={75}
            getKey={(e) => e.id}
            renderItem={(e) => <EntryRow entry={e} />}
          />
        )}
      </div>
    </section>
  );
}
