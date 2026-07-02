import type { NormalisedBook } from '@nodea/shared';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import { FOCUS_RING } from '@/lib/utils';

interface CoverGridProps {
  results: NormalisedBook[];
  onPick: (book: NormalisedBook) => void;
}

/**
 * Cover-only result grid : when the user is on the « Couverture
 * seule » mode, metadata is irrelevant — the only signal that
 * matters is the cover thumbnail. Render a tile grid sized to
 * roughly four columns at modal width, dropping any result
 * whose provider didn't return a `coverUrl` (Wikidata /
 * Google Books sometimes do, Open Library always does when
 * the work is indexed). Falls back to a hint when no result
 * has a cover at all so the user isn't staring at an empty
 * box.
 */
export default function CoverGrid({
  results,
  onPick,
}: CoverGridProps): React.ReactElement {
  const { t } = useI18n();
  const withCover = results.filter((b) => b.coverUrl);
  if (withCover.length === 0) {
    return (
      <div className="mt-2 flex min-h-0 flex-1 items-center justify-center rounded-sm border border-hair bg-bg p-6 text-center text-[12px] text-muted">
        {t('library.lookup.noCoverResults')}
      </div>
    );
  }
  return (
    <div className="mt-2 max-h-[60vh] min-h-0 flex-1 overflow-auto rounded-sm border border-hair bg-bg p-2">
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2">
        {withCover.map((book, i) => (
          <li key={`${book.source}-${book.title}-${i}`}>
            <button
              type="button"
              onClick={() => onPick(book)}
              title={book.title}
              className={`group flex w-full cursor-pointer flex-col gap-1 rounded-sm p-1 text-left transition-colors hover:bg-bg-2 ${FOCUS_RING}`}
            >
              <span className="block aspect-[2/3] w-full overflow-hidden rounded-sm border border-hair bg-bg-2">
                <img
                  src={book.coverUrl ?? ''}
                  alt={
                    book.creators[0]?.name
                      ? `${book.title} — ${book.creators[0].name}`
                      : book.title
                  }
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-[1.02]"
                />
              </span>
              <span className="line-clamp-2 text-[11px] text-ink">
                {book.title}
              </span>
              {book.creators[0]?.name ? (
                <span className="line-clamp-1 text-[10.5px] text-muted">
                  {book.creators[0].name}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
