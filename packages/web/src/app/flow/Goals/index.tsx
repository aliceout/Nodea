import { useEffect, useMemo, useState } from 'react';
import {
  ArrowPathIcon,
  PencilSquareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

import { goalsClient } from '@/core/api/modules/goals';
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
} from '@/core/store/nodea-store';
import { cn } from '@/lib/utils';
import Button from '@/ui/atoms/dirk/Button';
import Input from '@/ui/atoms/dirk/Input';
import { Modal } from '@/ui/atoms/layout/Modal';
import EmptyHint from '@/ui/dirk/EmptyHint';
import FilterChip from '@/ui/dirk/FilterChip';
import GroupBlock from '@/ui/dirk/GroupBlock';
import HoverActions from '@/ui/dirk/HoverActions';
import ModuleShell from '@/ui/dirk/ModuleShell';
import PageHeading from '@/ui/dirk/PageHeading';
import Topbar from '@/ui/dirk/Topbar';

import {
  CANONICAL_STATUSES,
  SORT_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
} from './lib/constants';
import { formatDate } from './lib/date-format';
import { recordToEntry } from './lib/mappers';
import { byDateDesc } from './lib/sort';
import { nextStatus } from './lib/status';
import { splitThreads } from './lib/threads';
import type {
  CanonicalStatus,
  GoalEntry,
  LoadState,
  SortBy,
} from './lib/types';

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
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  /** When true, completed goals (status === 'done') are filtered
   *  out of the main list. Stats still count them so the user
   *  sees their done total. Toggle in the SideColumn. */
  const [hideDone, setHideDone] = useState(false);
  const [carryOverOpen, setCarryOverOpen] = useState(false);

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
    // Capture or clear `completed_at` whenever the status crosses
    // the `done` boundary. Going *into* done from open / wip seeds
    // a fresh timestamp; cycling out of done back to open clears
    // it. Re-entering done (after a clear) seeds a new timestamp
    // — we don't preserve the previous one because the old « date
    // de complétion » is no longer accurate.
    const nextCompletedAt =
      next === 'done'
        ? (entry.completedAt ?? new Date().toISOString())
        : null;
    // Optimistic — flip the in-memory copy first, roll back on error.
    setLoad((prev) =>
      prev.status === 'ready'
        ? {
            status: 'ready',
            entries: prev.entries.map((e) =>
              e.id === entry.id
                ? { ...e, status: next, completedAt: nextCompletedAt }
                : e,
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
        completed_at: nextCompletedAt,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      // Roll back on failure.
      setLoad((prev) =>
        prev.status === 'ready'
          ? {
              status: 'ready',
              entries: prev.entries.map((e) =>
                e.id === entry.id
                  ? { ...e, status: entry.status, completedAt: entry.completedAt }
                  : e,
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
        completed_at: entry.completedAt,
        // Pass-through current `updated_at` ; the composer's
        // save handler overwrites it with `now()` on submit.
        updated_at: entry.updatedAt,
      },
    });
  }

  /**
   * Bulk-bump every unfinished goal whose date year matches `from`
   * up to `to`. Status stays as-is (open or wip — done goals are
   * filtered out before we ever get here). Date format preserved
   * (YYYY-MM stays YYYY-MM with the year swapped, bare YYYY stays
   * bare). Each goal is patched serially to keep the optimistic
   * state simple — for a few dozen carry-overs this is fine; if
   * we ever face hundreds we can chunk them.
   */
  async function handleCarryOver(
    from: number,
    to: number,
    affected: GoalEntry[],
  ): Promise<void> {
    if (!mainKey || !moduleUserId) return;
    if (affected.length === 0) {
      setCarryOverOpen(false);
      return;
    }
    // Optimistic — flip every affected entry locally first.
    const renumbered = new Map<string, string>();
    for (const e of affected) {
      const newDate = e.date
        ? e.date.replace(/^\d{4}/, String(to))
        : String(to);
      renumbered.set(e.id, newDate);
    }
    const previous = load;
    setLoad((prev) =>
      prev.status === 'ready'
        ? {
            status: 'ready',
            entries: prev.entries.map((e) =>
              renumbered.has(e.id)
                ? { ...e, date: renumbered.get(e.id)! }
                : e,
            ),
          }
        : prev,
    );
    setCarryOverOpen(false);
    try {
      const now = new Date().toISOString();
      for (const e of affected) {
        const newDate = renumbered.get(e.id)!;
        await goalsClient.update(moduleUserId, mainKey, e.id, {
          date: newDate,
          title: e.title,
          note: e.note,
          status: e.status,
          thread: e.thread,
          completed_at: e.completedAt,
          updated_at: now,
        });
      }
    } catch (err) {
      setLoad(previous);
      if (import.meta.env.DEV) console.warn('goals: carry-over failed', err);
    }
    // Suppress unused-param warning when `from` isn't read at runtime
    // (we use it to scope the affected list at the call site).
    void from;
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
    const needle = search.trim().toLocaleLowerCase('fr');
    const out = entries.filter((e) => {
      // « Masquer les terminés » overrides nothing — when an
      // explicit status filter is `done`, the user clearly wants
      // to see them, so the hide toggle yields.
      if (hideDone && statusFilter !== 'done' && e.status === 'done') {
        return false;
      }
      if (statusFilter && e.status !== statusFilter) return false;
      if (needle.length > 0) {
        const haystack =
          `${e.title}\n${e.note}\n${e.thread}`.toLocaleLowerCase('fr');
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
    // Sort the filtered slice — the original `entries` array is
    // already date-desc, so stable sort keeps that order whenever
    // two entries tie on the active key (e.g. all goals updated
    // today fall back to date desc).
    out.sort((a, b) => {
      if (sortBy === 'alpha') {
        return a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' });
      }
      if (sortBy === 'updated') {
        return b.updatedAt.localeCompare(a.updatedAt);
      }
      return byDateDesc(a, b);
    });
    return out;
  }, [entries, statusFilter, search, sortBy, hideDone]);

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
    <ModuleShell
      topbar={
        <Topbar
          label={`Goals · ${stats.total} ${stats.total === 1 ? 'objectif' : 'objectifs'}`}
          onOpenMenu={() => setMobileMenuOpen(true)}
        >
          <Button variant="primary" size="sm" onClick={() => openComposer('goal')}>
            + Nouvel objectif
          </Button>
        </Topbar>
      }
      side={
        <SideColumn
          stats={stats}
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          hideDone={hideDone}
          onHideDoneChange={setHideDone}
          onCarryOverClick={() => setCarryOverOpen(true)}
        />
      }
    >
      <PrimaryColumn
        load={load}
        stats={stats}
        groups={groups}
        onToggleStatus={handleToggleStatus}
        onDelete={handleDelete}
        onEdit={handleEdit}
      />
      <CarryOverDialog
        open={carryOverOpen}
        onClose={() => setCarryOverOpen(false)}
        entries={entries}
        onConfirm={handleCarryOver}
      />
    </ModuleShell>
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
      <PageHeading>Goals</PageHeading>

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
          <EmptyHint>Chargement des objectifs…</EmptyHint>
        ) : groups.length === 0 ? (
          <EmptyHint>Aucun objectif pour cette sélection.</EmptyHint>
        ) : (
          groups.map(([groupLabel, items]) => (
            <GroupBlock
              key={groupLabel}
              label={groupLabel}
              count={items.length}
              countNoun="objectif"
              variant="eyebrow"
            >
              {items.map((entry) => (
                <GoalRow
                  key={entry.id}
                  entry={entry}
                  onToggleStatus={() => onToggleStatus(entry)}
                  onDelete={() => onDelete(entry)}
                  onEdit={() => onEdit(entry)}
                />
              ))}
            </GroupBlock>
          ))
        )}
      </div>
    </section>
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

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <StatusPill status={entry.status} onCycle={onToggleStatus} />
        <HoverActions>
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
        </HoverActions>
      </div>
    </li>
  );
}

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
  search: string;
  onSearchChange: (next: string) => void;
  statusFilter: CanonicalStatus | null;
  onStatusFilterChange: (next: CanonicalStatus | null) => void;
  groupBy: 'thread' | 'year';
  onGroupByChange: (next: 'thread' | 'year') => void;
  sortBy: SortBy;
  onSortByChange: (next: SortBy) => void;
  hideDone: boolean;
  onHideDoneChange: (next: boolean) => void;
  onCarryOverClick: () => void;
}

