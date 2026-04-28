import { useEffect, useMemo, useState } from 'react';
import { Bars3Icon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import {
  GOAL_STATUS_VALUES,
  type GoalsPayload,
} from '@nodea/shared';

import { goalsClient } from '@/core/api/modules/goals';
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
} from '@/core/store/nodea-store';
import type { DecryptedRecord } from '@/core/api/modules/collection-client';
import { cn } from '@/lib/utils';
import Button from '@/ui/atoms/dirk/Button';
import Topbar from '@/ui/dirk/Topbar';

/**
 * Goals — Direction K · Sauge.
 *
 * Single detail view (no more Form/History tabs). Sticky topbar
 * + page header + 2-column body: main = goals grouped by thread
 * (or year), side = filters and stats. Each row carries an inline
 * status pill (click to cycle open → wip → done → open) and a
 * trash affordance.
 *
 * Create / edit lifecycle: the "+ Nouvel objectif" CTA opens the
 * global Composer with `type='goal'`. The Composer's `goal` body
 * is currently a single textarea — a richer form (title + date +
 * status + thread + note) and an edit-prefill flow are tracked
 * for follow-up. For now this page is a faithful list with status
 * + delete inline; new entries flow through the Composer.
 */

type CanonicalStatus = 'open' | 'wip' | 'done';
const CANONICAL_STATUSES: ReadonlyArray<CanonicalStatus> = ['open', 'wip', 'done'];

interface GoalEntry {
  id: string;
  date: string;
  title: string;
  note: string;
  status: CanonicalStatus;
  thread: string;
}

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; entries: GoalEntry[] }
  | { status: 'error'; message: string };

