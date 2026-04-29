import { useEffect, useMemo, useState } from 'react';
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
  TableCellsIcon,
  StarIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import {
  LIBRARY_STATUS_VALUES,
  type LibraryReviewPayload,
  type LibraryStatus,
} from '@nodea/shared';

import {
  useNodeaStore,
  selectLibrarySubview,
  type LibrarySubview,
} from '@/core/store/nodea-store';
import { JournalContent } from '@/lib/journal-markdown';
import { cn } from '@/lib/utils';
import EmptyHint from '@/ui/dirk/EmptyHint';
import FilterChip from '@/ui/dirk/FilterChip';
import GroupBlock from '@/ui/dirk/GroupBlock';
import ModuleShell from '@/ui/dirk/ModuleShell';
import PageHeading from '@/ui/dirk/PageHeading';
import Topbar from '@/ui/dirk/Topbar';

import BookPickerModal from './components/BookPickerModal';
import SideColumn from './components/SideColumn';
import ViewModeToggle from './components/ViewModeToggle';
import {
  LibraryProvider,
  useLibraryActions,
  useLibraryData,
  useLibraryFilters,
  type LibraryViewMode,
  type LoadState,
} from './context';
import { STATUS_LABEL } from './lib/constants';
import { type LibraryGroupBy } from './lib/grouping';
import {
  CELL_FILTER_LABEL,
  type CellFilter,
  type CellFilterField,
} from './lib/cell-filter';
import { formatReviewDate } from './lib/review-format';
import { normaliseForSearch } from './lib/search';
import type { LibraryGroup, LibraryItem, LibraryReview } from './lib/types';

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
 * Page-local state (decrypted records, filters, actions) lives in
 * `<LibraryProvider>` ; this file is the rendering surface — the
 * orchestrator (`LibraryView`) reads via the three hooks and feeds
 * the existing prop-driven sub-components. Subsequent commits will
 * migrate the leaves to consume the contexts directly.
 *
 * Both items and reviews live in their own encrypted collections
 * (`library-items` / `library-reviews`). The page joins them
 * client-side via `review.item_rid → item.id`.
 */

export default function LibraryPage() {
  return (
    <LibraryProvider>
      <LibraryView />
    </LibraryProvider>
  );
}

/**
 * Page rendering surface — reads page-local state from the three
 * Library contexts and feeds the existing prop-driven sub-
 * components. Subsequent commits will migrate the leaves
 * (`PrimaryColumn`, `ItemRow`, `ReviewsColumn`, …) to consume the
 * contexts directly, eliminating most of this prop plumbing.
 */
function LibraryView() {
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const subview = useNodeaStore(selectLibrarySubview);

  const { items, reviews, covers, load } = useLibraryData();
  const { viewMode, cellFilter, filteredItems, groups, setCellFilter } =
    useLibraryFilters();
  const {
    addItem,
    editItem,
    deleteItem,
    toggleFavorite,
    editReview,
    deleteReview,
    openReviewPicker,
  } = useLibraryActions();

  return (
    <>
      <ModuleShell
        topbar={
          <Topbar
            label={`Library · ${items.length} ${items.length === 1 ? 'livre' : 'livres'}`}
            onOpenMenu={() => setMobileMenuOpen(true)}
          >
            {subview === 'livres' ? (
              <>
                <ViewModeToggle />
                <DirkButton variant="primary" size="sm" onClick={addItem}>
                  + Nouveau livre
                </DirkButton>
              </>
            ) : (
              <DirkButton
                variant="primary"
                size="sm"
                onClick={() =>
                  openReviewPicker(subview === 'extraits' ? 'quote' : 'note')
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
        }
        side={<SideColumn />}
      >
        {subview === 'livres' ? (
          <PrimaryColumn
            load={load}
            total={items.length}
            filteredCount={filteredItems.length}
            groups={groups}
            covers={covers}
            viewMode={viewMode}
            cellFilter={cellFilter}
            onCellFilterChange={setCellFilter}
            onEditItem={editItem}
            onDeleteItem={deleteItem}
            onToggleFavorite={toggleFavorite}
          />
        ) : (
          <ReviewsColumn
            kind={subview === 'extraits' ? 'quote' : 'note'}
            load={load}
            items={items}
            reviews={reviews}
            onEditReview={editReview}
            onDeleteReview={deleteReview}
          />
        )}
      </ModuleShell>
      <BookPickerModal />
    </>
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
  cellFilter: CellFilter | null;
  onCellFilterChange: (next: CellFilter | null) => void;
  onEditItem: (it: LibraryItem) => void;
  onDeleteItem: (it: LibraryItem) => void;
  onToggleFavorite: (it: LibraryItem) => void;
}

function PrimaryColumn(props: PrimaryColumnProps) {
  const { load, total, filteredCount, groups, viewMode, cellFilter, onCellFilterChange } = props;
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

      {cellFilter ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px] text-ink-soft">
          <span className="text-muted">Filtre :</span>
          <span className="inline-flex items-center gap-1.5 rounded-sm border border-accent bg-accent-soft/40 px-2 py-0.5 text-accent-deep">
            <span>
              <span className="font-semibold">
                {CELL_FILTER_LABEL[cellFilter.field]}
              </span>{' '}
              · {cellFilter.value}
            </span>
            <button
              type="button"
              onClick={() => onCellFilterChange(null)}
              aria-label="Retirer le filtre"
              className="cursor-pointer text-accent-deep transition-colors hover:text-ink"
            >
              ✕
            </button>
          </span>
        </div>
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
                      onCellFilter={onCellFilterChange}
                    />
                  ))}
                </GroupBlock>
              );
            })
        ) : viewMode === 'table' ? (
          <TableView
            items={flatItems}
            onEditItem={props.onEditItem}
            onCellFilter={onCellFilterChange}
          />
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
  onCellFilter: (filter: CellFilter) => void;
}

