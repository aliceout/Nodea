import { useEffect, useMemo, useState } from 'react';
import {
  Bars3Icon,
  PencilSquareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import type { PassagePayload } from '@nodea/shared';

import { passageClient } from '@/core/api/modules/passage';
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
} from '@/core/store/nodea-store';
import type { DecryptedRecord } from '@/core/api/modules/collection-client';
import { JournalContent } from '@/lib/journal-markdown';
import { cn } from '@/lib/utils';
import Button from '@/ui/atoms/dirk/Button';

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
    if (!threadFilter) return [...entries];
    return entries.filter((e) => splitThreads(e.thread).includes(threadFilter));
  }, [entries, threadFilter]);

  const groups = useMemo<Array<[string, JournalEntry[]]>>(() => {
    const map = new Map<string, JournalEntry[]>();
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
  }, [filtered]);

  return (
    <div className="animate-fade-up flex min-w-0 flex-1 flex-col">
      <Topbar
        count={entries.length}
        onOpenMenu={() => setMobileMenuOpen(true)}
        onNewEntry={() => openComposer('journal')}
      />

      <div className="grid grid-cols-1 gap-9 px-6 py-7 sm:px-9 lg:grid-cols-[1fr_280px]">
        <PrimaryColumn
          load={load}
          total={entries.length}
          groups={groups}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
        <SideColumn
          threads={threads}
          activeThread={threadFilter}
          onThreadChange={setThreadFilter}
          totalCount={entries.length}
        />
      </div>
    </div>
  );
}

const EMPTY: ReadonlyArray<JournalEntry> = [];

interface TopbarProps {
  count: number;
  onOpenMenu: () => void;
  onNewEntry: () => void;
}

function Topbar({ count, onOpenMenu, onNewEntry }: TopbarProps) {
  const label = `Journal · ${count} ${count === 1 ? 'entrée' : 'entrées'}`;
  return (
    <div className="sticky top-0 z-20 flex h-[52px] items-center justify-between border-b border-hair bg-bg px-6 sm:px-9">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="md"
          iconOnly
          onClick={onOpenMenu}
          aria-label="Ouvrir le menu"
          className="-ml-2 text-ink-soft lg:hidden"
        >
          <Bars3Icon className="h-5 w-5" aria-hidden="true" />
        </Button>
        <span className="text-[12px] tracking-[0.02em] text-muted">{label}</span>
      </div>

      <Button variant="primary" size="sm" onClick={onNewEntry}>
        + Nouvelle entrée
      </Button>
    </div>
  );
}

interface PrimaryColumnProps {
  load: LoadState;
  total: number;
  groups: Array<[string, JournalEntry[]]>;
  onEdit: (entry: JournalEntry) => void;
  onDelete: (entry: JournalEntry) => void | Promise<void>;
}

function PrimaryColumn({ load, total, groups, onEdit, onDelete }: PrimaryColumnProps) {
  return (
    <section className="flex min-w-0 flex-col">
      <h1 className="mb-6 text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink">
        Journal
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
        {load.status === 'loading' && total === 0 ? (
          <p className="border-b border-hair py-6 text-[13px] italic text-muted">
            Chargement du journal…
          </p>
        ) : groups.length === 0 ? (
          <p className="border-b border-hair py-6 text-[13px] italic text-muted">
            Aucune entrée pour cette sélection.
          </p>
        ) : (
          groups.map(([groupLabel, items]) => (
            <GroupBlock
              key={groupLabel}
              label={groupLabel}
              entries={items}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </section>
  );
}

interface GroupBlockProps {
  label: string;
  entries: JournalEntry[];
  onEdit: (entry: JournalEntry) => void;
  onDelete: (entry: JournalEntry) => void | Promise<void>;
}

function GroupBlock({ label, entries, onEdit, onDelete }: GroupBlockProps) {
  return (
    <div className="mb-9 last:mb-0">
      <div className="mb-2 flex items-baseline justify-between border-b border-hair pb-1.5">
        <h2 className="text-[15px] font-semibold tracking-[-0.005em] text-ink">
          {label}
        </h2>
        <span className="text-[11px] tabular-nums text-muted">
          {entries.length} {entries.length === 1 ? 'entrée' : 'entrées'}
        </span>
      </div>
      <ul>
        {entries.map((entry) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            onEdit={() => onEdit(entry)}
            onDelete={() => onDelete(entry)}
          />
        ))}
      </ul>
    </div>
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

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
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
      </div>
    </li>
  );
}

interface SideColumnProps {
  threads: string[];
  activeThread: string | null;
  onThreadChange: (next: string | null) => void;
  totalCount: number;
}

function SideColumn({
  threads,
  activeThread,
  onThreadChange,
  totalCount,
}: SideColumnProps) {
  return (
    <aside className="sticky top-20 flex min-w-0 flex-col gap-6 self-start">
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
