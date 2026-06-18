import { useState, type ReactNode } from 'react';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import FilterChip from '@/ui/dirk/module/FilterChip';

import { useJournalData, useJournalFilters } from '../context';
import ThreadsManagerModal from './ThreadsManagerModal';

/**
 * Filter sidebar for the Journal. Sections : vue (par fil / par
 * mois), fils (chip per thread, with a « Gérer les fils » link —
 * #57). The thread filter stays available in both views — it
 * filters the entry set before grouping, so « par mois » narrowed
 * to one fil is a valid, useful combination.
 *
 * The text search lives in the topbar (cf. issue #93 / umbrella
 * #33) — sidebar is for chip-style filters only. The 12-month
 * writing heatmap (#56) lives in the primary column above the
 * entries list ; the per-user totals (« Entrées / Mots / Série »)
 * were removed from the sidebar per the audit pass — the heatmap
 * already conveys « how active have I been » at a glance.
 *
 * Below `lg` the desktop aside is hidden ; the same `<FiltersContent>`
 * is mounted by `<MobileFilters>` inside `PrimaryColumn`, folded by
 * default. Filters are functional (chip selection + thread manager
 * modal trigger) so we can't just drop them on mobile the way Mood's
 * stats sidebar does.
 */
export default function SideColumn() {
  return (
    <aside className="sticky top-20 hidden min-w-0 flex-col gap-6 self-start lg:flex">
      <FiltersContent />
    </aside>
  );
}

/**
 * Filter sections without the `<aside>` wrapper. Re-used by the
 * mobile collapse (`MobileFilters`) and the desktop sidebar
 * (`SideColumn`) so adding a new section lights up on both surfaces.
 *
 * Each mounted instance carries its own `threadsManagerOpen`
 * state + ThreadsManagerModal. In practice only one instance is
 * visible at a time (the wrappers are mutually exclusive via
 * `hidden lg:flex` / `lg:hidden`) so users can never open both
 * modals concurrently.
 */
export function FiltersContent() {
  const { t } = useI18n();
  const { entries } = useJournalData();
  const {
    groupBy,
    threads,
    threadFilter,
    setGroupBy,
    setThreadFilter,
  } = useJournalFilters();
  const [threadsManagerOpen, setThreadsManagerOpen] = useState(false);

  return (
    <div className="flex min-w-0 flex-col gap-6">
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

      <ThreadsManagerModal
        open={threadsManagerOpen}
        onClose={() => setThreadsManagerOpen(false)}
      />
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2.5 text-[12px] font-semibold tracking-[0.02em] text-muted">
      {children}
    </div>
  );
}