function ItemRow(props: ItemRowProps) {
  const { item, cover, showCover } = props;
  const author = authorsLabel(item);
  const publisher = item.publisher?.trim() ?? '';
  const langCode = item.language?.toLowerCase() ?? '';
  const yearStr = item.year != null ? String(item.year) : '';

  // List-plain : everything inline on one row to stay compact.
  // List-cover : title on row 1, meta cells on row 2 — the cover's
  // extra vertical real estate gives room for a second line without
  // making the row taller than the thumb itself.
  const metaCells = (
    <>
      <FilterableCell
        field="author"
        value={author}
        onCellFilter={props.onCellFilter}
        className="max-w-40 truncate"
      />
      <span aria-hidden="true">·</span>
      <FilterableCell
        field="publisher"
        value={publisher}
        onCellFilter={props.onCellFilter}
        className="max-w-32 truncate"
      />
      <span aria-hidden="true">·</span>
      <FilterableCell
        field="language"
        value={langCode}
        display={languageLabel(item.language)}
        onCellFilter={props.onCellFilter}
      />
      <span aria-hidden="true">·</span>
      <FilterableCell
        field="year"
        value={yearStr}
        onCellFilter={props.onCellFilter}
        className="tabular-nums"
      />
    </>
  );

  return (
    <li className="group border-b border-hair last:border-b-0">
      <div className={cn('flex gap-3 py-2', showCover ? 'items-center' : 'items-baseline')}>
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

        {showCover ? (
          // Two-line layout : title on row 1, meta on row 2.
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={props.onEdit}
              className="block w-full cursor-pointer truncate text-left text-[14px] font-medium text-ink transition-colors hover:text-accent"
              title="Modifier ce livre"
            >
              {item.title}
            </button>
            <div className="mt-0.5 flex items-baseline gap-2 truncate text-[12px] text-muted">
              {metaCells}
            </div>
          </div>
        ) : (
          // Single-line layout : title + author clustered on the
          // left (title in ink, author one notch lighter right
          // beside it), then publisher · language · year on the
          // right pushed to the row's edge.
          <>
            <div className="flex min-w-0 flex-1 items-baseline gap-2 truncate">
              <button
                type="button"
                onClick={props.onEdit}
                className="cursor-pointer truncate text-left text-[14px] font-medium text-ink transition-colors hover:text-accent"
                title="Modifier ce livre"
              >
                {item.title}
              </button>
              {author ? (
                <FilterableCell
                  field="author"
                  value={author}
                  onCellFilter={props.onCellFilter}
                  className="max-w-48 truncate text-[12px] text-muted"
                />
              ) : null}
            </div>
            <div className="hidden shrink-0 items-baseline gap-2 text-[12px] text-muted sm:flex">
              <FilterableCell
                field="publisher"
                value={publisher}
                onCellFilter={props.onCellFilter}
                className="max-w-32 truncate"
              />
              <span aria-hidden="true">·</span>
              <FilterableCell
                field="language"
                value={langCode}
                display={languageLabel(item.language)}
                onCellFilter={props.onCellFilter}
              />
              <span aria-hidden="true">·</span>
              <FilterableCell
                field="year"
                value={yearStr}
                onCellFilter={props.onCellFilter}
                className="tabular-nums"
              />
            </div>
          </>
        )}

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


/* ---- Table view (one row per book, dense columns) -------------- */

interface TableViewProps {
  items: LibraryItem[];
  onEditItem: (it: LibraryItem) => void;
  onCellFilter: (filter: CellFilter) => void;
}


const LANGUAGE_LABEL: Record<string, string> = {
  fr: 'Français',
  en: 'Anglais',
  es: 'Espagnol',
  de: 'Allemand',
  it: 'Italien',
  pt: 'Portugais',
  jp: 'Japonais',
  ja: 'Japonais',
  zh: 'Chinois',
  ar: 'Arabe',
  ru: 'Russe',
  he: 'Hébreu',
};

/** Resolve a raw `item.language` code to a French label, falling
 *  back to the raw code if unknown. Used by both the table view
 *  and the inline list meta-row. */
function languageLabel(code: string | undefined): string {
  if (!code) return '';
  return LANGUAGE_LABEL[code.toLowerCase()] ?? code;
}

/** First author name on an item. Honors `role: 'author'` or
 *  unspecified (empty role) ; multi-author works land their names
 *  joined by `, `. */
function authorsLabel(it: LibraryItem): string {
  return (
    it.creators
      ?.filter((c) => !c.role || c.role === 'author')
      .map((c) => c.name.trim())
      .filter(Boolean)
      .join(', ') ?? ''
  );
}

interface FilterableCellProps {
  field: CellFilterField;
  value: string;
  display?: string;
  onCellFilter: (filter: CellFilter) => void;
  className?: string;
}

/**
 * Inline button styled to read like plain text — clicking sets the
 * matching cell filter on the catalogue. Empty values render as a
 * non-clickable « — » so empty cells don't pretend to be filterable.
 */
function FilterableCell({
  field,
  value,
  display,
  onCellFilter,
  className,
}: FilterableCellProps) {
  if (!value) {
    return <span className={cn('text-muted', className)}>—</span>;
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onCellFilter({ field, value });
      }}
      className={cn(
        'cursor-pointer text-left transition-colors hover:text-accent hover:underline underline-offset-2',
        className,
      )}
      title={`Filtrer sur ${CELL_FILTER_LABEL[field]} : ${display ?? value}`}
    >
      {display ?? value}
    </button>
  );
}

