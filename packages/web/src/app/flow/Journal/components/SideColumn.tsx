import { useState, type ReactNode } from 'react';

import { formatNumber } from '@/core/i18n/date-format';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import FilterChip from '@/ui/dirk/module/FilterChip';

import { useJournalData, useJournalFilters } from '../context';
import ThreadsManagerModal from './ThreadsManagerModal';

/**
 * Filter sidebar for the Journal. Sections : vue (par fil / par
 * mois), fils (chip per thread, only when grouping by thread),
 * stats (entries / mots / série).
 *
 * The text search lives in the topbar (cf. issue #93 / umbrella
 * #33) — sidebar is for chip-style filters and read-only stats.
 *
 * Reads everything from the data + filters contexts. The « Tous »
 * chip count is the full entry total (not the filtered one) so
 * the user sees how many entries they have overall, not how many
 * survive the current filter.
 */
export default function SideColumn() {
  const { t, tn, language } = useI18n();
  const { entries, stats } = useJournalData();
  const {
    groupBy,
    threads,
    threadFilter,
    view,
    dayFilter,
    setGroupBy,
    setThreadFilter,
    setView,
    setDayFilter,
  } = useJournalFilters();
  const [threadsManagerOpen, setThreadsManagerOpen] = useState(false);

  return (
    <aside className="sticky top-20 flex min-w-0 flex-col gap-6 self-start">
      <section>
        <SectionLabel>{t('journal.side.layout')}</SectionLabel>
        <div className="flex flex-wrap gap-1">
          <FilterChip
            active={view === 'list'}
            onClick={() => setView('list')}
            label={t('journal.side.layoutList')}
          />
          <FilterChip
            active={view === 'calendar'}
            onClick={() => {
              // Switching back to calendar drops any active day
              // focus — the user is moving away from « see day X »
              // and back to the overview.
              if (dayFilter !== null) setDayFilter(null);
              setView('calendar');
            }}
            label={t('journal.side.layoutCalendar')}
          />
        </div>
        {dayFilter !== null ? (
          <button
            type="button"
            onClick={() => setDayFilter(null)}
            className="mt-2 cursor-pointer text-[11.5px] text-accent underline-offset-2 transition-colors hover:underline focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            {t('journal.side.dayFilterClear', { values: { day: dayFilter } })}
          </button>
        ) : null}
      </section>

      {view === 'list' ? (
        <>
      <section>
        <SectionLabel>{t('journal.side.view')}</SectionLabel>
        <div className="flex flex-wrap gap-1">
          <FilterChip
            active={groupBy === 'thread'}
            onClick={() => setGroupBy('thread')}
            label={t('journal.side.viewByThread')}
          />
          <FilterChip
            active={groupBy === 'month'}
            onClick={() => setGroupBy('month')}
            label={t('journal.side.viewByMonth')}
          />
        </div>
      </section>

      {groupBy === 'thread' ? (
        <section>
          <SectionLabel>{t('journal.side.threads')}</SectionLabel>
          {threads.length === 0 ? (
            <p className="text-[12px] italic text-muted">
              {t('journal.side.threadsEmpty')}
            </p>
          ) : (
            <div className="flex flex-wrap gap-1">
              <FilterChip
                active={threadFilter === null}
                onClick={() => setThreadFilter(null)}
                label={t('journal.side.threadsAll')}
                count={entries.length}
              />
              {threads.map((thread) => (
                <FilterChip
                  key={thread}
                  active={threadFilter === thread}
                  onClick={() => setThreadFilter(thread)}
                  label={thread}
                />
              ))}
            </div>
          )}
          {threads.length > 0 ? (
            <button
              type="button"
              onClick={() => setThreadsManagerOpen(true)}
              className="mt-2 cursor-pointer text-[11.5px] text-muted underline-offset-2 transition-colors hover:text-ink hover:underline focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              {t('journal.side.threadsManageCta')}
            </button>
          ) : null}
        </section>
      ) : null}
        </>
      ) : null}

      <ThreadsManagerModal
        open={threadsManagerOpen}
        onClose={() => setThreadsManagerOpen(false)}
      />


      <section>
        <SectionLabel>{t('journal.side.stats')}</SectionLabel>
        <dl className="space-y-2 text-[12px] text-ink-soft">
          <div className="flex items-baseline justify-between gap-2">
            <dt>{t('journal.side.statsEntries')}</dt>
            <dd className="tabular-nums text-ink">{stats.totalEntries}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt>{t('journal.side.statsWords')}</dt>
            <dd className="tabular-nums text-ink">
              {formatNumber(stats.totalWords, language)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt>{t('journal.side.statsStreak')}</dt>
            <dd className="text-right">
              <span className="tabular-nums text-ink">
                {tn('journal.side.streakDay', stats.streakDays)}
              </span>
              {stats.streakDays > 0 ? (
                <p className="text-[11px] text-muted">
                  {stats.streakIncludesToday
                    ? t('journal.side.streakUntilToday')
                    : t('journal.side.streakUntilYesterday')}
                </p>
              ) : null}
            </dd>
          </div>
        </dl>
      </section>
    </aside>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2.5 text-[12px] font-semibold tracking-[0.02em] text-muted">
      {children}
    </div>
  );
}
