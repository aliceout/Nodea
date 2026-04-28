import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DirkButton from '@/ui/atoms/dirk/Button';
import DirkInput from '@/ui/atoms/dirk/Input';
import { Modal } from '@/ui/atoms/layout/Modal';
import {
  Bars3Icon,
  ListBulletIcon,
  PencilSquareIcon,
  QueueListIcon,
  RectangleGroupIcon,
  Squares2X2Icon,
  StarIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import {
  LIBRARY_STATUS_VALUES,
  type LibraryCoverPayload,
  type LibraryItemPayload,
  type LibraryReviewPayload,
  type LibraryStatus,
} from '@nodea/shared';

import {
  libraryCoversClient,
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
import EmptyHint from '@/ui/dirk/EmptyHint';
import FilterChip from '@/ui/dirk/FilterChip';
import GroupBlock from '@/ui/dirk/GroupBlock';
import PageHeading from '@/ui/dirk/PageHeading';
import Topbar from '@/ui/dirk/Topbar';

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

type LibrarySubview = 'livres' | 'extraits' | 'notes';
const LIBRARY_SUBVIEWS: readonly LibrarySubview[] = ['livres', 'extraits', 'notes'];

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

  // The Library page exposes three lenses on the same encrypted
  // collections: the books themselves (`livres`), the highlighted
  // extracts pulled from them (`extraits` = `reviews` with
  // `kind=quote`), and the freeform notes (`notes` = `kind=note`).
  // The active lens is driven by the URL so the Sidebar's sub-nav
  // and any deep link end up on the same page state.
  const [searchParams] = useSearchParams();
  const subviewParam = searchParams.get('subview');
  const subview: LibrarySubview =
    subviewParam && (LIBRARY_SUBVIEWS as readonly string[]).includes(subviewParam)
      ? (subviewParam as LibrarySubview)
      : 'livres';

  const [items, setItems] = useState<LibraryItem[]>([]);
  const [reviews, setReviews] = useState<LibraryReview[]>([]);
  // Decrypted cover blobs, keyed by the cover record's id (= the
  // value stored on `item.cover_rid`). Built once at mount from the
  // bulk decrypt of the `library-covers` collection. Items without a
  // cover_rid never look up here. Empty Map is fine.
  const [covers, setCovers] = useState<Map<string, string>>(() => new Map());
  const [load, setLoad] = useState<LoadState>({ status: 'idle' });
  const [statusFilter, setStatusFilter] = useState<LibraryStatus | 'all' | 'favorites'>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<LibraryGroupBy>('status');
  // Picker shown when the user clicks « + Nouvel extrait » / « +
  // Nouvelle note ». A review needs an `item_rid` so we ask the
  // user to pick the parent book first, then route to the standard
  // composer with the kind + item_rid pre-filled.
  const [reviewPicker, setReviewPicker] = useState<
    { open: false } | { open: true; kind: 'quote' | 'note' }
  >({ open: false });
  // View mode for the catalogue. Persisted to localStorage so the
  // user's choice sticks across sessions on the same device. We
  // don't sync this through the encrypted preferences blob — it's a
  // local UI decision, the cross-device hop isn't worth the wiring.
  const [viewMode, setViewMode] = useState<LibraryViewMode>(() => readViewMode());
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (!mainKey || !moduleUserId) return undefined;
    let cancelled = false;
    setLoad({ status: 'loading' });
    Promise.all([
      libraryItemsClient.list(moduleUserId, mainKey),
      libraryReviewsClient.list(moduleUserId, mainKey),
      libraryCoversClient.list(moduleUserId, mainKey),
    ])
      .then(([itemRecords, reviewRecords, coverRecords]) => {
        if (cancelled) return;
        setItems(itemRecords.map(itemFromRecord));
        setReviews(reviewRecords.map(reviewFromRecord));
        setCovers(buildCoverMap(coverRecords));
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

  const groups = useMemo<LibraryGroup[]>(
    () => buildGroups(filteredItems, groupBy),
    [filteredItems, groupBy],
  );

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

  /**
   * Called by the picker when the user has chosen which book the new
   * review attaches to. Closes the picker and routes to the standard
   * review composer with the kind + item_rid pre-filled — same path
   * the old inline expand `+ Ajouter` button used to take.
   */
  function handlePickBookForReview(itemId: string, kind: 'quote' | 'note'): void {
    setReviewPicker({ open: false });
    openComposer('library-review', {
      type: 'library-review',
      id: '',
      payload: {
        item_rid: itemId,
        date: new Date().toISOString(),
        kind,
        title: null,
        content: '',
        page: null,
        spoiler: false,
      },
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
        label={`Library · ${items.length} ${items.length === 1 ? 'livre' : 'livres'}`}
        onOpenMenu={() => setMobileMenuOpen(true)}
      >
        {subview === 'livres' ? (
          <>
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
            <DirkButton
              variant="primary"
              size="sm"
              onClick={() => openComposer('library-item')}
            >
              + Nouveau livre
            </DirkButton>
          </>
        ) : (
          <DirkButton
            variant="primary"
            size="sm"
            onClick={() =>
              setReviewPicker({
                open: true,
                kind: subview === 'extraits' ? 'quote' : 'note',
              })
            }
            disabled={items.length === 0}
            {...(items.length === 0
              ? { title: 'Ajoute d’abord un livre dans Library.' }
              : {})}
          >
            {subview === 'extraits' ? '+ Nouvel extrait' : '+ Nouvelle note'}
          </DirkButton>
        )}
      </Topbar>

      <div className="grid grid-cols-1 gap-9 px-6 py-7 sm:px-9 lg:grid-cols-[1fr_280px]">
        {subview === 'livres' ? (
          <PrimaryColumn
            load={load}
            total={items.length}
            filteredCount={filteredItems.length}
            groups={groups}
            covers={covers}
            viewMode={viewMode}
            onEditItem={handleEditItem}
            onDeleteItem={handleDeleteItem}
            onToggleFavorite={handleToggleFavorite}
          />
        ) : (
          <ReviewsColumn
            kind={subview === 'extraits' ? 'quote' : 'note'}
            load={load}
            items={items}
            reviews={reviews}
            onEditReview={handleEditReview}
            onDeleteReview={handleDeleteReview}
          />
        )}
        <SideColumn
          subview={subview}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          tags={allTags}
          activeTag={tagFilter}
          onTagChange={setTagFilter}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
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
      {reviewPicker.open ? (
        <BookPickerModal
          kind={reviewPicker.kind}
          items={items}
          covers={covers}
          onPick={(itemId) => handlePickBookForReview(itemId, reviewPicker.kind)}
          onClose={() => setReviewPicker({ open: false })}
        />
      ) : null}
    </div>
  );
}

/* ---- View mode toggle ------------------------------------------ */

interface ViewModeToggleProps {
  value: LibraryViewMode;
  onChange: (next: LibraryViewMode) => void;
}

const VIEW_MODE_DEFS: ReadonlyArray<{
  id: LibraryViewMode;
  label: string;
  Icon: typeof ListBulletIcon;
}> = [
  { id: 'list-plain', label: 'Liste compacte', Icon: ListBulletIcon },
  { id: 'list-cover', label: 'Liste avec couverture', Icon: QueueListIcon },
  { id: 'grid', label: 'Grille', Icon: Squares2X2Icon },
  { id: 'wall', label: 'Mur de couvertures', Icon: RectangleGroupIcon },
];

function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Mode d'affichage"
      className="flex items-center gap-0.5 rounded-sm border border-hair bg-bg-2/60 p-0.5"
    >
      {VIEW_MODE_DEFS.map(({ id, label, Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => onChange(id)}
            className={cn(
              'inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-[5px] transition-colors',
              active
                ? 'bg-bg text-ink shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                : 'text-muted hover:bg-bg hover:text-ink',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

/* ---- Primary column (list grouped by status) ------------------- */

interface PrimaryColumnProps {
  load: LoadState;
  total: number;
  filteredCount: number;
  groups: LibraryGroup[];
  covers: Map<string, string>;
  viewMode: LibraryViewMode;
  onEditItem: (it: LibraryItem) => void;
  onDeleteItem: (it: LibraryItem) => void;
  onToggleFavorite: (it: LibraryItem) => void;
}

const STATUS_LABEL: Record<LibraryStatus, string> = {
  planned: 'À lire',
  in_progress: 'En cours',
  finished: 'Terminés',
  abandoned: 'Abandonnés',
};

function PrimaryColumn(props: PrimaryColumnProps) {
  const { load, total, filteredCount, groups, viewMode } = props;
  const isListMode = viewMode === 'list-plain' || viewMode === 'list-cover';
  // Flat list for the gallery views — they ignore the grouping
  // (a wall of covers fragmented into N section headers would break
  // the visual rhythm). The status is still surfaced as a small
  // pill on each card so the user can tell "in progress" apart from
  // "finished" at a glance.
  const flatItems = useMemo(
    () => groups.flatMap((g) => g.items),
    [groups],
  );
  return (
    <section className="flex min-w-0 flex-col">
      <PageHeading>Library</PageHeading>

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
          <EmptyHint>Chargement de la bibliothèque…</EmptyHint>
        ) : filteredCount === 0 ? (
          <EmptyHint>
            {total === 0
              ? 'Aucun livre — ajoute le premier avec « + Nouveau livre ».'
              : 'Aucun livre pour cette sélection.'}
          </EmptyHint>
        ) : isListMode ? (
          groups
            .filter((g) => g.items.length > 0)
            .map((g) => {
              const showCover = viewMode === 'list-cover';
              return (
                <GroupBlock
                  key={g.key}
                  label={g.label}
                  count={g.items.length}
                  countNoun="livre"
                  variant="subtitle"
                >
                  {g.items.map((it) => (
                    <ItemRow
                      key={it.id}
                      item={it}
                      cover={showCover && it.cover_rid ? props.covers.get(it.cover_rid) ?? null : null}
                      showCover={showCover}
                      onEdit={() => props.onEditItem(it)}
                      onDelete={() => props.onDeleteItem(it)}
                      onToggleFavorite={() => props.onToggleFavorite(it)}
                    />
                  ))}
                </GroupBlock>
              );
            })
        ) : viewMode === 'grid' ? (
          <GridView
            items={flatItems}
            covers={props.covers}
            onEditItem={props.onEditItem}
            onDeleteItem={props.onDeleteItem}
            onToggleFavorite={props.onToggleFavorite}
          />
        ) : (
          <WallView
            items={flatItems}
            covers={props.covers}
            onEditItem={props.onEditItem}
            onDeleteItem={props.onDeleteItem}
          />
        )}
      </div>
    </section>
  );
}

/* ---- Reviews column (Extraits / Notes sub-views) -------------- */

interface ReviewsColumnProps {
  kind: LibraryReviewPayload['kind'];
  load: LoadState;
  items: LibraryItem[];
  reviews: LibraryReview[];
  onEditReview: (review: LibraryReview) => void;
  onDeleteReview: (review: LibraryReview) => void;
}

const REVIEW_VIEW_HEADING: Record<LibraryReviewPayload['kind'], string> = {
  quote: 'Extraits',
  note: 'Notes',
};

const REVIEW_VIEW_EMPTY: Record<LibraryReviewPayload['kind'], string> = {
  quote: 'Aucun extrait pour le moment — ouvre un livre et ajoute-en un.',
  note: 'Aucune note pour le moment — ouvre un livre et ajoute-en une.',
};

function ReviewsColumn({
  kind,
  load,
  items,
  reviews,
  onEditReview,
  onDeleteReview,
}: ReviewsColumnProps) {
  // Build a quick lookup so each review row can show its book's
  // title / author without having to re-scan `items` linearly. The
  // reviews collection has `item_rid` pointing to the item id.
  const itemsById = useMemo(() => {
    const map = new Map<string, LibraryItem>();
    for (const it of items) map.set(it.id, it);
    return map;
  }, [items]);

  const filtered = useMemo(
    () =>
      reviews
        .filter((r) => r.kind === kind)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [reviews, kind],
  );

  const heading = REVIEW_VIEW_HEADING[kind];
  return (
    <section className="flex min-w-0 flex-col">
      <PageHeading>{heading}</PageHeading>

      {load.status === 'error' ? (
        <p
          role="alert"
          className="mb-4 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[12px] text-danger"
        >
          {load.message}
        </p>
      ) : null}

      {load.status === 'loading' ? (
        <EmptyHint>Chargement…</EmptyHint>
      ) : filtered.length === 0 ? (
        <EmptyHint>{REVIEW_VIEW_EMPTY[kind]}</EmptyHint>
      ) : (
        <ul className="flex flex-col gap-5">
          {filtered.map((r) => (
            <FlatReviewRow
              key={r.id}
              review={r}
              book={itemsById.get(r.item_rid) ?? null}
              onEdit={() => onEditReview(r)}
              onDelete={() => onDeleteReview(r)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

interface FlatReviewRowProps {
  review: LibraryReview;
  /** The owning book record, or null if it was deleted out from
   * under the review (orphan — should be rare but we render
   * defensively). */
  book: LibraryItem | null;
  onEdit: () => void;
  onDelete: () => void;
}

function FlatReviewRow({ review, book, onEdit, onDelete }: FlatReviewRowProps) {
  const dateLabel = formatReviewDate(review.date);
  const accent = review.kind === 'quote';
  const bookTitle = book?.title ?? '(livre supprimé)';
  const bookAuthor = book?.creators?.[0]?.name ?? '';
  return (
    <li className="group border-b border-hair pb-5 last:border-b-0">
      <div className="mb-1 flex items-center gap-2 text-[11.5px] text-muted">
        <span className="truncate font-medium text-ink-soft" title={bookTitle}>
          {bookTitle}
        </span>
        {bookAuthor ? (
          <span className="truncate text-muted">· {bookAuthor}</span>
        ) : null}
        <span className="ml-auto flex shrink-0 items-center gap-2">
          <span className="tabular-nums">{dateLabel}</span>
          {review.page ? (
            <span className="tabular-nums">· p. {review.page}</span>
          ) : null}
          <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <DirkButton
              variant="ghost"
              size="xs"
              iconOnly
              onClick={onEdit}
              aria-label="Modifier"
              title="Modifier"
            >
              <PencilSquareIcon className="h-3 w-3" aria-hidden="true" />
            </DirkButton>
            <DirkButton
              variant="danger-ghost"
              size="xs"
              iconOnly
              onClick={onDelete}
              aria-label="Supprimer"
              title="Supprimer"
            >
              <TrashIcon className="h-3 w-3" aria-hidden="true" />
            </DirkButton>
          </span>
        </span>
      </div>
      <div className={cn(accent ? 'border-l-2 border-accent-soft pl-3 italic' : '')}>
        <JournalContent text={review.content} />
      </div>
    </li>
  );
}

/* ---- Item row -------------------------------------------------- */

interface ItemRowProps {
  item: LibraryItem;
  /** Decrypted cover data URL when `showCover` is true and the item
   * has one, else null. Null renders a small placeholder so the row
   * heights stay aligned. */
  cover: string | null;
  showCover: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}

function ItemRow(props: ItemRowProps) {
  const { item, cover, showCover } = props;
  const author = item.creators?.[0]?.name ?? '—';
  const yearLabel = item.year ? String(item.year) : '';

  return (
    <li className="group border-b border-hair last:border-b-0">
      <div className="flex items-center gap-3 py-3.5">
        {showCover ? (
          cover ? (
            <img
              src={cover}
              alt=""
              className="h-12 w-8 shrink-0 rounded-sm border border-hair bg-bg-2 object-cover"
            />
          ) : (
            // Empty placeholder so the title column stays aligned
            // across rows that have / don't have a cover. Same
            // dimensions as the real cover thumb.
            <div
              aria-hidden="true"
              className="h-12 w-8 shrink-0 rounded-sm border border-hair border-dashed bg-bg-2/60"
            />
          )
        ) : null}

        {/* The whole row text is the click target — opens the
            composer in edit mode. The dropdown-to-expand-reviews UI
            is gone; reviews now live on their own routes
            (`?subview=extraits` / `?subview=notes`). */}
        <button
          type="button"
          onClick={props.onEdit}
          className="min-w-0 flex-1 cursor-pointer text-left"
        >
          <p className="truncate text-[14px] font-medium text-ink">{item.title}</p>
          <p className="mt-0.5 truncate text-[12px] text-muted">
            {author}
            {yearLabel ? <span className="ml-1.5 tabular-nums">· {yearLabel}</span> : null}
          </p>
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={props.onToggleFavorite}
            aria-label={item.is_favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            title={item.is_favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            className={cn(
              'inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-sm transition-colors',
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
          <DirkButton
            variant="danger-ghost"
            size="sm"
            iconOnly
            onClick={props.onDelete}
            aria-label="Supprimer le livre"
            title="Supprimer"
            className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
          >
            <TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </DirkButton>
        </div>
      </div>
    </li>
  );
}


/* ---- Grid view (cards with cover + title) ---------------------- */

interface GridViewProps {
  items: LibraryItem[];
  covers: Map<string, string>;
  onEditItem: (it: LibraryItem) => void;
  onDeleteItem: (it: LibraryItem) => void;
  onToggleFavorite: (it: LibraryItem) => void;
}

function GridView({ items, covers, onEditItem, onDeleteItem, onToggleFavorite }: GridViewProps) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
      {items.map((it) => {
        const cover = it.cover_rid ? covers.get(it.cover_rid) ?? null : null;
        const author = it.creators?.[0]?.name ?? '';
        const yearLabel = it.year ? String(it.year) : '';
        return (
          <li key={it.id} className="group flex min-w-0 flex-col">
            <button
              type="button"
              onClick={() => onEditItem(it)}
              aria-label={`Ouvrir ${it.title}`}
              className="relative block w-full cursor-pointer overflow-hidden rounded-sm border border-hair bg-bg-2 transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
            >
              {cover ? (
                <img
                  src={cover}
                  alt=""
                  className="aspect-[2/3] w-full object-cover"
                />
              ) : (
                <div
                  className="flex aspect-[2/3] w-full items-center justify-center bg-bg-2 px-2 text-center text-[11px] italic text-muted-soft"
                  aria-hidden="true"
                >
                  Pas de couverture
                </div>
              )}
              {/* Status pill in the corner so the user can tell apart
                  in-progress / finished / abandoned at a glance,
                  without taking extra vertical space below the card. */}
              <span
                className={cn(
                  'absolute top-1.5 left-1.5 rounded px-1.5 py-px text-[10px] font-semibold tracking-[0.02em]',
                  STATUS_PILL_CLASS[it.status],
                )}
              >
                {STATUS_LABEL[it.status]}
              </span>
              {it.is_favorite ? (
                <span
                  className="absolute top-1.5 right-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-bg/80 text-accent shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                  aria-label="Favori"
                >
                  <StarSolidIcon className="h-3 w-3" aria-hidden="true" />
                </span>
              ) : null}
            </button>
            <div className="mt-2 flex items-start gap-1">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-ink" title={it.title}>
                  {it.title}
                </p>
                <p className="truncate text-[11.5px] text-muted">
                  {author}
                  {yearLabel ? <span className="ml-1 tabular-nums">· {yearLabel}</span> : null}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onToggleFavorite(it)}
                  aria-label={it.is_favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  title={it.is_favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  className={cn(
                    'inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-sm transition-colors',
                    it.is_favorite
                      ? 'text-accent hover:bg-accent-soft'
                      : 'text-muted opacity-0 hover:bg-bg-2 hover:text-ink group-hover:opacity-100 group-focus-within:opacity-100',
                  )}
                >
                  {it.is_favorite ? (
                    <StarSolidIcon className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <StarIcon className="h-3 w-3" aria-hidden="true" />
                  )}
                </button>
                <DirkButton
                  variant="danger-ghost"
                  size="xs"
                  iconOnly
                  onClick={() => onDeleteItem(it)}
                  aria-label="Supprimer le livre"
                  title="Supprimer"
                  className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                >
                  <TrashIcon className="h-3 w-3" aria-hidden="true" />
                </DirkButton>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Status colour mapping for the grid pill. Kept terse — the whole
 * library accent palette already stays close to sage / hair tones.
 */
const STATUS_PILL_CLASS: Record<LibraryStatus, string> = {
  in_progress: 'bg-accent text-white',
  planned: 'bg-bg/85 text-ink-soft backdrop-blur-sm',
  finished: 'bg-bg/85 text-muted backdrop-blur-sm',
  abandoned: 'bg-bg/85 text-muted-soft backdrop-blur-sm',
};

/* ---- Wall view (covers only, dense) ---------------------------- */

interface WallViewProps {
  items: LibraryItem[];
  covers: Map<string, string>;
  onEditItem: (it: LibraryItem) => void;
  onDeleteItem: (it: LibraryItem) => void;
}

function WallView({ items, covers, onEditItem, onDeleteItem }: WallViewProps) {
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8">
      {items.map((it) => {
        const cover = it.cover_rid ? covers.get(it.cover_rid) ?? null : null;
        const author = it.creators?.[0]?.name ?? '';
        return (
          <li key={it.id} className="group relative min-w-0">
            <button
              type="button"
              onClick={() => onEditItem(it)}
              aria-label={`${it.title}${author ? ` — ${author}` : ''}`}
              title={`${it.title}${author ? ` — ${author}` : ''}`}
              className="relative block w-full cursor-pointer overflow-hidden rounded-sm border border-hair bg-bg-2 transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] focus-visible:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus-visible:outline-none"
            >
              {cover ? (
                <img
                  src={cover}
                  alt=""
                  className="aspect-[2/3] w-full object-cover"
                />
              ) : (
                // No cover: render a tile that still carries the
                // title text so the wall stays scannable. Cropped
                // hard at the same 2:3 ratio so the grid alignment
                // doesn't break.
                <div
                  className="flex aspect-[2/3] w-full items-center justify-center px-1.5 py-2 text-center"
                  aria-hidden="true"
                >
                  <span className="line-clamp-4 text-[10.5px] leading-[1.25] text-ink-soft">
                    {it.title}
                  </span>
                </div>
              )}
              {/* Hover overlay reveals the title for cover-only tiles
                  — the wall view trades textual density for visual
                  density, but a name on hover is the bare minimum to
                  not be an unsearchable blob. */}
              <span className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-ink/85 to-ink/0 px-1.5 py-1 text-[10px] leading-[1.2] text-white opacity-0 transition-[opacity,transform] duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
                <span className="block truncate font-medium">{it.title}</span>
                {author ? <span className="block truncate opacity-80">{author}</span> : null}
              </span>
              {it.is_favorite ? (
                <span
                  className="absolute top-1 left-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-bg/85 text-accent"
                  aria-label="Favori"
                >
                  <StarSolidIcon className="h-2.5 w-2.5" aria-hidden="true" />
                </span>
              ) : null}
            </button>
            {/* Delete sits as a sibling of the cover button, not
                inside it — putting a button-in-a-button is invalid
                HTML and Chrome dispatches the outer click on inner
                clicks. Hover-revealed so the wall stays clean when
                the user is just browsing. */}
            <button
              type="button"
              onClick={() => onDeleteItem(it)}
              aria-label="Supprimer le livre"
              title="Supprimer"
              className="absolute top-1 right-1 inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-bg/85 text-muted opacity-0 transition-[opacity,colors] hover:bg-danger/15 hover:text-danger group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
            >
              <TrashIcon className="h-3 w-3" aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ---- Book picker modal (new extract / note flow) -------------- */

interface BookPickerModalProps {
  kind: 'quote' | 'note';
  items: LibraryItem[];
  covers: Map<string, string>;
  onPick: (itemId: string) => void;
  onClose: () => void;
}

/**
 * Picker shown after the user clicks « + Nouvel extrait » /
 * « + Nouvelle note ». A review is constrained to belong to a
 * specific book (`item_rid`), so we ask which one before opening
 * the actual composer.
 *
 * UX: a small dialog with an autofocused search input and a
 * filtered list. Matches on title and first author, case- and
 * diacritic-insensitive (folk knowledge: "ernaux" should match
 * "Annie ERNAUX"). Clicking a row routes to the existing review
 * composer with the right kind + item_rid baked in. Esc / backdrop
 * click closes.
 */
function BookPickerModal({
  kind,
  items,
  covers,
  onPick,
  onClose,
}: BookPickerModalProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = normaliseForSearch(query.trim());
    const sorted = [...items].sort((a, b) => a.title.localeCompare(b.title, 'fr'));
    if (!q) return sorted;
    return sorted.filter((it) => {
      const haystack = normaliseForSearch(
        `${it.title} ${it.creators?.[0]?.name ?? ''}`,
      );
      return haystack.includes(q);
    });
  }, [items, query]);

  const heading =
    kind === 'quote' ? 'Nouvel extrait' : 'Nouvelle note';

  // Same fixed body height as the Composer modals — `h-[600px]`
  // capped at `100vh-200px` for short viewports. The shell
  // (backdrop, panel border, animation) comes from the shared
  // `<Modal>` atom, the layout below is what's specific to the
  // picker.
  return (
    <Modal open onClose={onClose}>
      <div className="flex h-[600px] max-h-[calc(100vh-200px)] flex-col">
        <div className="border-b border-hair px-[22px] pt-3.5 pb-3">
          <h2 className="text-[14px] font-semibold tracking-[-0.005em] text-ink">
            {heading}
          </h2>
          <p className="mt-0.5 text-[12px] text-muted">
            Choisis le livre auquel rattacher
            {kind === 'quote' ? ' cet extrait' : ' cette note'}.
          </p>
        </div>
        <div className="px-[22px] pt-3">
          <DirkInput
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'Enter' && filtered[0]) {
                e.preventDefault();
                onPick(filtered[0].id);
              }
            }}
            placeholder="Rechercher un livre par titre ou auteur·rice…"
          />
        </div>
        <ul className="min-h-0 flex-1 overflow-auto px-2 py-2">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-[12px] italic text-muted">
              {items.length === 0
                ? 'Aucun livre dans la bibliothèque.'
                : 'Aucun résultat pour cette recherche.'}
            </li>
          ) : (
            filtered.map((it) => {
              const cover = it.cover_rid
                ? covers.get(it.cover_rid) ?? null
                : null;
              const author = it.creators?.[0]?.name ?? '—';
              const yearLabel = it.year ? String(it.year) : '';
              return (
                <li key={it.id}>
                  <button
                    type="button"
                    onClick={() => onPick(it.id)}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-left transition-colors hover:bg-bg-2"
                  >
                    {cover ? (
                      <img
                        src={cover}
                        alt=""
                        className="h-12 w-8 shrink-0 rounded-sm border border-hair bg-bg-2 object-cover"
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        className="h-12 w-8 shrink-0 rounded-sm border border-hair border-dashed bg-bg-2/60"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink">
                        {it.title}
                      </p>
                      <p className="truncate text-[12px] text-muted">
                        {author}
                        {yearLabel ? (
                          <span className="ml-1.5 tabular-nums">
                            · {yearLabel}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <div className="flex justify-end gap-2 border-t border-hair bg-bg-2/40 px-[22px] py-3">
          <DirkButton variant="secondary" onClick={onClose}>
            Annuler
          </DirkButton>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Diacritic + case folding for the picker search input. "Ernaux",
 * "ernaux", and "ÉRNAUX" all want to match the same row. Uses
 * NFD + combining-mark strip — works for FR/EN/ES; broken for
 * scripts that don't use combining marks (CJK, Arabic, …) but
 * those still pass through case-fold which is the main lever.
 */
function normaliseForSearch(s: string): string {
  return s
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/* ---- Side column (filters) ------------------------------------- */

interface SideColumnProps {
  /** Drives whether the group-by selector is shown. The Extraits /
   * Notes views share the column for visual consistency but only
   * the books view (`livres`) lets the user re-group. */
  subview: LibrarySubview;
  statusFilter: LibraryStatus | 'all' | 'favorites';
  onStatusChange: (next: LibraryStatus | 'all' | 'favorites') => void;
  tags: string[];
  activeTag: string | null;
  onTagChange: (next: string | null) => void;
  groupBy: LibraryGroupBy;
  onGroupByChange: (next: LibraryGroupBy) => void;
  counts: Record<LibraryStatus | 'all' | 'favorites', number>;
}

function SideColumn({
  subview,
  statusFilter,
  onStatusChange,
  tags,
  activeTag,
  onTagChange,
  groupBy,
  onGroupByChange,
  counts,
}: SideColumnProps) {
  const showGroupBy = subview === 'livres';
  return (
    <aside className="sticky top-20 flex min-w-0 flex-col gap-6 self-start">
      {showGroupBy ? (
        <section>
          <SectionLabel>Grouper par</SectionLabel>
          <div className="flex flex-wrap gap-1">
            {LIBRARY_GROUP_BY_OPTIONS.map((opt) => (
              <FilterChip
                key={opt.value}
                active={groupBy === opt.value}
                onClick={() => onGroupByChange(opt.value)}
                label={opt.label}
              />
            ))}
          </div>
        </section>
      ) : null}

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

/**
 * Turn the bulk-decrypted cover records into a Map keyed by the
 * cover row's id (which is the value stored as `cover_rid` on the
 * matching item). The data URL is `data:<mime>;base64,<blob_b64>`
 * — directly usable as `<img src>`. No URL.createObjectURL overhead
 * (which would require revocation on unmount).
 */
function buildCoverMap(
  records: DecryptedRecord<LibraryCoverPayload>[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of records) {
    const url = `data:${r.payload.mime};base64,${r.payload.blob_b64}`;
    map.set(r.id, url);
  }
  return map;
}

/* ---- Grouping ---------------------------------------------------
 * The catalogue list view supports five grouping axes — status (the
 * historical default, ordered by reading flow: en cours → à lire →
 * terminés → abandonnés), and four metadata-driven ones (author,
 * tag, publisher, collection). All five share the same render
 * (`GroupBlock`) so adding more later is just a buildGroups branch.
 *
 * Tag grouping is the only one where a single book lands in
 * multiple groups (a book tagged `classique, roman` shows in both
 * sections). That's intentional — the user reads the page to scan
 * "what do I have in this category", not "what's the canonical
 * home for this book". For the others a book has at most one
 * value per axis, so each book appears once.
 */

interface LibraryGroup {
  /** Stable key for React reconciliation (status code, normalised
   * tag, author name, etc.). */
  key: string;
  /** Human-readable header rendered above the items. */
  label: string;
  items: LibraryItem[];
}

const LIBRARY_GROUP_BY_VALUES = [
  'status',
  'author',
  'tag',
  'publisher',
  'collection',
] as const;
type LibraryGroupBy = (typeof LIBRARY_GROUP_BY_VALUES)[number];

const LIBRARY_GROUP_BY_OPTIONS: ReadonlyArray<{
  value: LibraryGroupBy;
  label: string;
}> = [
  { value: 'status', label: 'Statut' },
  { value: 'author', label: 'Auteur·ice' },
  { value: 'tag', label: 'Catégorie' },
  { value: 'publisher', label: 'Éditeur' },
  { value: 'collection', label: 'Collection' },
];

const STATUS_GROUP_ORDER: readonly LibraryStatus[] = [
  'in_progress',
  'planned',
  'finished',
  'abandoned',
];

/** Empty-bucket label used when an item has no value for the
 * grouping axis (no author, no tag, no publisher, no collection). */
const NO_VALUE_LABEL: Record<Exclude<LibraryGroupBy, 'status'>, string> = {
  author: 'Auteur·ice inconnu·e',
  tag: 'Sans catégorie',
  publisher: 'Éditeur inconnu',
  collection: 'Sans collection',
};

function buildGroups(
  items: readonly LibraryItem[],
  groupBy: LibraryGroupBy,
): LibraryGroup[] {
  if (groupBy === 'status') {
    const map = new Map<LibraryStatus, LibraryItem[]>();
    for (const status of LIBRARY_STATUS_VALUES) map.set(status, []);
    for (const it of items) (map.get(it.status) ?? []).push(it);
    for (const [, list] of map) {
      list.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
    }
    return STATUS_GROUP_ORDER.map(
      (s): LibraryGroup => ({
        key: s,
        label: STATUS_LABEL[s],
        items: map.get(s) ?? [],
      }),
    );
  }

  // Metadata-driven groupings: walk the items, key on the chosen
  // axis, alphabetical bucket order. The "no value" bucket goes
  // last so the populated groups stay at the top of the page.
  const buckets = new Map<string, LibraryItem[]>();
  const noValueBucket: LibraryItem[] = [];
  for (const it of items) {
    const keys = groupKeysFor(it, groupBy);
    if (keys.length === 0) {
      noValueBucket.push(it);
      continue;
    }
    for (const k of keys) {
      const list = buckets.get(k);
      if (list) list.push(it);
      else buckets.set(k, [it]);
    }
  }
  const sortedKeys = Array.from(buckets.keys()).sort((a, b) =>
    a.localeCompare(b, 'fr'),
  );
  const groups: LibraryGroup[] = sortedKeys.map((k): LibraryGroup => {
    const list = buckets.get(k) ?? [];
    list.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
    return { key: k, label: k, items: list };
  });
  if (noValueBucket.length > 0) {
    noValueBucket.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
    groups.push({
      key: '__none__',
      label: NO_VALUE_LABEL[groupBy],
      items: noValueBucket,
    });
  }
  return groups;
}

/**
 * Per-axis keys for a single item. A book can land in zero (no
 * value), one (author / publisher / collection), or many (every
 * tag) buckets. Empty strings are filtered out so blank values
 * don't create their own ghost bucket.
 */
function groupKeysFor(
  item: LibraryItem,
  groupBy: Exclude<LibraryGroupBy, 'status'>,
): string[] {
  switch (groupBy) {
    case 'author': {
      const name = item.creators?.[0]?.name?.trim() ?? '';
      return name ? [name] : [];
    }
    case 'tag': {
      return (item.tags ?? []).map((t) => t.trim()).filter(Boolean);
    }
    case 'publisher': {
      const p = item.publisher?.trim() ?? '';
      return p ? [p] : [];
    }
    case 'collection': {
      const c = item.collection?.trim() ?? '';
      return c ? [c] : [];
    }
  }
}

/* ---- View mode persistence ------------------------------------- */

const VIEW_MODE_STORAGE_KEY = 'nodea:library:viewMode';
const LIBRARY_VIEW_MODES = ['list-plain', 'list-cover', 'grid', 'wall'] as const;
type LibraryViewMode = (typeof LIBRARY_VIEW_MODES)[number];

function readViewMode(): LibraryViewMode {
  if (typeof window === 'undefined') return 'list-plain';
  const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
  if (stored && (LIBRARY_VIEW_MODES as readonly string[]).includes(stored)) {
    return stored as LibraryViewMode;
  }
  return 'list-plain';
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
