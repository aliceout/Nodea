import { useMemo, useState } from 'react';

import { formatLongDate } from '@/core/i18n/date-format';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Heatmap from '@/ui/dirk/Heatmap';
import EmptyHint from '@/ui/dirk/module/EmptyHint';
import PageHeading from '@/ui/dirk/module/PageHeading';

import { useJournalData, useJournalFilters } from '../context';
import {
  aggregateByDay,
  densityToIntensity,
  type DayDensity,
} from '../lib/day-density';
import { isoDay } from '../lib/stats';

/**
 * Calendar / heatmap view of Journal writing density (issue #56).
 * GitHub-contributions style : 52 weeks × 7 days, each cell coloured
 * by the day's writing intensity (word-count buckets — see
 * `densityToIntensity`).
 *
 * Year selector to the right of the heading ; defaults to the
 * current year, scrolls through every year that has at least one
 * entry plus the current one (so the user always sees « 2026 »
 * even on an empty year).
 *
 * Click on a cell : focuses the list view on that exact day
 * (`setDayFilter(iso)`) and flips the view back to `'list'` —
 * « pas une nouvelle vue, juste un focus temporel » per the ticket.
 *
 * Reads from the data + filters contexts ; no props. The active
 * year is local state — it's a per-session affordance, no need to
 * persist.
 */
export default function CalendarView() {
  const { t, language } = useI18n();
  const { entries } = useJournalData();
  const { setDayFilter, setView } = useJournalFilters();

  // All years that have at least one entry, plus today's year — so
  // the picker always offers « now » even on an empty journal.
  const years = useMemo<ReadonlyArray<number>>(() => {
    const set = new Set<number>([new Date().getFullYear()]);
    for (const e of entries) {
      const y = parseInt(e.dateIso.slice(0, 4), 10);
      if (Number.isFinite(y)) set.add(y);
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [entries]);

  const [year, setYear] = useState<number>(() => new Date().getFullYear());

  // Aggregate once per `entries` change ; the heatmap then looks up
  // each rendered cell in O(1).
  const byDay = useMemo(() => aggregateByDay(entries), [entries]);
  const getIntensity = useMemo(
    () => (date: Date) => densityToIntensity(byDay.get(isoDay(date))),
    [byDay],
  );

  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);

  function getTooltip(date: Date): string {
    const iso = isoDay(date);
    const density: DayDensity | undefined = byDay.get(iso);
    const label = formatLongDate(iso, language);
    if (!density || density.count === 0) {
      return t('journal.calendar.tooltipEmpty', { values: { date: label } });
    }
    return t('journal.calendar.tooltip', {
      values: { date: label, count: density.count, words: density.words },
    });
  }

  function onCellClick(date: Date) {
    setDayFilter(isoDay(date));
    setView('list');
  }

  const totalThisYear = useMemo(() => {
    let count = 0;
    let words = 0;
    for (const [day, d] of byDay.entries()) {
      if (day.startsWith(`${year}`)) {
        count += d.count;
        words += d.words;
      }
    }
    return { count, words };
  }, [byDay, year]);

  return (
    <section className="flex min-w-0 flex-col">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <PageHeading>{t('journal.calendar.heading')}</PageHeading>
        <label className="flex items-center gap-2 text-[12px] text-muted">
          {t('journal.calendar.yearLabel')}
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            className="rounded-md border border-hair bg-bg px-2 py-1 text-[13px] text-ink"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>

      {totalThisYear.count === 0 ? (
        <EmptyHint>{t('journal.calendar.empty', { values: { year } })}</EmptyHint>
      ) : (
        <>
          <p className="mb-4 text-[12.5px] text-ink-soft">
            {t('journal.calendar.summary', {
              values: { count: totalThisYear.count, words: totalThisYear.words },
            })}
          </p>
          <div className="overflow-x-auto pb-2">
            <Heatmap
              start={start}
              end={end}
              getIntensity={getIntensity}
              getTooltip={getTooltip}
              onCellClick={onCellClick}
              ariaLabel={t('journal.calendar.ariaLabel', { values: { year } })}
            />
          </div>
          <p className="mt-4 text-[11.5px] italic text-muted">
            {t('journal.calendar.hint')}
          </p>
        </>
      )}
    </section>
  );
}
