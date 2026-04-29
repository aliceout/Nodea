import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookOpenIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

import { useNodeaStore } from '@/core/store/nodea-store';
import { JournalContent } from '@/lib/journal-markdown';
import { attachmentSrc } from './hooks/imageResize';
import Button from '@/ui/atoms/dirk/Button';
import Input from '@/ui/atoms/dirk/Input';
import EmptyHint from '@/ui/dirk/EmptyHint';
import FilterChip from '@/ui/dirk/FilterChip';
import GroupBlock from '@/ui/dirk/GroupBlock';
import HoverActions from '@/ui/dirk/HoverActions';
import ModuleShell from '@/ui/dirk/ModuleShell';
import PageHeading from '@/ui/dirk/PageHeading';
import Topbar from '@/ui/dirk/Topbar';

import {
  JournalProvider,
  useJournalActions,
  useJournalData,
  useJournalFilters,
} from './context';
import type { JournalEntry, JournalStats, LoadState } from './lib/types';

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

export default function JournalPage() {
  return (
    <JournalProvider>
      <JournalView />
    </JournalProvider>
  );
}

/** Page rendering surface — picks between the focus reader and the
 *  regular list shell. Reads from the three Journal contexts and
 *  feeds the existing prop-driven sub-components. Subsequent commits
 *  will migrate the leaves (`SideColumn`, `PrimaryColumn`,
 *  `EntryRow`, `ReaderShell`) to consume the contexts directly. */
function JournalView() {
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const openComposer = useNodeaStore((s) => s.openComposer);

  const { entries, load, stats } = useJournalData();
  const {
    threadFilter,
    groupBy,
    search,
    threads,
    filtered,
    groups,
    setThreadFilter,
    setGroupBy,
    setSearch,
  } = useJournalFilters();
  const { readingId, editEntry, deleteEntry, openReader, closeReader } =
    useJournalActions();

  // Reader sequence — the user navigates prev/next inside the
  // *filtered* list (search + thread filter applied). That matches
  // what they were just looking at in the list view ; jumping to
  // an entry that wasn't visible would feel like a glitch.
  const readingIndex =
    readingId === null ? -1 : filtered.findIndex((e) => e.id === readingId);
  const readingEntry = readingIndex >= 0 ? filtered[readingIndex]! : null;

  if (readingEntry) {
    return (
      <ReaderShell
        entry={readingEntry}
        position={readingIndex + 1}
        total={filtered.length}
        onClose={closeReader}
        onPrev={
          readingIndex > 0
            ? () => openReader(filtered[readingIndex - 1]!.id)
            : null
        }
        onNext={
          readingIndex < filtered.length - 1
            ? () => openReader(filtered[readingIndex + 1]!.id)
            : null
        }
        onEdit={() => editEntry(readingEntry)}
        onMobileMenu={() => setMobileMenuOpen(true)}
      />
    );
  }

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
          threads={[...threads]}
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
        onRead={(entry) => openReader(entry.id)}
        onEdit={editEntry}
        onDelete={deleteEntry}
      />
    </ModuleShell>
  );
}

interface PrimaryColumnProps {
  load: LoadState;
  total: number;
  groups: ReadonlyArray<readonly [string, JournalEntry[]]>;
  groupVariant: 'subtitle' | 'eyebrow';
  onRead: (entry: JournalEntry) => void;
  onEdit: (entry: JournalEntry) => void;
  onDelete: (entry: JournalEntry) => void | Promise<void>;
}

