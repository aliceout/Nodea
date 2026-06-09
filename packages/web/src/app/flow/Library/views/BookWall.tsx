import { TrashIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';

import { useI18n } from '@/i18n/I18nProvider.jsx';

import { useLibraryActions, useLibraryData } from '../context';
import type { LibraryItem } from '../lib/types';

interface BookWallProps {
  items: LibraryItem[];
}

/**
 * Cover-only wall view — densest of the catalogue layouts. Flattens
 * the status grouping (a wall fragmented into N section headers
 * would break the visual rhythm). Title appears as a hover overlay
 * for cover-only tiles ; books without a cover render the title
 * inline so the wall stays scannable.
 */
export default function BookWall({ items }: BookWallProps) {
  const { t } = useI18n();
  const { covers } = useLibraryData();
  const { editItem, deleteItem } = useLibraryActions();

  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8">
      {items.map((it) => {
        const cover = it.coverRid ? covers.get(it.coverRid) ?? null : null;
        const author = it.creators?.[0]?.name ?? '';
        return (
          // `content-visibility:auto` lets the browser skip layout +
          // paint for offscreen tiles — the wall isn't virtualised,
          // so at 300+ books this is what keeps the initial render
          // and the search-filter re-renders cheap (audit 2026-06).
          // `contain-intrinsic-size` reserves an approximate slot so
          // the scrollbar doesn't jump.
          <li
            key={it.id}
            className="group relative min-w-0 [contain-intrinsic-size:auto_220px] [content-visibility:auto]"
          >
            <button
              type="button"
              onClick={() => editItem(it)}
              aria-label={`${it.title}${author ? ` — ${author}` : ''}`}
              title={`${it.title}${author ? ` — ${author}` : ''}`}
              className="relative block w-full cursor-pointer overflow-hidden rounded-sm border border-hair bg-bg-2 transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] focus-visible:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus-visible:outline-none"
            >
              {cover ? (
                <img
                  src={cover}
                  alt={author ? `${it.title} — ${author}` : it.title}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[2/3] w-full object-cover"
                />
              ) : (
                // No cover : render a tile that still carries the
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
              {/* Hover overlay reveals the title for cover-only
                  tiles — the wall view trades textual density for
                  visual density, but a name on hover is the bare
                  minimum to not be an unsearchable blob. */}
              <span className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-ink/85 to-ink/0 px-1.5 py-1 text-[10px] leading-[1.2] text-white opacity-0 transition-[opacity,transform] duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
                <span className="block truncate font-medium">{it.title}</span>
                {author ? (
                  <span className="block truncate opacity-80">{author}</span>
                ) : null}
              </span>
              {it.isFavorite ? (
                <span
                  className="absolute top-1 left-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-bg/85 text-accent"
                  aria-label={t('library.row.favorite')}
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
              onClick={() => deleteItem(it)}
              aria-label={t('library.row.delete')}
              title={t('common.actions.delete')}
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
