import { useI18n } from '@/i18n/I18nProvider.jsx';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import EmptyHint from '@/ui/dirk/module/EmptyHint';
import PageHeading from '@/ui/dirk/module/PageHeading';
import GroupedVirtualList from '@/ui/atoms/layout/GroupedVirtualList';

import LibraryItemForm from '../components/LibraryItemForm';
import { useLibraryActions, useLibraryData, useLibraryFilters } from '../context';
import BookGrid from './BookGrid';
import BookTable from './BookTable';
import BookWall from './BookWall';
import ItemRow from './ItemRow';

/**
 * Catalogue rendering surface for the `livres` sub-view. Picks the
 * concrete view (`BookList` (inline) / `BookGrid` / `BookWall` /
 * `BookTable`) based on the active `viewMode`, renders the load /
 * empty / error states, and shows the « cell filter » banner with
 * a dismiss button when one is active.
 *
 * No props — everything comes from the data + filters contexts.
 */
export default function PrimaryColumn() {
  const { t } = useI18n();
  const { items, load } = useLibraryData();
  const { viewMode, cellFilter, filteredItems, groups, setCellFilter } =
    useLibraryFilters();
  const { itemForm, closeItemForm } = useLibraryActions();

  const total = items.length;
  const filteredCount = filteredItems.length;
  const isListMode = viewMode === 'list-plain' || viewMode === 'list-cover';

  // Flat list for the gallery views — they ignore the grouping
  // (a wall of covers fragmented into N section headers would break
  // the visual rhythm). The status is still surfaced as a small
  // pill on each card so the user can tell « in progress » apart
  // from « finished » at a glance.
  const flatItems = filteredItems;

  return (
    <section className="flex min-w-0 flex-col">
      {/* lg+ only — on mobile the topbar carries the module name. */}
      <PageHeading className="hidden lg:block">{t('library.title')}</PageHeading>

      {/* Inline book form — surfaced above the catalogue when the
          topbar « + Nouveau livre » CTA (create) or a row's edit
          affordance (edit) flips `itemForm` on the actions context.
          Keyed on the editing target's id so flipping between two
          edit targets remounts the form with the right initial
          values + a clean LookupBar. Same posture as Mood / Goals
          / Journal. */}
      {itemForm ? (
        <div className="mb-2">
          <LibraryItemForm
            key={itemForm.mode === 'edit' ? itemForm.item.id : 'create'}
            {...(itemForm.mode === 'edit' ? { initial: itemForm.item } : {})}
            onClose={closeItemForm}
          />
        </div>
      ) : null}

      {load.status === 'error' ? (
        <InlineAlert className="mb-4">{load.message}</InlineAlert>
      ) : null}

      {cellFilter ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px] text-ink-soft">
          <span className="text-muted">{t('library.list.filterBanner')}</span>
          <span className="inline-flex items-center gap-1.5 rounded-sm border border-accent bg-accent-soft/40 px-2 py-0.5 text-accent-deep">
            <span>
              <span className="font-semibold">
                {t(`library.fields.${cellFilter.field}`)}
              </span>{' '}
              · {cellFilter.value}
            </span>
            <button
              type="button"
              onClick={() => setCellFilter(null)}
              aria-label={t('library.list.clearFilterAria')}
              className="cursor-pointer text-accent-deep transition-colors hover:text-ink"
            >
              ✕
            </button>
          </span>
        </div>
      ) : null}

      <div>
        {load.status === 'loading' && total === 0 ? (
          <EmptyHint>{t('library.list.loading')}</EmptyHint>
        ) : filteredCount === 0 ? (
          <EmptyHint>
            {total === 0
              ? t('library.list.emptyCatalogue')
              : t('library.list.emptySelection')}
          </EmptyHint>
        ) : isListMode ? (
          <GroupedVirtualList
            groups={groups
              .filter((g) => g.items.length > 0)
              .map((g) => [g.label, g.items] as const)}
            getItemKey={(it) => it.id}
            renderItem={(it) => (
              <ItemRow item={it} showCover={viewMode === 'list-cover'} />
            )}
            variant="subtitle"
            estimateRowHeight={viewMode === 'list-cover' ? 60 : 44}
          />
        ) : viewMode === 'table' ? (
          <BookTable items={flatItems} />
        ) : viewMode === 'grid' ? (
          <BookGrid items={flatItems} />
        ) : (
          <BookWall items={flatItems} />
        )}
      </div>
    </section>
  );
}
