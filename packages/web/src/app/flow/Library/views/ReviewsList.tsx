import { memo, useMemo } from 'react';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { LibraryReviewPayload } from '@nodea/shared';

import DirkButton from '@/ui/atoms/dirk/Button';
import { formatLongDate } from '@/core/i18n/date-format';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { LiteMarkdown } from '@/lib/lite-markdown';
import { cn } from '@/lib/utils';
import EmptyHint from '@/ui/dirk/module/EmptyHint';
import PageHeading from '@/ui/dirk/module/PageHeading';
import VirtualWindowList from '@/ui/atoms/layout/VirtualWindowList';

import LibraryReviewForm from '../components/LibraryReviewForm';
import { useLibraryActions, useLibraryData } from '../context';
import type { LibraryItem, LibraryReview } from '../lib/types';

interface ReviewsListProps {
  /** Lens — `'quote'` for the Extraits sub-view, `'note'` for
   *  Notes. The Library page derives this from the active sub-view
   *  in the global store. */
  kind: LibraryReviewPayload['kind'];
}

/**
 * Flat list of reviews for the Extraits / Notes sub-views. Reviews
 * are filtered by `kind` and sorted newest-first ; each row pulls
 * its parent book from `items` for the inline title + author.
 *
 * Reads `items` / `reviews` / `load` from `useLibraryData()` and the
 * `editReview` / `deleteReview` actions from `useLibraryActions()`.
 */
export default function ReviewsList({ kind }: ReviewsListProps) {
  const { t } = useI18n();
  const { items, reviews, load } = useLibraryData();
  const { editReview, deleteReview, reviewForm, closeReviewForm } =
    useLibraryActions();

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

  const heading = t(`library.reviews.heading.${kind}`);

  // Resolve the parent book so the form can display its title +
  // author. Create flow : the picker's chosen book. Edit flow : the
  // book the review already points at.
  const formItemRid =
    reviewForm?.mode === 'create'
      ? reviewForm.itemRid
      : reviewForm?.mode === 'edit'
        ? reviewForm.review.itemRid
        : null;
  const formParentBook = formItemRid ? itemsById.get(formItemRid) : undefined;

  return (
    <section className="flex min-w-0 flex-col">
      <PageHeading>{heading}</PageHeading>

      {/* Inline review form — surfaced above the list when the
          actions context flips `reviewForm` (picker → create, or
          row's edit affordance → edit). Keyed on the review id (edit)
          or on `{itemRid}-{kind}` (create) so switching targets
          remounts with the right initial values. Same posture as
          Mood / Goals / Journal / LibraryItem. */}
      {reviewForm ? (
        <div className="mb-2">
          <LibraryReviewForm
            key={
              reviewForm.mode === 'edit'
                ? reviewForm.review.id
                : `create-${reviewForm.itemRid}-${reviewForm.kind}`
            }
            {...(reviewForm.mode === 'edit'
              ? { initial: reviewForm.review }
              : { create: { itemRid: reviewForm.itemRid, kind: reviewForm.kind } })}
            parentItem={formParentBook}
            onClose={closeReviewForm}
          />
        </div>
      ) : null}

      {load.status === 'error' ? (
        <p
          role="alert"
          className="mb-4 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[12px] text-danger"
        >
          {load.message}
        </p>
      ) : null}

      {load.status === 'loading' ? (
        <EmptyHint>{t('common.states.loading')}</EmptyHint>
      ) : filtered.length === 0 ? (
        <EmptyHint>{t(`library.reviews.empty.${kind}`)}</EmptyHint>
      ) : (
        // Virtualized (audit 2026-06 passe 2) : was a flat <ul> that
        // mounted + LiteMarkdown-parsed EVERY review. `editReview` /
        // `deleteReview` are stable `useCallback`s and the row is
        // `memo`'d + takes them directly (no inline closures), so a
        // covers-stream or favorite-toggle no longer re-parses every
        // review's markdown.
        <VirtualWindowList
          items={filtered}
          estimateRowHeight={120}
          getKey={(r) => r.id}
          renderItem={(r) => (
            <FlatReviewRow
              review={r}
              book={itemsById.get(r.itemRid) ?? null}
              onEdit={editReview}
              onDelete={deleteReview}
            />
          )}
        />
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
  onEdit: (review: LibraryReview) => void;
  onDelete: (review: LibraryReview) => void;
}

const FlatReviewRow = memo(function FlatReviewRow({
  review,
  book,
  onEdit,
  onDelete,
}: FlatReviewRowProps) {
  const { language, t } = useI18n();
  const dateLabel = formatLongDate(review.date, language);
  const accent = review.kind === 'quote';
  const bookTitle = book?.title ?? t('library.reviews.deletedBook');
  const bookAuthor = book?.creators?.[0]?.name ?? '';
  return (
    <div className="group border-b border-hair py-2.5 first:pt-0">
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
            <span className="tabular-nums">
              {t('library.reviews.page', { values: { page: review.page } })}
            </span>
          ) : null}
          <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <DirkButton
              variant="ghost"
              size="xs"
              iconOnly
              onClick={() => onEdit(review)}
              aria-label={t('common.actions.edit')}
              title={t('common.actions.edit')}
            >
              <PencilSquareIcon className="h-3 w-3" aria-hidden="true" />
            </DirkButton>
            <DirkButton
              variant="danger-ghost"
              size="xs"
              iconOnly
              onClick={() => onDelete(review)}
              aria-label={t('common.actions.delete')}
              title={t('common.actions.delete')}
            >
              <TrashIcon className="h-3 w-3" aria-hidden="true" />
            </DirkButton>
          </span>
        </span>
      </div>
      <div className={cn(accent ? 'border-l-2 border-accent-soft pl-3 italic' : '')}>
        <LiteMarkdown text={review.content} />
      </div>
    </div>
  );
});