type TableSortColumn = 'title' | 'author' | 'publisher' | 'language' | 'year';

interface TableSort {
  column: TableSortColumn;
  direction: 'asc' | 'desc';
}

const TABLE_COLUMNS: ReadonlyArray<{
  id: TableSortColumn;
  label: string;
  className: string;
}> = [
  { id: 'title', label: 'Titre', className: 'py-2 pr-3' },
  { id: 'author', label: 'Auteur·rice', className: 'px-3 py-2' },
  { id: 'publisher', label: 'Éditeur', className: 'px-3 py-2' },
  { id: 'language', label: 'Langue', className: 'px-3 py-2' },
  { id: 'year', label: 'Année', className: 'px-3 py-2' },
];

function valueForSort(it: LibraryItem, column: TableSortColumn): string | number {
  switch (column) {
    case 'title':
      return it.title.toLocaleLowerCase('fr');
    case 'author':
      return authorsLabel(it).toLocaleLowerCase('fr');
    case 'publisher':
      return (it.publisher?.trim() ?? '').toLocaleLowerCase('fr');
    case 'language':
      return languageLabel(it.language).toLocaleLowerCase('fr');
    case 'year':
      return it.year ?? -Infinity;
  }
}

/**
 * Dense table view — one book per row, five columns (titre /
 * auteur·rice / éditeur / langue / année). Cells in the four
 * meta-columns are clickable filter triggers ; the title cell
 * still opens the Composer in edit mode.
 *
 * Column headers cycle through asc → desc → null on click — null
 * restores the incoming order (the catalogue's natural sort).
 * Empty values always sink to the bottom regardless of direction
 * so a row without an éditeur or langue doesn't bubble up to the
 * top of an asc sort.
 *
 * Like the grid + wall views, this mode flattens the status
 * grouping — a real table with a status column would invite
 * sorting features later, but for now the existing « par statut »
 * filter chips on the SideColumn cover the same need without
 * breaking the table's visual rhythm.
 */
