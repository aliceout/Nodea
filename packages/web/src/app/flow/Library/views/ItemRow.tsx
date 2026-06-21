import { memo } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';

import DirkButton from '@/ui/atoms/dirk/Button';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';

import FavoriteToggle from '../components/FavoriteToggle';
import { useLibraryActions, useLibraryData } from '../context';
import { authorsLabel, languageLabel } from '../lib/labels';
import type { LibraryItem } from '../lib/types';
import FilterableCell from './FilterableCell';

interface ItemRowProps {
  item: LibraryItem;
  /** When true, render the cover thumb on the left and lay the
   *  meta row underneath the title (two-line layout). When false,
   *  collapse to a single dense row with title + author on the
   *  left and the meta cells aligned right. */
  showCover: boolean;
}

/**
 * One row of the list-mode catalogue (`list-plain` and `list-cover`).
 * Displays title + author + publisher + language + year ; the four
 * meta cells are clickable filter triggers via `FilterableCell`.
 *
 * Cover lookup, action callbacks, and the cell-filter setter all
 * come from the Library contexts — the caller only passes the
 * item itself and the layout variant.
 *
 * Wrapped in `React.memo` so search-input keystrokes / filter
 * changes on the parent only re-render the rows whose `item`
 * reference moved. The context-driven cover stream still
 * propagates (memo is bypassed on context churn), so a freshly
 * loaded cover still appears on the right row.
 */
function ItemRowImpl({ item, showCover }: ItemRowProps) {
  const { t } = useI18n();
  const { covers } = useLibraryData();
  const { editItem, deleteItem, toggleFavorite } = useLibraryActions();

  const cover =
    showCover && item.coverRid ? covers.get(item.coverRid) ?? null : null;
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
        className="max-w-40 truncate"
      />
      <span aria-hidden="true">·</span>
      <FilterableCell
        field="publisher"
        value={publisher}
        className="max-w-32 truncate"
      />
      <span aria-hidden="true">·</span>
      <FilterableCell
        field="language"
        value={langCode}
        display={languageLabel(item.language, t)}
      />
      <span aria-hidden="true">·</span>
      <FilterableCell field="year" value={yearStr} className="tabular-nums" />
    </>
  );

  return (
    <article className="group block border-b border-hair last:border-b-0">
      <div
        className={cn('flex gap-3 py-2', showCover ? 'items-center' : 'items-baseline')}
      >
        {showCover ? (
          cover ? (
            <img
              src={cover}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
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
              onClick={() => editItem(item)}
              className="block w-full cursor-pointer truncate text-left text-[14px] font-medium text-ink transition-colors hover:text-accent"
              title={t('library.row.editTitle')}
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
                onClick={() => editItem(item)}
                className="cursor-pointer truncate text-left text-[14px] font-medium text-ink transition-colors hover:text-accent"
                title={t('library.row.editTitle')}
              >
                {item.title}
              </button>
              {author ? (
                <FilterableCell
                  field="author"
                  value={author}
                  className="max-w-48 truncate text-[12px] text-muted"
                />
              ) : null}
            </div>
            <div className="hidden shrink-0 items-baseline gap-2 text-[12px] text-muted sm:flex">
              <FilterableCell
                field="publisher"
                value={publisher}
                className="max-w-32 truncate"
              />
              <span aria-hidden="true">·</span>
              <FilterableCell
                field="language"
                value={langCode}
                display={languageLabel(item.language, t)}
              />
              <span aria-hidden="true">·</span>
              <FilterableCell
                field="year"
                value={yearStr}
                className="tabular-nums"
              />
            </div>
          </>
        )}

        <div className="flex shrink-0 items-center gap-0.5">
          <FavoriteToggle
            isFavorite={item.isFavorite}
            onToggle={() => toggleFavorite(item)}
            size="md"
          />
          <DirkButton
            variant="danger-ghost"
            size="sm"
            iconOnly
            onClick={() => deleteItem(item)}
            aria-label={t('library.row.delete')}
            title={t('common.actions.delete')}
            className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
          >
            <TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </DirkButton>
        </div>
      </div>
    </article>
  );
}

const ItemRow = memo(ItemRowImpl);
export default ItemRow;
