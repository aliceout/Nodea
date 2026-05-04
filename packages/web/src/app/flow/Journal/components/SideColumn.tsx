import type { ReactNode } from 'react';

import { formatNumber } from '@/core/i18n/date-format';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Input from '@/ui/atoms/dirk/Input';
import FilterChip from '@/ui/dirk/module/FilterChip';

import { useJournalData, useJournalFilters } from '../context';

/**
 * Filter sidebar for the Journal. Sections : recherche texte, vue
 * (par fil / par mois), fils (chip per thread, only when grouping
 * by thread), stats (entries / mots / série).
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
    search,
    groupBy,
    threads,
    threadFilter,
    setSearch,
    setGroupBy,
    setThreadFilter,
  } = useJournalFilters();

  return (
    <aside className="sticky top-20 flex min-w-0 flex-col gap-6 self-start">
      <section>
        <SectionLabel>{t('journal.side.search')}</SectionLabel>
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('journal.side.searchPlaceholder')}
          aria-label={t('journal.side.searchAria')}
        />
      </section>

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
        </section>
      ) : null}

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