export default function GoalsPage() {
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const openComposer = useNodeaStore((s) => s.openComposer);
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const moduleUserId = modules['goals']?.moduleUserId ?? null;
  const goalsVersion = useNodeaStore((s) => s.goalsVersion);

  const [load, setLoad] = useState<LoadState>({ status: 'idle' });
  const [statusFilter, setStatusFilter] = useState<CanonicalStatus | null>(null);
  const [groupBy, setGroupBy] = useState<'thread' | 'year'>('thread');

  useEffect(() => {
    if (!mainKey || !moduleUserId) return undefined;
    let cancelled = false;
    setLoad({ status: 'loading' });
    goalsClient
      .list(moduleUserId, mainKey)
      .then((records) => {
        if (cancelled) return;
        const entries = records.map(recordToEntry).sort(byDateDesc);
        setLoad({ status: 'ready', entries });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'Erreur lors du chargement des objectifs.';
        setLoad({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
    // `goalsVersion` is bumped by the Composer's GoalBody after a
    // successful create — including it here re-runs the fetch so the
    // new entry shows up without a page reload.
  }, [mainKey, moduleUserId, goalsVersion]);

  async function handleToggleStatus(entry: GoalEntry): Promise<void> {
    if (!mainKey || !moduleUserId) return;
    const next = nextStatus(entry.status);
    // Optimistic — flip the in-memory copy first, roll back on error.
    setLoad((prev) =>
      prev.status === 'ready'
        ? {
            status: 'ready',
            entries: prev.entries.map((e) =>
              e.id === entry.id ? { ...e, status: next } : e,
            ),
          }
        : prev,
    );
    try {
      await goalsClient.update(moduleUserId, mainKey, entry.id, {
        date: entry.date,
        title: entry.title,
        note: entry.note,
        status: next,
        thread: entry.thread,
      });
    } catch (err) {
      // Roll back on failure.
      setLoad((prev) =>
        prev.status === 'ready'
          ? {
              status: 'ready',
              entries: prev.entries.map((e) =>
                e.id === entry.id ? { ...e, status: entry.status } : e,
              ),
            }
          : prev,
      );
      if (import.meta.env.DEV) console.warn('goals: toggle status failed', err);
    }
  }

  function handleEdit(entry: GoalEntry): void {
    openComposer('goal', {
      type: 'goal',
      id: entry.id,
      payload: {
        date: entry.date,
        title: entry.title,
        note: entry.note,
        status: entry.status,
        thread: entry.thread,
      },
    });
  }

  async function handleDelete(entry: GoalEntry): Promise<void> {
    if (!mainKey || !moduleUserId) return;
    if (!window.confirm(`Supprimer « ${entry.title} » ?`)) return;
    const previous = load;
    setLoad((prev) =>
      prev.status === 'ready'
        ? { status: 'ready', entries: prev.entries.filter((e) => e.id !== entry.id) }
        : prev,
    );
    try {
      await goalsClient.remove(moduleUserId, mainKey, entry.id);
    } catch (err) {
      setLoad(previous);
      if (import.meta.env.DEV) console.warn('goals: delete failed', err);
    }
  }

  const entries: ReadonlyArray<GoalEntry> =
    load.status === 'ready' ? load.entries : EMPTY;

  const stats = useMemo(() => {
    const total = entries.length;
    const open = entries.filter((e) => e.status === 'open').length;
    const wip = entries.filter((e) => e.status === 'wip').length;
    const done = entries.filter((e) => e.status === 'done').length;
    return { total, open, wip, done };
  }, [entries]);

  const filtered = useMemo<GoalEntry[]>(() => {
    if (!statusFilter) return [...entries];
    return entries.filter((e) => e.status === statusFilter);
  }, [entries, statusFilter]);

  // Threads are stored as a comma-separated string in the single
  // `thread` field — splitting here means an entry tagged
  // `"#A, #B"` lands in BOTH groups instead of one combined-string
  // group. Empty / whitespace-only tokens drop out, dedupe so a
  // double comma doesn't double the entry.
  const groups = useMemo<Array<[string, GoalEntry[]]>>(() => {
    const map = new Map<string, GoalEntry[]>();
    for (const entry of filtered) {
      const keys =
        groupBy === 'year'
          ? [entry.date.slice(0, 4) || '—']
          : (() => {
              const ts = splitThreads(entry.thread);
              return ts.length > 0 ? ts : ['— sans thread —'];
            })();
      for (const key of keys) {
        const bucket = map.get(key) ?? [];
        bucket.push(entry);
        map.set(key, bucket);
      }
    }
    return Array.from(map.entries()).sort(([a], [b]) =>
      b.localeCompare(a, 'fr', { numeric: true }),
    );
  }, [filtered, groupBy]);

  return (
    <div className="animate-fade-up flex min-w-0 flex-1 flex-col">
      <Topbar
        label={`Goals · ${stats.total} ${stats.total === 1 ? 'objectif' : 'objectifs'}`}
        onOpenMenu={() => setMobileMenuOpen(true)}
      >
        <Button variant="primary" size="sm" onClick={() => openComposer('goal')}>
          + Nouvel objectif
        </Button>
      </Topbar>

      <div className="grid grid-cols-1 gap-9 px-6 py-7 sm:px-9 lg:grid-cols-[1fr_280px]">
        <PrimaryColumn
          load={load}
          stats={stats}
          groups={groups}
          onToggleStatus={handleToggleStatus}
          onDelete={handleDelete}
          onEdit={handleEdit}
        />
        <SideColumn
          stats={stats}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
        />
      </div>
    </div>
  );
}

const EMPTY: ReadonlyArray<GoalEntry> = [];

interface PrimaryColumnProps {
  load: LoadState;
  stats: { total: number; open: number; wip: number; done: number };
  groups: Array<[string, GoalEntry[]]>;
  onToggleStatus: (entry: GoalEntry) => void | Promise<void>;
  onDelete: (entry: GoalEntry) => void | Promise<void>;
  onEdit: (entry: GoalEntry) => void;
}

function PrimaryColumn({
  load,
  stats,
  groups,
  onToggleStatus,
  onDelete,
  onEdit,
}: PrimaryColumnProps) {
  return (
    <section className="flex min-w-0 flex-col">
      <h1 className="mb-6 text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink">
        Goals
      </h1>

      {load.status === 'error' ? (
        <p
          role="alert"
          className="mb-4 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[12px] text-danger"
        >
          {load.message}
        </p>
      ) : null}

      <div>
        {load.status === 'loading' && stats.total === 0 ? (
          <p className="border-b border-hair py-6 text-[13px] italic text-muted">
            Chargement des objectifs…
          </p>
        ) : groups.length === 0 ? (
          <p className="border-b border-hair py-6 text-[13px] italic text-muted">
            Aucun objectif pour cette sélection.
          </p>
        ) : (
          groups.map(([groupLabel, items]) => (
            <GroupBlock
              key={groupLabel}
              label={groupLabel}
              entries={items}
              onToggleStatus={onToggleStatus}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))
        )}
      </div>
    </section>
  );
}

interface GroupBlockProps {
  label: string;
  entries: GoalEntry[];
  onToggleStatus: (entry: GoalEntry) => void | Promise<void>;
  onDelete: (entry: GoalEntry) => void | Promise<void>;
  onEdit: (entry: GoalEntry) => void;
}

function GroupBlock({
  label,
  entries,
  onToggleStatus,
  onDelete,
  onEdit,
}: GroupBlockProps) {
  return (
    <div className="mb-7 last:mb-0">
      <div className="mb-2 flex items-baseline justify-between border-b border-hair pb-1.5">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.04em] text-muted">
          {label}
        </h2>
        <span className="text-[11px] tabular-nums text-muted">
          {entries.length} {entries.length === 1 ? 'objectif' : 'objectifs'}
        </span>
      </div>
      <ul>
        {entries.map((entry) => (
          <GoalRow
            key={entry.id}
            entry={entry}
            onToggleStatus={() => onToggleStatus(entry)}
            onDelete={() => onDelete(entry)}
            onEdit={() => onEdit(entry)}
          />
        ))}
      </ul>
    </div>
  );
}

interface GoalRowProps {
  entry: GoalEntry;
  onToggleStatus: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

function GoalRow({ entry, onToggleStatus, onDelete, onEdit }: GoalRowProps) {
  return (
    <li className="group flex items-start gap-3 border-b border-hair py-3 last:border-b-0">
      <StatusPill status={entry.status} onCycle={onToggleStatus} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <p
            className={cn(
              'text-[14px] font-medium transition-colors',
              entry.status === 'done' ? 'text-muted line-through' : 'text-ink',
            )}
          >
            {entry.title}
          </p>
          {entry.date ? (
            <span className="text-[11px] tabular-nums text-muted">{formatDate(entry.date)}</span>
          ) : null}
        </div>
        {entry.note ? (
          <p className="mt-1 text-[13px] leading-[1.5] text-ink-soft">{entry.note}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          onClick={onEdit}
          aria-label="Modifier l’objectif"
          title="Modifier"
        >
          <PencilSquareIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          variant="danger-ghost"
          size="sm"
          iconOnly
          onClick={onDelete}
          aria-label="Supprimer l’objectif"
          title="Supprimer"
        >
          <TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}

const STATUS_TONE: Record<CanonicalStatus, string> = {
  open: 'border-hair bg-bg text-muted hover:border-ink-soft hover:text-ink',
  wip: 'border-accent-soft bg-accent-soft text-accent-deep hover:border-accent hover:text-accent-deep',
  done: 'border-accent bg-accent text-white hover:bg-accent-hover hover:border-accent-hover',
};

const STATUS_LABEL: Record<CanonicalStatus, string> = {
  open: 'ouvert',
  wip: 'en cours',
  done: 'terminé',
};

function StatusPill({
  status,
  onCycle,
}: {
  status: CanonicalStatus;
  onCycle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onCycle}
      aria-label={`Statut : ${STATUS_LABEL[status]}, cliquer pour cycler`}
      title={`Statut : ${STATUS_LABEL[status]}`}
      className={cn(
        'inline-flex h-6 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors',
        STATUS_TONE[status],
      )}
    >
      <StatusGlyph status={status} />
      <span className="tracking-[0.01em]">{STATUS_LABEL[status]}</span>
    </button>
  );
}

function StatusGlyph({ status }: { status: CanonicalStatus }) {
  // Hand-rolled SVG glyphs — heroicons doesn't ship a half-filled
  // circle that matches the K aesthetic. 8×8, currentColor.
  if (status === 'done') {
    return (
      <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
        <path
          d="M1.5 4l1.6 1.6L6.5 2.4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    );
  }
  if (status === 'wip') {
    return (
      <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
        <circle cx="4" cy="4" r="3" stroke="currentColor" strokeWidth="1.2" fill="none" />
        <path d="M4 1 A3 3 0 0 1 4 7 Z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
      <circle cx="4" cy="4" r="3" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

interface SideColumnProps {
  stats: { total: number; open: number; wip: number; done: number };
  statusFilter: CanonicalStatus | null;
  onStatusFilterChange: (next: CanonicalStatus | null) => void;
  groupBy: 'thread' | 'year';
  onGroupByChange: (next: 'thread' | 'year') => void;
}

function SideColumn({
  stats,
  statusFilter,
  onStatusFilterChange,
  groupBy,
  onGroupByChange,
}: SideColumnProps) {
  return (
    <aside className="sticky top-20 flex min-w-0 flex-col gap-6 self-start">
      <section>
        <SectionLabel>Statut</SectionLabel>
        <div className="flex flex-wrap gap-1">
          <FilterChip
            active={statusFilter === null}
            onClick={() => onStatusFilterChange(null)}
            label="Tous"
            count={stats.total}
          />
          {CANONICAL_STATUSES.map((s) => (
            <FilterChip
              key={s}
              active={statusFilter === s}
              onClick={() => onStatusFilterChange(s)}
              label={STATUS_LABEL[s]}
              count={s === 'open' ? stats.open : s === 'wip' ? stats.wip : stats.done}
            />
          ))}
        </div>
      </section>

      <section>
        <SectionLabel>Grouper par</SectionLabel>
        <div className="flex flex-wrap gap-1">
          <FilterChip
            active={groupBy === 'thread'}
            onClick={() => onGroupByChange('thread')}
            label="Thread"
          />
          <FilterChip
            active={groupBy === 'year'}
            onClick={() => onGroupByChange('year')}
            label="Année"
          />
        </div>
      </section>
    </aside>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'cursor-pointer rounded-md px-2.5 py-1 text-[12px] tabular-nums transition-colors',
        active
          ? 'bg-accent-soft font-semibold text-accent-deep'
          : 'text-muted hover:bg-bg-2 hover:text-ink',
      )}
    >
      {label}
      {count !== undefined ? <span className="ml-1.5 text-[11px] text-muted">{count}</span> : null}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2.5 text-[12px] font-semibold tracking-[0.02em] text-muted">{children}</div>
  );
}

/* ---------- Helpers ------------------------------------------------------- */

function recordToEntry(record: DecryptedRecord<GoalsPayload>): GoalEntry {
  const p = record.payload;
  return {
    id: record.id,
    date: p.date ?? '',
    title: p.title ?? '',
    note: p.note ?? '',
    status: normalizeStatus(p.status),
    thread: p.thread ?? '',
  };
}

const VALID_STATUS = new Set<string>(GOAL_STATUS_VALUES);

function normalizeStatus(raw: string | undefined): CanonicalStatus {
  if (!raw || !VALID_STATUS.has(raw)) return 'open';
  // The schema accepts legacy aliases `active` / `archived`. Map them
  // onto the three canonical states so the K UI doesn't have to render
  // five colours for two real meanings.
  if (raw === 'active') return 'open';
  if (raw === 'archived') return 'done';
  return raw as CanonicalStatus;
}

/**
 * Split a comma-separated `thread` string into trimmed, deduped
 * tokens. The schema keeps `thread` as a single string so the
 * server stays oblivious; splitting here is purely a UI grouping
 * convention. Empty or whitespace-only tokens drop out, and
 * dedup-then-stable order means `"#A, #A, #B"` becomes
 * `["#A", "#B"]` (not `["#A", "#A", "#B"]`).
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

function nextStatus(current: CanonicalStatus): CanonicalStatus {
  const i = CANONICAL_STATUSES.indexOf(current);
  return CANONICAL_STATUSES[(i + 1) % CANONICAL_STATUSES.length] ?? 'open';
}

function byDateDesc(a: GoalEntry, b: GoalEntry): number {
  // Goals are usually dated YYYY-MM (or empty). Empty dates land last.
  const ad = a.date || '';
  const bd = b.date || '';
  if (ad === bd) return 0;
  if (!ad) return 1;
  if (!bd) return -1;
  return bd.localeCompare(ad);
}

const FRENCH_MONTHS = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

function formatDate(dateIso: string): string {
  // Accepts both `YYYY-MM` (the legacy form's DateMonthPicker) and
  // `YYYY-MM-DD`. Anything else is rendered as-is.
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(dateIso);
  if (!m) return dateIso;
  const year = m[1] ?? '';
  const monthIdx = Number(m[2]) - 1;
  const month = FRENCH_MONTHS[monthIdx] ?? m[2] ?? '';
  const day = m[3];
  return day ? `${day} ${month} ${year}` : `${month} ${year}`;
}
