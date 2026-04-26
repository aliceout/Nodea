import { useEffect, useMemo, useState } from 'react';
import {
  Bars3Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  PencilSquareIcon,
  PlusIcon,
  StarIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import {
  LIBRARY_STATUS_VALUES,
  type LibraryItemPayload,
  type LibraryReviewPayload,
  type LibraryStatus,
} from '@nodea/shared';

import {
  libraryItemsClient,
  libraryReviewsClient,
} from '@/core/api/modules/library';
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
} from '@/core/store/nodea-store';
import type { DecryptedRecord } from '@/core/api/modules/collection-client';
import { JournalContent } from '@/lib/journal-markdown';
import { cn } from '@/lib/utils';

/**
 * Library — Direction K · Sauge.
 *
 * Books-only personal library. Phase 1: manual entry, no external
 * metadata fetch (Phase 2 will wire `/library/lookup`). Items are
 * listed grouped by `status` (En cours / À lire / Terminés /
 * Abandonnés) and each row expands to reveal its reviews
 * (notes + extracts) — a single integrated surface rather than a
 * separate detail page.
 *
 * Both items and reviews live in their own encrypted collections
 * (`library-items` / `library-reviews`). The page joins them
 * client-side via `review.item_rid → item.id`.
 */

interface LibraryItem extends LibraryItemPayload {
  id: string;
}

interface LibraryReview extends LibraryReviewPayload {
  id: string;
}

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; message: string };

