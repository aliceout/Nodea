import { useMemo } from 'react';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { LibraryReviewPayload } from '@nodea/shared';

import DirkButton from '@/ui/atoms/dirk/Button';
import { formatLongDate } from '@/core/i18n/date-format';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { JournalContent } from '@/lib/journal-markdown';
import { cn } from '@/lib/utils';
import EmptyHint from '@/ui/dirk/module/EmptyHint';
import PageHeading from '@/ui/dirk/module/PageHeading';

import { useLibraryActions, useLibraryData } from '../context';
import type { LibraryItem, LibraryReview } from '../lib/types';

interface ReviewsListProps {
  /** Lens — `'quote'` for the Extraits sub-view, `'note'` for
   *  Notes. The Library page derives this from the active sub-view
   *  in the global store. */
  kind: LibraryReviewPayload['kind'];
}

const REVIEW_VIEW_HEADING: Record<LibraryReviewPayload['kind'], string> = {
  quote: 'Extraits',
  note: 'Notes',
};

const REVIEW_VIEW_EMPTY: Record<LibraryReviewPayload['kind'], string> = {
  quote: 'Aucun extrait pour le moment — ouvre un livre et ajoute-en un.',
  note: 'Aucune note pour le moment — ouvre un livre et ajoute-en une.',
};

/**
 * Flat list of reviews for the Extraits / Notes sub-views. Reviews
 * are filtered by `kind` and sorted newest-first ; each row pulls
 * its parent book from `items` for the inline title + author.
 *
 * Reads `items` / `reviews` / `load` from `useLibraryData()` and the
 * `editReview` / `deleteReview` actions from `useLibraryActions()`.
 */
export default function ReviewsList({ kind }: ReviewsListProps) {
  const { items, reviews, load } = useLibraryData();
  const { editReview, deleteReview } = useLibraryActions();

  // Build a quick lookup so each review row can show its book's
  // title / author without having to re-scan `items` linearly. The
  // reviews collection has `itemRid` pointing to the item id.
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
              book={itemsById.get(r.itemRid) ?? null}
              onEdit={() => editReview(r)}
              onDelete={() => deleteReview(r)}
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
   *  under the review (orphan — should be rare but we render
   *  defensively). */
  book: LibraryItem | null;
  onEdit: () => void;
  onDelete: () => void;
}

function FlatReviewRow({ review, book, onEdit, onDelete }: FlatReviewRowProps) {
  const { language } = useI18n();
  const dateLabel = formatLongDate(review.date, language);
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