function SideColumn({
  stats,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  groupBy,
  onGroupByChange,
  sortBy,
  onSortByChange,
  hideDone,
  onHideDoneChange,
  onCarryOverClick,
}: SideColumnProps) {
  return (
    <aside className="sticky top-20 flex min-w-0 flex-col gap-6 self-start">
      <section>
        <SectionLabel>Recherche</SectionLabel>
        <Input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Titre, note ou fil…"
          aria-label="Rechercher dans les objectifs"
        />
      </section>

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

      <section>
        <SectionLabel>Trier par</SectionLabel>
        <div className="flex flex-wrap gap-1">
          {(['date', 'updated', 'alpha'] as ReadonlyArray<SortBy>).map((s) => (
            <FilterChip
              key={s}
              active={sortBy === s}
              onClick={() => onSortByChange(s)}
              label={SORT_LABEL[s]}
            />
          ))}
        </div>
      </section>

      <section>
        <SectionLabel>Affichage</SectionLabel>
        <label className="flex cursor-pointer items-center gap-2 text-[12px] text-ink-soft">
          <input
            type="checkbox"
            checked={hideDone}
            onChange={(e) => onHideDoneChange(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded-sm border border-hair accent-accent"
          />
          <span>Masquer les terminés ({stats.done})</span>
        </label>
      </section>

      <section>
        <SectionLabel>Actions</SectionLabel>
        <Button
          variant="neutral"
          size="sm"
          onClick={onCarryOverClick}
          className="w-full justify-center"
        >
          <ArrowPathIcon className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Reporter sur l'année prochaine
        </Button>
      </section>
    </aside>
  );
}

interface CarryOverDialogProps {
  open: boolean;
  onClose: () => void;
  entries: ReadonlyArray<GoalEntry>;
  onConfirm: (
    from: number,
    to: number,
    affected: GoalEntry[],
  ) => void | Promise<void>;
}

/**
 * Modal that lets the user bulk-bump unfinished goals from one
 * year onto another. Default mapping is « previous year → current
 * year » since end-of-year is when this matters most, but both
 * fields are editable.
 *
 * Affected = goals whose date starts with the source year AND
 * whose status is open or wip. `done` goals stay where they are
 * (a completed goal is bound to the year it was achieved). The
 * user sees the count + a preview of the first few titles before
 * confirming, so a wrong year doesn't silently rewrite history.
 */
function CarryOverDialog({
  open,
  onClose,
  entries,
  onConfirm,
}: CarryOverDialogProps) {
  const currentYear = new Date().getFullYear();
  const [fromYear, setFromYear] = useState(String(currentYear - 1));
  const [toYear, setToYear] = useState(String(currentYear));
  const [busy, setBusy] = useState(false);

  // Reset to the year-end defaults each time the dialog opens so
  // a previous session's tweak doesn't leak into the next.
  useEffect(() => {
    if (!open) return;
    setFromYear(String(currentYear - 1));
    setToYear(String(currentYear));
    setBusy(false);
  }, [open, currentYear]);

  const fromN = Number(fromYear);
  const toN = Number(toYear);
  const validRange =
    Number.isFinite(fromN) &&
    Number.isFinite(toN) &&
    fromN >= 1900 &&
    fromN <= 2200 &&
    toN >= 1900 &&
    toN <= 2200 &&
    toN !== fromN;

  const affected = useMemo(() => {
    if (!validRange) return [];
    const prefix = String(fromN);
    return entries.filter(
      (e) =>
        (e.status === 'open' || e.status === 'wip') &&
        (e.date.startsWith(`${prefix}-`) || e.date === prefix),
    );
  }, [entries, fromN, validRange]);

  async function confirm(): Promise<void> {
    if (!validRange || busy) return;
    setBusy(true);
    await onConfirm(fromN, toN, affected);
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="px-[22px] pt-3.5 pb-3">
        <h2 className="mb-1 text-[15px] font-semibold tracking-[-0.005em] text-ink">
          Reporter les inachevés
        </h2>
        <p className="mb-4 text-[12px] leading-[1.5] text-ink-soft">
          Bascule les goals « ouverts » et « en cours » d'une année sur
          l'autre. Les goals terminés restent à leur année.
        </p>

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-muted">
              De l'année
            </span>
            <Input
              type="number"
              min={1900}
              max={2200}
              value={fromYear}
              align="center"
              onChange={(e) => setFromYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-24"
            />
          </label>
          <span className="pb-2 text-[12px] text-muted">→</span>
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-muted">
              Vers l'année
            </span>
            <Input
              type="number"
              min={1900}
              max={2200}
              value={toYear}
              align="center"
              onChange={(e) => setToYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-24"
            />
          </label>
        </div>

        <div className="rounded-sm border border-hair bg-bg-2 p-3">
          {!validRange ? (
            <p className="text-[12px] italic text-muted">
              Renseigne deux années valides et différentes.
            </p>
          ) : affected.length === 0 ? (
            <p className="text-[12px] italic text-muted">
              Aucun goal inachevé pour {fromN} — rien à reporter.
            </p>
          ) : (
            <>
              <p className="mb-2 text-[12px] text-ink-soft">
                <span className="font-semibold text-ink">{affected.length}</span>{' '}
                goal{affected.length === 1 ? '' : 's'} de {fromN} {' '}
                {affected.length === 1 ? 'va' : 'vont'} être reporté
                {affected.length === 1 ? '' : 's'} sur {toN}.
              </p>
              <ul className="max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5 text-[12px] text-ink">
                {affected.slice(0, 8).map((g) => (
                  <li key={g.id}>{g.title}</li>
                ))}
                {affected.length > 8 ? (
                  <li className="list-none italic text-muted">
                    … et {affected.length - 8} de plus
                  </li>
                ) : null}
              </ul>
            </>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-hair bg-bg-2 px-3.5 py-2.5">
        <Button variant="neutral" size="sm" onClick={onClose} disabled={busy}>
          Annuler
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => void confirm()}
          disabled={!validRange || affected.length === 0 || busy}
        >
          {busy ? 'Report en cours…' : 'Reporter'}
        </Button>
      </div>
    </Modal>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2.5 text-[12px] font-semibold tracking-[0.02em] text-muted">{children}</div>
  );
}

