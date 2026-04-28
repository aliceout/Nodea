import { useEffect, useMemo, useState } from 'react';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { PassagePayload } from '@nodea/shared';

import { passageClient } from '@/core/api/modules/passage';
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
} from '@/core/store/nodea-store';
import type { DecryptedRecord } from '@/core/api/modules/collection-client';
import { JournalContent } from '@/lib/journal-markdown';
import Button from '@/ui/atoms/dirk/Button';
import Input from '@/ui/atoms/dirk/Input';
import EmptyHint from '@/ui/dirk/EmptyHint';
import FilterChip from '@/ui/dirk/FilterChip';
import GroupBlock from '@/ui/dirk/GroupBlock';
import HoverActions from '@/ui/dirk/HoverActions';
import ModuleShell from '@/ui/dirk/ModuleShell';
import PageHeading from '@/ui/dirk/PageHeading';
import Topbar from '@/ui/dirk/Topbar';

/**
 * Journal — Direction K · Sauge.
 *
 * What the legacy `passage` module used to be (date / thread /
 * title / content): a free-form journal grouped by thread for
 * life-transition moments and evening writes. The K Passages
 * module redesigned itself around literary book quotes, so the
 * journaling shape moved here under a new name.
 *
 * Backed by the existing `passage_entries` table (the schema
 * already matches and we don't pay a migration); each module gets
 * its own `moduleUserId`, so journal entries are isolated from
 * any data the legacy `passage` module wrote.
 */

interface JournalEntry {
  id: string;
  /** ISO timestamp from the saved record. */
  dateIso: string;
  /** Display label (today / yesterday / full date). */
  dateLabel: string;
  thread: string;
  title: string | null;
  content: string;
}

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; entries: JournalEntry[] }
  | { status: 'error'; message: string };