function TableView({ items, onEditItem, onCellFilter }: TableViewProps) {
  const [sort, setSort] = useState<TableSort | null>(null);

  function handleSortClick(col: TableSortColumn): void {
    setSort((prev) => {
      if (!prev || prev.column !== col) return { column: col, direction: 'asc' };
      if (prev.direction === 'asc') return { column: col, direction: 'desc' };
      return null;
    });
  }

  const sortedItems = useMemo<LibraryItem[]>(() => {
    if (!sort) return items;
    const out = [...items];
    out.sort((a, b) => {
      const av = valueForSort(a, sort.column);
      const bv = valueForSort(b, sort.column);
      // Empty / missing values always sink to the bottom — both
      // strings and the year sentinel `-Infinity` are detected.
      const aEmpty = av === '' || av === -Infinity;
      const bEmpty = bv === '' || bv === -Infinity;
      if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
      let cmp: number;
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv), 'fr');
      }
      return sort.direction === 'asc' ? cmp : -cmp;
    });
    return out;
  }, [items, sort]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px] text-ink">
        <thead>
          <tr className="border-b border-hair text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">
            {TABLE_COLUMNS.map((col) => {
              const active = sort?.column === col.id;
              const ascActive = active && sort.direction === 'asc';
              const descActive = active && sort.direction === 'desc';
              return (
                <th key={col.id} className={cn(col.className, 'font-semibold')}>
                  <button
                    type="button"
                    onClick={() => handleSortClick(col.id)}
                    className={cn(
                      'inline-flex cursor-pointer items-center gap-1.5 uppercase tracking-[0.04em] transition-colors',
                      active ? 'text-ink' : 'text-muted hover:text-ink',
                    )}
                    aria-sort={
                      active
                        ? sort.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    {col.label}
                    {/* Stacked double-arrow affordance — always
                        rendered on every column header. The active
                        arrow takes the ink colour ; the inactive
                        one falls back to a faint hair tint so the
                        column still reads as sortable when nothing
                        is sorted. */}
                    <span
                      aria-hidden="true"
                      className="inline-flex flex-col items-center leading-[0.6]"
                    >
                      <span
                        className={cn(
                          'text-[8px] transition-colors',
                          ascActive ? 'text-ink' : 'text-hair',
                        )}
                      >
                        ▲
                      </span>
                      <span
                        className={cn(
                          'text-[8px] transition-colors',
                          descActive ? 'text-ink' : 'text-hair',
                        )}
                      >
                        ▼
                      </span>
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedItems.map((it) => {
            const author = authorsLabel(it);
            const publisher = it.publisher?.trim() ?? '';
            const langCode = it.language?.toLowerCase() ?? '';
            const yearStr = it.year != null ? String(it.year) : '';
            return (
              <tr
                key={it.id}
                className="border-b border-hair last:border-b-0 transition-colors hover:bg-bg-2"
              >
                <td className="py-2 pr-3">
                  <button
                    type="button"
                    onClick={() => onEditItem(it)}
                    className="block w-full cursor-pointer truncate text-left font-medium text-ink transition-colors hover:text-accent"
                    title="Modifier ce livre"
                  >
                    {it.title}
                  </button>
                </td>
                <td className="px-3 py-2 text-ink-soft">
                  <FilterableCell
                    field="author"
                    value={author}
                    onCellFilter={onCellFilter}
                    className="block truncate"
                  />
                </td>
                <td className="px-3 py-2 text-ink-soft">
                  <FilterableCell
                    field="publisher"
                    value={publisher}
                    onCellFilter={onCellFilter}
                    className="block truncate"
                  />
                </td>
                <td className="px-3 py-2 text-ink-soft">
                  <FilterableCell
                    field="language"
                    value={langCode}
                    display={languageLabel(it.language)}
                    onCellFilter={onCellFilter}
                  />
                </td>
                <td className="px-3 py-2 tabular-nums text-ink-soft">
                  <FilterableCell
                    field="year"
                    value={yearStr}
                    onCellFilter={onCellFilter}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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

