import { StarIcon, TrashIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import type { LibraryStatus } from '@nodea/shared';

import DirkButton from '@/ui/atoms/dirk/Button';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';

import { useLibraryActions, useLibraryData } from '../context';
import type { LibraryItem } from '../lib/types';

interface BookGridProps {
  items: LibraryItem[];
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

/**
 * Cards-with-cover catalogue view. 2 columns on mobile, scaling up
 * to 5 on xl. Status pills overlay the cover top-left ; favorite
 * star top-right when set ; delete + favorite-toggle hover-revealed
 * below the title. Cover, actions read from contexts ; only the
 * (already filtered + flattened) `items` list is passed in.
 */
export default function BookGrid({ items }: BookGridProps) {
  const { t } = useI18n();
  const { covers } = useLibraryData();
  const { editItem, deleteItem, toggleFavorite } = useLibraryActions();

  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
      {items.map((it) => {
        const cover = it.coverRid ? covers.get(it.coverRid) ?? null : null;
        const author = it.creators?.[0]?.name ?? '';
        const yearLabel = it.year ? String(it.year) : '';
        return (
          // Offscreen tiles skip layout + paint — see BookWall for
          // the rationale (audit 2026-06).
          <li
            key={it.id}
            className="group flex min-w-0 flex-col [contain-intrinsic-size:auto_280px] [content-visibility:auto]"
          >
            <button
              type="button"
              onClick={() => editItem(it)}
              aria-label={t('library.row.open', { values: { title: it.title } })}
              className="relative block w-full cursor-pointer overflow-hidden rounded-sm border border-hair bg-bg-2 transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
            >
              {cover ? (
                <img
                  src={cover}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  decoding="async"
                  className="aspect-[2/3] w-full object-cover"
                />
              ) : (
                <div
                  className="flex aspect-[2/3] w-full items-center justify-center bg-bg-2 px-2 text-center text-[11px] italic text-muted-soft"
                  aria-hidden="true"
                >
                  {t('library.row.noCover')}
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
                {t(`library.statusGroup.${it.status}`)}
              </span>
              {it.isFavorite ? (
                <span
                  className="absolute top-1.5 right-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-bg/80 text-accent shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                  aria-label={t('library.row.favorite')}
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
                  onClick={() => toggleFavorite(it)}
                  aria-label={
                    it.isFavorite
                      ? t('library.row.favoriteRemove')
                      : t('library.row.favoriteAdd')
                  }
                  title={
                    it.isFavorite
                      ? t('library.row.favoriteRemove')
                      : t('library.row.favoriteAdd')
                  }
                  className={cn(
                    'inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-sm transition-colors',
                    it.isFavorite
                      ? 'text-accent hover:bg-accent-soft'
                      : 'text-muted opacity-0 hover:bg-bg-2 hover:text-ink group-hover:opacity-100 group-focus-within:opacity-100',
                  )}
                >
                  {it.isFavorite ? (
                    <StarSolidIcon className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <StarIcon className="h-3 w-3" aria-hidden="true" />
                  )}
                </button>
                <DirkButton
                  variant="danger-ghost"
                  size="xs"
                  iconOnly
                  onClick={() => deleteItem(it)}
                  aria-label={t('library.row.delete')}
                  title={t('common.actions.delete')}
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