export default function LibraryPage() {
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const openComposer = useNodeaStore((s) => s.openComposer);
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const moduleUserId = modules['library']?.moduleUserId ?? null;
  const itemsVersion = useNodeaStore((s) => s.libraryItemsVersion);
  const reviewsVersion = useNodeaStore((s) => s.libraryReviewsVersion);
  const bumpItemsVersion = useNodeaStore((s) => s.bumpLibraryItemsVersion);
  const bumpReviewsVersion = useNodeaStore((s) => s.bumpLibraryReviewsVersion);

  const [items, setItems] = useState<LibraryItem[]>([]);
  const [reviews, setReviews] = useState<LibraryReview[]>([]);
  const [load, setLoad] = useState<LoadState>({ status: 'idle' });
  const [statusFilter, setStatusFilter] = useState<LibraryStatus | 'all' | 'favorites'>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!mainKey || !moduleUserId) return undefined;
    let cancelled = false;
    setLoad({ status: 'loading' });
    Promise.all([
      libraryItemsClient.list(moduleUserId, mainKey),
      libraryReviewsClient.list(moduleUserId, mainKey),
    ])
      .then(([itemRecords, reviewRecords]) => {
        if (cancelled) return;
        setItems(itemRecords.map(itemFromRecord));
        setReviews(reviewRecords.map(reviewFromRecord));
        setLoad({ status: 'ready' });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'Erreur lors du chargement de la bibliothèque.';
        setLoad({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [mainKey, moduleUserId, itemsVersion, reviewsVersion]);

  const allTags = useMemo<string[]>(() => {
    const set = new Set<string>();
    for (const it of items) for (const t of it.tags ?? []) set.add(t);
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [items]);

  const filteredItems = useMemo<LibraryItem[]>(() => {
    return items.filter((it) => {
      if (statusFilter === 'favorites') {
        if (!it.is_favorite) return false;
      } else if (statusFilter !== 'all' && it.status !== statusFilter) {
        return false;
      }
      if (tagFilter && !(it.tags ?? []).includes(tagFilter)) return false;
      return true;
    });
  }, [items, statusFilter, tagFilter]);

  const groups = useMemo<Array<[LibraryStatus, LibraryItem[]]>>(() => {
    // Group by status with a stable order — each row of the list reads
    // « En cours → À lire → Terminés → Abandonnés ». When a single
    // status filter is active we still group, but only one bucket
    // ends up populated.
    const map = new Map<LibraryStatus, LibraryItem[]>();
    for (const status of LIBRARY_STATUS_VALUES) map.set(status, []);
    for (const it of filteredItems) {
      const bucket = map.get(it.status) ?? [];
      bucket.push(it);
      map.set(it.status, bucket);
    }
    // Each bucket: alphabetical by title for predictability.
    for (const [, list] of map) {
      list.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
    }
    const ordered: LibraryStatus[] = ['in_progress', 'planned', 'finished', 'abandoned'];
    return ordered.map((s) => [s, map.get(s) ?? []]);
  }, [filteredItems]);

  function toggleExpanded(id: string): void {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function reviewsFor(itemId: string): LibraryReview[] {
    return reviews
      .filter((r) => r.item_rid === itemId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  function handleEditItem(it: LibraryItem): void {
    const { id, ...payload } = it;
    openComposer('library-item', {
      type: 'library-item',
      id,
      payload: payload as LibraryItemPayload,
    });
  }

  async function handleDeleteItem(it: LibraryItem): Promise<void> {
    if (!mainKey || !moduleUserId) return;
    if (!window.confirm(`Supprimer « ${it.title} » et ses reviews ?`)) return;
    const previousItems = items;
    const previousReviews = reviews;
    setItems((prev) => prev.filter((i) => i.id !== it.id));
    setReviews((prev) => prev.filter((r) => r.item_rid !== it.id));
    try {
      // Delete reviews first so we never leave orphans if the item
      // delete fails. They're encrypted but unreachable, so failing
      // here is a soft warning rather than a hard error.
      const orphanReviews = previousReviews.filter((r) => r.item_rid === it.id);
      await Promise.all(
        orphanReviews.map((r) => libraryReviewsClient.remove(moduleUserId, mainKey, r.id)),
      );
      await libraryItemsClient.remove(moduleUserId, mainKey, it.id);
      bumpItemsVersion();
      bumpReviewsVersion();
    } catch (err) {
      setItems(previousItems);
      setReviews(previousReviews);
      if (import.meta.env.DEV) console.warn('library: delete item failed', err);
    }
  }

  function handleToggleFavorite(it: LibraryItem): void {
    if (!mainKey || !moduleUserId) return;
    const next = !it.is_favorite;
    const previous = items;
    setItems((prev) =>
      prev.map((i) => (i.id === it.id ? { ...i, is_favorite: next } : i)),
    );
    libraryItemsClient
      .update(moduleUserId, mainKey, it.id, {
        ...(it as LibraryItemPayload),
        is_favorite: next,
      })
      .then(() => bumpItemsVersion())
      .catch((err) => {
        setItems(previous);
        if (import.meta.env.DEV) console.warn('library: favorite toggle failed', err);
      });
  }

  function handleAddReview(itemId: string): void {
    openComposer('library-review', {
      type: 'library-review',
      id: '',
      payload: {
        item_rid: itemId,
        date: new Date().toISOString(),
        kind: 'note',
        title: null,
        content: '',
        page: null,
        spoiler: false,
      },
    });
  }

  function handleEditReview(review: LibraryReview): void {
    const { id, ...payload } = review;
    openComposer('library-review', {
      type: 'library-review',
      id,
      payload: payload as LibraryReviewPayload,
    });
  }

  async function handleDeleteReview(review: LibraryReview): Promise<void> {
    if (!mainKey || !moduleUserId) return;
    if (!window.confirm('Supprimer cette review ?')) return;
    const previous = reviews;
    setReviews((prev) => prev.filter((r) => r.id !== review.id));
    try {
      await libraryReviewsClient.remove(moduleUserId, mainKey, review.id);
      bumpReviewsVersion();
    } catch (err) {
      setReviews(previous);
      if (import.meta.env.DEV) console.warn('library: delete review failed', err);
    }
  }

  return (
    <div className="animate-fade-up flex min-w-0 flex-1 flex-col">
      <Topbar
        count={items.length}
        onOpenMenu={() => setMobileMenuOpen(true)}
        onNewItem={() => openComposer('library-item')}
      />

      <div className="grid grid-cols-1 gap-9 px-6 py-7 sm:px-9 lg:grid-cols-[1fr_280px]">
        <PrimaryColumn
          load={load}
          total={items.length}
          filteredCount={filteredItems.length}
          groups={groups}
          expanded={expanded}
          reviewsFor={reviewsFor}
          onToggleExpand={toggleExpanded}
          onEditItem={handleEditItem}
          onDeleteItem={handleDeleteItem}
          onToggleFavorite={handleToggleFavorite}
          onAddReview={handleAddReview}
          onEditReview={handleEditReview}
          onDeleteReview={handleDeleteReview}
        />
        <SideColumn
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          tags={allTags}
          activeTag={tagFilter}
          onTagChange={setTagFilter}
          counts={{
            all: items.length,
            favorites: items.filter((it) => it.is_favorite).length,
            planned: items.filter((it) => it.status === 'planned').length,
            in_progress: items.filter((it) => it.status === 'in_progress').length,
            finished: items.filter((it) => it.status === 'finished').length,
            abandoned: items.filter((it) => it.status === 'abandoned').length,
          }}
        />
      </div>
    </div>
  );
}

/* ---- Topbar ---------------------------------------------------- */

interface TopbarProps {
  count: number;
  onOpenMenu: () => void;
  onNewItem: () => void;
}

function Topbar({ count, onOpenMenu, onNewItem }: TopbarProps) {
  const label = `Library · ${count} ${count === 1 ? 'livre' : 'livres'}`;
  return (
    <div className="sticky top-0 z-20 flex h-[52px] items-center justify-between border-b border-hair bg-bg px-6 sm:px-9">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Ouvrir le menu"
          className="-ml-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-bg-2 hover:text-ink lg:hidden"
        >
          <Bars3Icon className="h-5 w-5" aria-hidden="true" />
        </button>
        <span className="text-[12px] tracking-[0.02em] text-muted">{label}</span>
      </div>
      <button
        type="button"
        onClick={onNewItem}
        className="rounded-md bg-accent px-3.5 py-1.5 text-[12px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-accent-deep active:translate-y-px"
      >
        + Nouveau livre
      </button>
    </div>
  );
}

/* ---- Primary column (list grouped by status) ------------------- */

interface PrimaryColumnProps {
  load: LoadState;
  total: number;
  filteredCount: number;
  groups: Array<[LibraryStatus, LibraryItem[]]>;
  expanded: Set<string>;
  reviewsFor: (itemId: string) => LibraryReview[];
  onToggleExpand: (itemId: string) => void;
  onEditItem: (it: LibraryItem) => void;
  onDeleteItem: (it: LibraryItem) => void;
  onToggleFavorite: (it: LibraryItem) => void;
  onAddReview: (itemId: string) => void;
  onEditReview: (review: LibraryReview) => void;
  onDeleteReview: (review: LibraryReview) => void;
}

const STATUS_LABEL: Record<LibraryStatus, string> = {
  planned: 'À lire',
  in_progress: 'En cours',
  finished: 'Terminés',
  abandoned: 'Abandonnés',
};

function PrimaryColumn(props: PrimaryColumnProps) {
  const { load, total, filteredCount, groups } = props;
  return (
    <section className="flex min-w-0 flex-col">
      <h1 className="text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink">
        Library
      </h1>
      <p className="mt-1 mb-6 text-[14px] text-muted">
        {total} {total === 1 ? 'livre' : 'livres'} · regroupés par statut.
      </p>

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
            Chargement de la bibliothèque…
          </p>
        ) : filteredCount === 0 ? (
          <p className="border-b border-hair py-6 text-[13px] italic text-muted">
            {total === 0
              ? 'Aucun livre — ajoute le premier avec « + Nouveau livre ».'
              : 'Aucun livre pour cette sélection.'}
          </p>
        ) : (
          groups
            .filter(([, list]) => list.length > 0)
            .map(([status, list]) => (
              <GroupBlock
                key={status}
                status={status}
                items={list}
                expanded={props.expanded}
                reviewsFor={props.reviewsFor}
                onToggleExpand={props.onToggleExpand}
                onEditItem={props.onEditItem}
                onDeleteItem={props.onDeleteItem}
                onToggleFavorite={props.onToggleFavorite}
                onAddReview={props.onAddReview}
                onEditReview={props.onEditReview}
                onDeleteReview={props.onDeleteReview}
              />
            ))
        )}
      </div>
    </section>
  );
}

/* ---- Group block (one per status) ------------------------------ */

interface GroupBlockProps {
  status: LibraryStatus;
  items: LibraryItem[];
  expanded: Set<string>;
  reviewsFor: (itemId: string) => LibraryReview[];
  onToggleExpand: (itemId: string) => void;
  onEditItem: (it: LibraryItem) => void;
  onDeleteItem: (it: LibraryItem) => void;
  onToggleFavorite: (it: LibraryItem) => void;
  onAddReview: (itemId: string) => void;
  onEditReview: (review: LibraryReview) => void;
  onDeleteReview: (review: LibraryReview) => void;
}

function GroupBlock(props: GroupBlockProps) {
  return (
    <div className="mb-9 last:mb-0">
      <div className="mb-2 flex items-baseline justify-between border-b border-hair pb-1.5">
        <h2 className="text-[15px] font-semibold tracking-[-0.005em] text-ink">
          {STATUS_LABEL[props.status]}
        </h2>
        <span className="text-[11px] tabular-nums text-muted">
          {props.items.length} {props.items.length === 1 ? 'livre' : 'livres'}
        </span>
      </div>
      <ul>
        {props.items.map((it) => (
          <ItemRow
            key={it.id}
            item={it}
            expanded={props.expanded.has(it.id)}
            reviews={props.reviewsFor(it.id)}
            onToggleExpand={() => props.onToggleExpand(it.id)}
            onEdit={() => props.onEditItem(it)}
            onDelete={() => props.onDeleteItem(it)}
            onToggleFavorite={() => props.onToggleFavorite(it)}
            onAddReview={() => props.onAddReview(it.id)}
            onEditReview={props.onEditReview}
            onDeleteReview={props.onDeleteReview}
          />
        ))}
      </ul>
    </div>
  );
}

/* ---- Item row (collapses / expands its reviews) ---------------- */

interface ItemRowProps {
  item: LibraryItem;
  expanded: boolean;
  reviews: LibraryReview[];
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  onAddReview: () => void;
  onEditReview: (review: LibraryReview) => void;
  onDeleteReview: (review: LibraryReview) => void;
}

function ItemRow(props: ItemRowProps) {
  const { item, expanded, reviews } = props;
  const author = item.creators?.[0]?.name ?? '—';
  const yearLabel = item.year ? String(item.year) : '';
  const reviewsCount = reviews.length;

  return (
    <li className="group border-b border-hair last:border-b-0">
      <div className="flex items-start gap-3 py-3.5">
        <button
          type="button"
          onClick={props.onToggleExpand}
          aria-label={expanded ? 'Replier' : 'Déplier'}
          className="mt-0.5 inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-bg-2 hover:text-ink"
        >
          {expanded ? (
            <ChevronDownIcon className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          onClick={props.onToggleExpand}
          className="min-w-0 flex-1 cursor-pointer text-left"
        >
          <p className="truncate text-[14px] font-medium text-ink">{item.title}</p>
          <p className="mt-0.5 truncate text-[12px] text-muted">
            {author}
            {yearLabel ? <span className="ml-1.5 tabular-nums">· {yearLabel}</span> : null}
            {reviewsCount > 0 ? (
              <span className="ml-1.5 tabular-nums">
                · {reviewsCount} {reviewsCount === 1 ? 'note' : 'notes'}
              </span>
            ) : null}
          </p>
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={props.onToggleFavorite}
            aria-label={item.is_favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            title={item.is_favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            className={cn(
              'inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors',
              item.is_favorite
                ? 'text-accent hover:bg-accent-soft'
                : 'text-muted opacity-0 hover:bg-bg-2 hover:text-ink group-hover:opacity-100 group-focus-within:opacity-100',
            )}
          >
            {item.is_favorite ? (
              <StarSolidIcon className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <StarIcon className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={props.onEdit}
            aria-label="Modifier le livre"
            title="Modifier"
            className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted opacity-0 transition-colors hover:bg-bg-2 hover:text-ink group-hover:opacity-100 group-focus-within:opacity-100"
          >
            <PencilSquareIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={props.onDelete}
            aria-label="Supprimer le livre"
            title="Supprimer"
            className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted opacity-0 transition-colors hover:bg-danger/10 hover:text-danger group-hover:opacity-100 group-focus-within:opacity-100"
          >
            <TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="ml-9 mb-3 border-l border-hair pl-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-[0.04em] uppercase text-muted">
              Notes &amp; extraits
            </span>
            <button
              type="button"
              onClick={props.onAddReview}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium text-accent-deep transition-colors hover:bg-accent-soft"
            >
              <PlusIcon className="h-3 w-3" aria-hidden="true" />
              Ajouter
            </button>
          </div>
          {reviews.length === 0 ? (
            <p className="py-2 text-[12px] italic text-muted">
              Aucune note pour ce livre.
            </p>
          ) : (
            <ul className="space-y-3">
              {reviews.map((r) => (
                <ReviewRow
                  key={r.id}
                  review={r}
                  onEdit={() => props.onEditReview(r)}
                  onDelete={() => props.onDeleteReview(r)}
                />
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </li>
  );
}

/* ---- Review row (inside the expanded item block) --------------- */

interface ReviewRowProps {
  review: LibraryReview;
  onEdit: () => void;
  onDelete: () => void;
}

function ReviewRow({ review, onEdit, onDelete }: ReviewRowProps) {
  const dateLabel = formatReviewDate(review.date);
  const kindLabel = review.kind === 'quote' ? 'Extrait' : 'Note';
  const accent = review.kind === 'quote';

  return (
    <li className="group">
      <div className="mb-1 flex items-center gap-2 text-[11px] text-muted">
        <span
          className={cn(
            'rounded-md px-1.5 py-px text-[10px] font-semibold tracking-[0.02em]',
            accent ? 'bg-accent-soft text-accent-deep' : 'bg-bg-2 text-ink-soft',
          )}
        >
          {kindLabel}
        </span>
        <span className="tabular-nums">{dateLabel}</span>
        {review.page ? (
          <span className="tabular-nums">· p. {review.page}</span>
        ) : null}
        <span className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <button
            type="button"
            onClick={onEdit}
            aria-label="Modifier la note"
            title="Modifier"
            className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-bg-2 hover:text-ink"
          >
            <PencilSquareIcon className="h-3 w-3" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Supprimer la note"
            title="Supprimer"
            className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-danger/10 hover:text-danger"
          >
            <TrashIcon className="h-3 w-3" aria-hidden="true" />
          </button>
        </span>
      </div>
      <div className={cn(accent ? 'border-l-2 border-accent-soft pl-3 italic' : '')}>
        <JournalContent text={review.content} />
      </div>
    </li>
  );
}

/* ---- Side column (filters) ------------------------------------- */

interface SideColumnProps {
  statusFilter: LibraryStatus | 'all' | 'favorites';
  onStatusChange: (next: LibraryStatus | 'all' | 'favorites') => void;
  tags: string[];
  activeTag: string | null;
  onTagChange: (next: string | null) => void;
  counts: Record<LibraryStatus | 'all' | 'favorites', number>;
}

function SideColumn({
  statusFilter,
  onStatusChange,
  tags,
  activeTag,
  onTagChange,
  counts,
}: SideColumnProps) {
  return (
    <aside className="flex min-w-0 flex-col gap-6">
      <section>
        <SectionLabel>Statut</SectionLabel>
        <div className="flex flex-wrap gap-1">
          <FilterChip
            active={statusFilter === 'all'}
            onClick={() => onStatusChange('all')}
            label="Tous"
            count={counts.all}
          />
          <FilterChip
            active={statusFilter === 'favorites'}
            onClick={() => onStatusChange('favorites')}
            label="★ Favoris"
            count={counts.favorites}
          />
          {LIBRARY_STATUS_VALUES.map((s) => (
            <FilterChip
              key={s}
              active={statusFilter === s}
              onClick={() => onStatusChange(s)}
              label={STATUS_LABEL[s]}
              count={counts[s]}
            />
          ))}
        </div>
      </section>

      {tags.length > 0 ? (
        <section>
          <SectionLabel>Tags</SectionLabel>
          <div className="flex flex-wrap gap-1">
            <FilterChip
              active={activeTag === null}
              onClick={() => onTagChange(null)}
              label="Tous"
            />
            {tags.map((t) => (
              <FilterChip
                key={t}
                active={activeTag === t}
                onClick={() => onTagChange(t)}
                label={t}
              />
            ))}
          </div>
        </section>
      ) : null}
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
      {count !== undefined ? (
        <span className="ml-1.5 text-[11px] text-muted">{count}</span>
      ) : null}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2.5 text-[12px] font-semibold tracking-[0.02em] text-muted">
      {children}
    </div>
  );
}

/* ---- Helpers --------------------------------------------------- */

function itemFromRecord(r: DecryptedRecord<LibraryItemPayload>): LibraryItem {
  return { id: r.id, ...r.payload };
}

function reviewFromRecord(r: DecryptedRecord<LibraryReviewPayload>): LibraryReview {
  return { id: r.id, ...r.payload };
}

const REVIEW_DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function formatReviewDate(rawIso: string): string {
  const d = new Date(rawIso);
  if (Number.isNaN(d.getTime())) return rawIso;
  return REVIEW_DATE_FMT.format(d);
}