export default function JournalPage() {
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const openComposer = useNodeaStore((s) => s.openComposer);
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const moduleUserId = modules['journal']?.moduleUserId ?? null;
  const journalVersion = useNodeaStore((s) => s.journalVersion);
  const bumpJournalVersion = useNodeaStore((s) => s.bumpJournalVersion);

  const [load, setLoad] = useState<LoadState>({ status: 'idle' });
  const [threadFilter, setThreadFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [groupBy, setGroupBy] = useState<'thread' | 'month'>('thread');

  useEffect(() => {
    if (!mainKey || !moduleUserId) return undefined;
    let cancelled = false;
    setLoad({ status: 'loading' });
    passageClient
      .list(moduleUserId, mainKey)
      .then((records) => {
        if (cancelled) return;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const entries = records
          .map((r) => recordToEntry(r, today))
          // Newest first.
          .sort((a, b) => b.dateIso.localeCompare(a.dateIso));
        setLoad({ status: 'ready', entries });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'Erreur lors du chargement du journal.';
        setLoad({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
    // `journalVersion` is bumped by the Composer's JournalBody after
    // a successful save — re-runs the fetch without a page reload.
  }, [mainKey, moduleUserId, journalVersion]);

  function handleEdit(entry: JournalEntry): void {
    openComposer('journal', {
      type: 'journal',
      id: entry.id,
      payload: {
        type: 'passage.entry',
        date: entry.dateIso,
        thread: entry.thread,
        title: entry.title,
        content: entry.content,
      },
    });
  }

  async function handleDelete(entry: JournalEntry): Promise<void> {
    if (!mainKey || !moduleUserId) return;
    const label = entry.title ?? entry.dateLabel;
    if (!window.confirm(`Supprimer « ${label} » ?`)) return;
    const previous = load;
    setLoad((prev) =>
      prev.status === 'ready'
        ? { status: 'ready', entries: prev.entries.filter((e) => e.id !== entry.id) }
        : prev,
    );
    try {
      await passageClient.remove(moduleUserId, mainKey, entry.id);
      bumpJournalVersion();
    } catch (err) {
      setLoad(previous);
      if (import.meta.env.DEV) console.warn('journal: delete failed', err);
    }
  }

  const entries: ReadonlyArray<JournalEntry> =
    load.status === 'ready' ? load.entries : EMPTY;

  const threads = useMemo<string[]>(() => {
    const set = new Set<string>();
    for (const e of entries) {
      for (const t of splitThreads(e.thread)) set.add(t);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [entries]);

  const filtered = useMemo<JournalEntry[]>(() => {
    const needle = search.trim().toLocaleLowerCase('fr');
    return entries.filter((e) => {
      if (threadFilter && !splitThreads(e.thread).includes(threadFilter)) {
        return false;
      }
      if (needle.length > 0) {
        const haystack = `${e.title ?? ''}\n${e.content}`.toLocaleLowerCase('fr');
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [entries, threadFilter, search]);

  const groups = useMemo<Array<[string, JournalEntry[]]>>(() => {
    const map = new Map<string, JournalEntry[]>();
    if (groupBy === 'month') {
      // Group by year/month derived from the entry's ISO date.
      // Sort buckets by their key descending so the freshest month
      // sits on top — natural for a journal scroll.
      for (const entry of filtered) {
        const key = entry.dateIso.slice(0, 7); // YYYY-MM
        const bucket = map.get(key) ?? [];
        bucket.push(entry);
        map.set(key, bucket);
      }
      return Array.from(map.entries())
        .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
        .map(([k, items]) => [formatMonthLabel(k), items]);
    }
    // Default: group by thread (multi-thread entries land in each
    // of their thread buckets — same convention as Goals).
    for (const entry of filtered) {
      const keys = splitThreads(entry.thread);
      const list = keys.length > 0 ? keys : ['— sans thread —'];
      for (const key of list) {
        const bucket = map.get(key) ?? [];
        bucket.push(entry);
        map.set(key, bucket);
      }
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, 'fr'));
  }, [filtered, groupBy]);

  const stats = useMemo(() => computeStats(entries), [entries]);

  return (
    <ModuleShell
      topbar={
        <Topbar
          label={`Journal · ${entries.length} ${entries.length === 1 ? 'entrée' : 'entrées'}`}
          onOpenMenu={() => setMobileMenuOpen(true)}
        >
          <Button variant="primary" size="sm" onClick={() => openComposer('journal')}>
            + Nouvelle entrée
          </Button>
        </Topbar>
      }
      side={
        <SideColumn
          search={search}
          onSearchChange={setSearch}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          threads={threads}
          activeThread={threadFilter}
          onThreadChange={setThreadFilter}
          totalCount={entries.length}
          stats={stats}
        />
      }
    >
      <PrimaryColumn
        load={load}
        total={entries.length}
        groups={groups}
        groupVariant={groupBy === 'month' ? 'eyebrow' : 'subtitle'}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </ModuleShell>
  );
}

const EMPTY: ReadonlyArray<JournalEntry> = [];

interface PrimaryColumnProps {
  load: LoadState;
  total: number;
  groups: Array<[string, JournalEntry[]]>;
  groupVariant: 'subtitle' | 'eyebrow';
  onEdit: (entry: JournalEntry) => void;
  onDelete: (entry: JournalEntry) => void | Promise<void>;
}

function PrimaryColumn({
  load,
  total,
  groups,
  groupVariant,
  onEdit,
  onDelete,
}: PrimaryColumnProps) {
  return (
    <section className="flex min-w-0 flex-col">
      <PageHeading>Journal</PageHeading>

      {load.status === 'error' ? (
        <p
          role="alert"
          className="mb-4 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[12px] text-danger"
        >
          {load.message}
        </p>
      ) : null}

      <div>
        {load.status === 'loading' && total === 0 ? (
          <EmptyHint>Chargement du journal…</EmptyHint>
        ) : groups.length === 0 ? (
          <EmptyHint>Aucune entrée pour cette sélection.</EmptyHint>
        ) : (
          groups.map(([groupLabel, items]) => (
            <GroupBlock
              key={groupLabel}
              label={groupLabel}
              count={items.length}
              countNoun="entrée"
              variant={groupVariant}
            >
              {items.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  onEdit={() => onEdit(entry)}
                  onDelete={() => onDelete(entry)}
                />
              ))}
            </GroupBlock>
          ))
        )}
      </div>
    </section>
  );
}

interface EntryRowProps {
  entry: JournalEntry;
  onEdit: () => void;
  onDelete: () => void;
}

function EntryRow({ entry, onEdit, onDelete }: EntryRowProps) {
  return (
    <li className="group flex items-start gap-4 border-b border-hair py-4 last:border-b-0">
      <div className="w-[110px] shrink-0 text-[12px] tabular-nums text-muted">
        {entry.dateLabel}
      </div>

      <div className="min-w-0 flex-1">
        {entry.title ? (
          <p className="mb-1 text-[14px] font-medium text-ink">{entry.title}</p>
        ) : null}
        <JournalContent text={entry.content} />
      </div>

      <HoverActions>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          onClick={onEdit}
          aria-label="Modifier l’entrée"
          title="Modifier"
        >
          <PencilSquareIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          variant="danger-ghost"
          size="sm"
          iconOnly
          onClick={onDelete}
          aria-label="Supprimer l’entrée"
          title="Supprimer"
        >
          <TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </HoverActions>
    </li>
  );
}

interface JournalStats {
  totalEntries: number;
  totalWords: number;
  /** Days in a row, ending today (or yesterday if today's empty
   *  but the streak is otherwise live). 0 when there's no
   *  qualifying recent run. */
  streakDays: number;
  /** Whether today's date already has at least one entry.
   *  Drives the « jusqu'à aujourd'hui » vs « jusqu'à hier »
   *  caption next to the streak number. */
  streakIncludesToday: boolean;
}

interface SideColumnProps {
  search: string;
  onSearchChange: (next: string) => void;
  groupBy: 'thread' | 'month';
  onGroupByChange: (next: 'thread' | 'month') => void;
  threads: string[];
  activeThread: string | null;
  onThreadChange: (next: string | null) => void;
  totalCount: number;
  stats: JournalStats;
}

function SideColumn({
  search,
  onSearchChange,
  groupBy,
  onGroupByChange,
  threads,
  activeThread,
  onThreadChange,
  totalCount,
  stats,
}: SideColumnProps) {
  return (
    <aside className="sticky top-20 flex min-w-0 flex-col gap-6 self-start">
      <section>
        <SectionLabel>Recherche</SectionLabel>
        <Input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Titre ou contenu…"
          aria-label="Rechercher dans le journal"
        />
      </section>

      <section>
        <SectionLabel>Vue</SectionLabel>
        <div className="flex flex-wrap gap-1">
          <FilterChip
            active={groupBy === 'thread'}
            onClick={() => onGroupByChange('thread')}
            label="Par fil"
          />
          <FilterChip
            active={groupBy === 'month'}
            onClick={() => onGroupByChange('month')}
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
                active={activeThread === null}
                onClick={() => onThreadChange(null)}
                label="Tous"
                count={totalCount}
              />
              {threads.map((t) => (
                <FilterChip
                  key={t}
                  active={activeThread === t}
                  onClick={() => onThreadChange(t)}
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
            <dd className="tabular-nums text-ink">
              {stats.totalEntries}
            </dd>
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2.5 text-[12px] font-semibold tracking-[0.02em] text-muted">{children}</div>
  );
}

/* ---------- Helpers ------------------------------------------------------- */

function recordToEntry(
  record: DecryptedRecord<PassagePayload>,
  today: Date,
): JournalEntry {
  const p = record.payload;
  return {
    id: record.id,
    dateIso: p.date ?? record.createdAt,
    dateLabel: formatEntryLabel(p.date ?? record.createdAt, today),
    thread: p.thread ?? '',
    title: p.title ?? null,
    content: p.content ?? '',
  };
}

const ENTRY_SAME_YEAR_FMT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const ENTRY_CROSS_YEAR_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function formatEntryLabel(rawIso: string, today: Date): string {
  const d = new Date(rawIso);
  if (Number.isNaN(d.getTime())) return rawIso;
  const dayMs = 24 * 3600 * 1000;
  const dStart = new Date(d);
  dStart.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - dStart.getTime()) / dayMs);
  if (diff === 0) return 'Aujourd’hui';
  if (diff === 1) return 'Hier';
  const fmt =
    d.getFullYear() === today.getFullYear() ? ENTRY_SAME_YEAR_FMT : ENTRY_CROSS_YEAR_FMT;
  const formatted = fmt.format(d);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

const MONTH_LABEL_FMT = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  year: 'numeric',
});

/**
 * Render a `YYYY-MM` group key as « mars 2026 ». Falls back to the
 * raw key if parsing fails (defensive — should never happen on
 * payloads we wrote ourselves).
 */
function formatMonthLabel(yyyymm: string): string {
  const [yStr, mStr] = yyyymm.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return yyyymm;
  const formatted = MONTH_LABEL_FMT.format(new Date(y, m - 1, 1));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * Aggregate entry-level stats for the SideColumn « Stats » block.
 *
 * - `totalWords` counts whitespace-separated tokens across each
 *   entry's content + title. Cheap, locale-agnostic enough for an
 *   indicator.
 * - `streakDays` walks back from today through `entries` (assumed
 *   newest-first) counting consecutive days with at least one
 *   entry. The streak survives a missing « today » as long as
 *   « yesterday » is covered — a journal you write each evening
 *   shouldn't reset to 0 the moment you wake up.
 */
function computeStats(entries: ReadonlyArray<JournalEntry>): JournalStats {
  let totalWords = 0;
  const dayKeys = new Set<string>();
  for (const entry of entries) {
    const text = `${entry.title ?? ''} ${entry.content}`;
    totalWords += countWords(text);
    const day = entry.dateIso.slice(0, 10);
    if (day) dayKeys.add(day);
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = isoDay(today);
  const yesterdayKey = isoDay(new Date(today.getTime() - 24 * 3600 * 1000));
  const streakIncludesToday = dayKeys.has(todayKey);
  let cursor = streakIncludesToday
    ? new Date(today)
    : dayKeys.has(yesterdayKey)
      ? new Date(today.getTime() - 24 * 3600 * 1000)
      : null;
  let streakDays = 0;
  while (cursor && dayKeys.has(isoDay(cursor))) {
    streakDays += 1;
    cursor = new Date(cursor.getTime() - 24 * 3600 * 1000);
  }
  return {
    totalEntries: entries.length,
    totalWords,
    streakDays,
    streakIncludesToday,
  };
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Comma-separated thread tokens — same convention as Goals so an
 * entry tagged `#A, #B` lands in both fils. Empty / whitespace
 * tokens drop, dedupe preserves order.
 */
function splitThreads(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of raw.split(',')) {
    const trimmed = token.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}
