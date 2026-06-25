import { useState } from 'react';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import FilterChip from '@/ui/dirk/module/FilterChip';
import ManageLink from '@/ui/dirk/module/ManageLink';
import ModuleSidebar from '@/ui/dirk/module/ModuleSidebar';
import SectionLabel from '@/ui/dirk/module/SectionLabel';
import ThreadManagerModal from '@/ui/dirk/module/ThreadManagerModal';

import { useJournalActions, useJournalData, useJournalFilters } from '../context';

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
 * Wrapped in the shared `<ModuleSidebar>` shell (visible only at `lg`
 * AND landscape). In portrait / below `lg` the same `<FiltersContent>`
 * is mounted instead by `<MobileFilters>` in `PrimaryColumn` (same
 * gate, folded by default) — the filters are functional (chip
 * selection + thread manager) so we can't just drop them the way
 * Mood's stats sidebar does.
 */
export default function SideColumn() {
  return (
    <ModuleSidebar>
      <FiltersContent />
    </ModuleSidebar>
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
  const { renameThread, deleteThread } = useJournalActions();
  const [threadsManagerOpen, setThreadsManagerOpen] = useState(false);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <section>
        <SectionLabel variant="section">{t('journal.side.view')}</SectionLabel>
        <div className="flex flex-wrap gap-1">
          <FilterChip
            active={groupBy === 'month'}
            onClick={() => setGroupBy('month')}
            label={t('journal.side.viewByMonth')}
          />
          <FilterChip
            active={groupBy === 'thread'}
            onClick={() => setGroupBy('thread')}
            label={t('journal.side.viewByThread')}
          />
        </div>
      </section>

      <section>
          <SectionLabel
            variant="section"
            action={
              threads.length > 0 ? (
                <ManageLink onClick={() => setThreadsManagerOpen(true)}>
                  {t('journal.side.threadsManageCta')}
                </ManageLink>
              ) : undefined
            }
          >
            {t('journal.side.threads')}
          </SectionLabel>
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

      <ThreadManagerModal
        open={threadsManagerOpen}
        onClose={() => setThreadsManagerOpen(false)}
        names={threads}
        onRename={renameThread}
        onDelete={deleteThread}
        i18nPrefix="journal.threadsManager"
      />
    </div>
  );
}
