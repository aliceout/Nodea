import { useMemo, useState } from 'react';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import { normalizeForSearch } from '@/lib/text-search';
import DirkButton from '@/ui/atoms/dirk/Button';
import DirkInput from '@/ui/atoms/dirk/Input';
import { Modal } from '@/ui/atoms/layout/Modal';

import { useLibraryActions, useLibraryData } from '../context';

/**
 * Picker shown after the user clicks « + Nouvel extrait » /
 * « + Nouvelle note ». A review is constrained to belong to a
 * specific book (`itemRid`), so we ask which one before opening
 * the actual composer.
 *
 * UX : a small dialog with an autofocused search input and a
 * filtered list. Matches on title and first author, case- and
 * diacritic-insensitive (folk knowledge : « ernaux » should match
 * « Annie ERNAUX »). Clicking a row routes to the existing review
 * composer with the right kind + itemRid baked in. Esc / backdrop
 * click closes.
 *
 * Self-conditional : returns `null` when the picker isn't open, so
 * the caller can mount this unconditionally without a ternary.
 */
export default function BookPickerModal() {
  const { t } = useI18n();
  const { items, covers } = useLibraryData();
  const { reviewPicker, closeReviewPicker, pickBookForReview } =
    useLibraryActions();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = normalizeForSearch(query.trim());
    const sorted = [...items].sort((a, b) =>
      a.title.localeCompare(b.title, 'fr'),
    );
    if (!q) return sorted;
    return sorted.filter((it) => {
      const haystack = normalizeForSearch(
        `${it.title} ${it.creators?.[0]?.name ?? ''}`,
      );
      return haystack.includes(q);
    });
  }, [items, query]);

  if (!reviewPicker.open) return null;

  const { kind } = reviewPicker;
  const heading =
    kind === 'quote'
      ? t('library.picker.headingQuote')
      : t('library.picker.headingNote');

  // Same fixed body height as the Composer modals — `h-[600px]`
  // capped at `100vh-200px` for short viewports. The shell
  // (backdrop, panel border, animation) comes from the shared
  // `<Modal>` atom, the layout below is what's specific to the
  // picker.
  return (
    <Modal open onClose={closeReviewPicker}>
      <div className="flex h-[600px] max-h-[calc(100vh-200px)] flex-col">
        <div className="border-b border-hair px-[22px] pt-3.5 pb-3">
          <h2 className="text-[14px] font-semibold tracking-[-0.005em] text-ink">
            {heading}
          </h2>
          <p className="mt-0.5 text-[12px] text-muted">
            {kind === 'quote'
              ? t('library.picker.subtitleQuote')
              : t('library.picker.subtitleNote')}
          </p>
        </div>
        <div className="px-[22px] pt-3">
          <DirkInput
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeReviewPicker();
              if (e.key === 'Enter' && filtered[0]) {
                e.preventDefault();
                pickBookForReview(filtered[0].id, kind);
              }
            }}
            placeholder={t('library.picker.searchPlaceholder')}
          />
        </div>
        <ul className="min-h-0 flex-1 overflow-auto px-2 py-2">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-[12px] italic text-muted">
              {items.length === 0
                ? t('library.picker.emptyLibrary')
                : t('library.picker.emptySearch')}
            </li>
          ) : (
            filtered.map((it) => {
              const cover = it.coverRid
                ? covers.get(it.coverRid) ?? null
                : null;
              const author = it.creators?.[0]?.name ?? '—';
              const yearLabel = it.year ? String(it.year) : '';
              return (
                <li key={it.id}>
                  <button
                    type="button"
                    onClick={() => pickBookForReview(it.id, kind)}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-left transition-colors hover:bg-bg-2"
                  >
                    {cover ? (
                      <img
                        src={cover}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        decoding="async"
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
          <DirkButton variant="secondary" onClick={closeReviewPicker}>
            {t('common.actions.cancel')}
          </DirkButton>
        </div>
      </div>
    </Modal>
  );
}
