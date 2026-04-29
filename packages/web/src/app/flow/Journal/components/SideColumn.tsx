import type { ReactNode } from 'react';

import Input from '@/ui/atoms/dirk/Input';
import FilterChip from '@/ui/dirk/FilterChip';

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
        <SectionLabel>Recherche</SectionLabel>
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Titre ou contenu…"
          aria-label="Rechercher dans le journal"
        />
      </section>

      <section>
        <SectionLabel>Vue</SectionLabel>
        <div className="flex flex-wrap gap-1">
          <FilterChip
            active={groupBy === 'thread'}
            onClick={() => setGroupBy('thread')}
            label="Par fil"
          />
          <FilterChip
            active={groupBy === 'month'}
            onClick={() => setGroupBy('month')}
            label="Par mois"
          />
        </div>
      </section>

      {groupBy === 'thread' ? (
        <section>
          <SectionLabel>Fils</SectionLabel>
          {threads.length === 0 ? (
            <p className="text-[12px] italic text-muted">
              Tu n’as pas encore créé de fil.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1">
              <FilterChip
                active={threadFilter === null}
                onClick={() => setThreadFilter(null)}
                label="Tous"
                count={entries.length}
              />
              {threads.map((t) => (
                <FilterChip
                  key={t}
                  active={threadFilter === t}
                  onClick={() => setThreadFilter(t)}
                  label={t}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section>
        <SectionLabel>Stats</SectionLabel>
        <dl className="space-y-2 text-[12px] text-ink-soft">
          <div className="flex items-baseline justify-between gap-2">
            <dt>Entrées</dt>
            <dd className="tabular-nums text-ink">{stats.totalEntries}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt>Mots écrits</dt>
            <dd className="tabular-nums text-ink">
              {stats.totalWords.toLocaleString('fr-FR')}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt>Série</dt>
            <dd className="text-right">
              <span className="tabular-nums text-ink">
                {stats.streakDays}{' '}
                {stats.streakDays === 1 ? 'jour' : 'jours'}
              </span>
              {stats.streakDays > 0 ? (
                <p className="text-[11px] text-muted">
                  {stats.streakIncludesToday
                    ? "jusqu'à aujourd'hui"
                    : "jusqu'à hier"}
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