function PrimaryColumn({
  load,
  total,
  groups,
  groupVariant,
  onRead,
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
                  onRead={() => onRead(entry)}
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
  onRead: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function EntryRow({ entry, onRead, onEdit, onDelete }: EntryRowProps) {
  return (
    <li className="group flex items-start gap-4 border-b border-hair py-4 last:border-b-0">
      <button
        type="button"
        onClick={onRead}
        className="w-[110px] shrink-0 cursor-pointer text-left text-[12px] tabular-nums text-muted transition-colors hover:text-accent"
        aria-label={`Ouvrir ${entry.title ?? entry.dateLabel} en lecture`}
      >
        {entry.dateLabel}
      </button>

      <div className="min-w-0 flex-1">
        {entry.title ? (
          <p className="mb-1 text-[14px] font-medium text-ink">{entry.title}</p>
        ) : null}
        <ClampedJournalContent text={entry.content} onExpand={onRead} />
        {entry.attachments.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {entry.attachments.map((att) => (
              <button
                key={att.id}
                type="button"
                onClick={onRead}
                className="h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-sm border border-hair bg-bg-2 transition-opacity hover:opacity-80"
                aria-label="Ouvrir l'image dans le lecteur"
                title="Voir en grand"
              >
                <img
                  src={attachmentSrc(att)}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <HoverActions>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          onClick={onRead}
          aria-label="Ouvrir en lecture"
          title="Lire"
        >
          <BookOpenIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
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

interface ClampedJournalContentProps {
  text: string;
  /** Called when the user clicks the « lire la suite » affordance.
   *  Wired to the row's `onRead` so the expansion route is the
   *  same as the « Lire » hover action — the focus reader. */
  onExpand: () => void;
}

const CLAMP_LINES = 4;

/**
 * Inline-list wrapper around `JournalContent` that caps the
 * preview at ~4 lines so the list stays scannable when entries
 * grow long. Detects whether content overflows post-render via a
 * scrollHeight check, then conditionally paints a fade gradient
 * at the bottom + a discreet « lire la suite » trigger that opens
 * the focus reader.
 *
 * No clamp = no extra DOM (the fade and the link are rendered
 * only when `overflowing`), so short entries stay visually pure.
 */
function ClampedJournalContent({ text, onExpand }: ClampedJournalContentProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // +1 absorbs sub-pixel rounding so an entry that fits exactly
    // doesn't toggle to « overflowing » due to a 0.5 px diff.
    setOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [text]);

  return (
    <div>
      <div className="relative">
        <div
          ref={ref}
          className="overflow-hidden"
          style={{ maxHeight: `${CLAMP_LINES}lh` }}
        >
          <JournalContent text={text} />
        </div>
        {overflowing ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[1.5lh] bg-gradient-to-t from-bg to-transparent"
          />
        ) : null}
      </div>
      {overflowing ? (
        <button
          type="button"
          onClick={onExpand}
          className="mt-1 cursor-pointer text-[12px] text-accent underline-offset-2 transition-colors hover:underline"
        >
          lire la suite →
        </button>
      ) : null}
    </div>
  );
}

interface ReaderShellProps {
  entry: JournalEntry;
  position: number;
  total: number;
  onClose: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onEdit: () => void;
  onMobileMenu: () => void;
}

/**
 * Focus reading mode — full-shell takeover that drops the side
 * column and the regular list to surface a single entry as a
 * long-form read. Topbar carries:
 *   - « Retour » (closes the reader)
 *   - position counter « N / total » against the filtered list
 *   - « Modifier » (re-opens the Composer)
 * Body:
 *   - serif title (when the legacy entry has one) + date
 *   - the entry's Markdown rendered through `JournalContent` at
 *     a slightly larger size than the inline list
 * Footer:
 *   - « ← Précédent » / « Suivant → » navigation, disabled at
 *     either end. Sequence follows the filtered list so the user
 *     keeps reading what they were just looking at, not random
 *     entries that weren't in their view.
 *
 * Keyboard: `Esc` closes, `←` / `→` step through neighbours.
 */
function ReaderShell({
  entry,
  position,
  total,
  onClose,
  onPrev,
  onNext,
  onEdit,
  onMobileMenu,
}: ReaderShellProps) {
  useEffect(() => {
    function handle(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      // Don't steal arrow keys when the user is interacting with
      // a focusable element (form fields, toolbar buttons) — the
      // reader is read-only but a future inline-edit affordance
      // would care.
      const target = e.target as HTMLElement | null;
      if (
        target &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      ) {
        return;
      }
      if (e.key === 'ArrowLeft' && onPrev) {
        e.preventDefault();
        onPrev();
        return;
      }
      if (e.key === 'ArrowRight' && onNext) {
        e.preventDefault();
        onNext();
      }
    }
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [onClose, onPrev, onNext]);

  return (
    <ModuleShell
      topbar={
        <Topbar
          label={`Journal · ${position} / ${total}`}
          onOpenMenu={onMobileMenu}
        >
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <PencilSquareIcon className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Modifier
          </Button>
          <Button variant="ghost" size="sm" iconOnly onClick={onClose} aria-label="Fermer">
            <XMarkIcon className="h-4 w-4" aria-hidden="true" />
          </Button>
        </Topbar>
      }
    >
      <article className="mx-auto max-w-2xl">
        <header className="mb-7">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-muted">
              {entry.thread || '— sans fil —'}
            </p>
            <p className="text-[12px] tabular-nums text-muted">
              {entry.dateLabel}
            </p>
          </div>
          {entry.title ? (
            <h1 className="mt-2 font-serif text-[32px] leading-[1.15] tracking-[-0.01em] text-ink">
              {entry.title}
            </h1>
          ) : null}
        </header>

        <div className="text-[15px] leading-[1.7] text-ink">
          <JournalContent text={entry.content} />
        </div>

        {entry.attachments.length > 0 ? (
          <div className="mt-8 space-y-4">
            {entry.attachments.map((att) => (
              <img
                key={att.id}
                src={attachmentSrc(att)}
                alt=""
                className="block w-full rounded-md border border-hair object-contain"
              />
            ))}
          </div>
        ) : null}

        <footer className="mt-12 flex items-center justify-between gap-3 border-t border-hair pt-5">
          <Button
            variant="neutral"
            size="sm"
            onClick={onPrev ?? (() => undefined)}
            disabled={onPrev === null}
          >
            <ArrowLeftIcon className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Précédent
          </Button>
          <span className="text-[11px] tabular-nums text-muted">
            {position} / {total}
          </span>
          <Button
            variant="neutral"
            size="sm"
            onClick={onNext ?? (() => undefined)}
            disabled={onNext === null}
          >
            Suivant
            <ArrowRightIcon className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </footer>
      </article>
    </ModuleShell>
  );
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

