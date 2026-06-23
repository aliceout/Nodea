import {
  useNodeaStore,
  selectLibrarySubview,
} from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { useRefocusTrigger } from '@/lib/use-refocus-trigger';
import DirkButton from '@/ui/atoms/dirk/Button';
import ModuleShell from '@/ui/dirk/module/ModuleShell';
import SpeedDial from '@/ui/dirk/SpeedDial';
import Topbar from '@/ui/dirk/Topbar';
import TopbarSearch from '@/ui/dirk/TopbarSearch';

import BookPickerModal from './components/BookPickerModal';
import MobileFilters from './components/MobileFilters';
import SideColumn from './components/SideColumn';
import {
  LibraryProvider,
  useLibraryActions,
  useLibraryData,
  useLibraryFilters,
} from './context';
import PrimaryColumn from './views/PrimaryColumn';
import ReviewsList from './views/ReviewsList';

/**
 * Library — Direction K · Sauge.
 *
 * Books-only personal library. Items live in `library_items_entries`,
 * notes / extracts in `library_reviews_entries`, covers (encrypted
 * blobs) in `library_covers_entries` ; all three are loaded and
 * decrypted at mount and joined client-side via `review.itemRid →
 * item.id`.
 *
 * The catalogue exposes three lenses on the same data — the books
 * themselves (`livres`), the highlighted extracts (`extraits` =
 * reviews with `kind = 'quote'`), and the freeform notes (`notes` =
 * `kind = 'note'`). The active lens lives in the global flow slice
 * (the `/flow` URL stays frozen, so the active sub-page never leaks
 * to the server).
 *
 * Architecture :
 *   - `<LibraryProvider>` (`./context.tsx`) owns the page-local
 *     state — decrypted records, filters, actions.
 *   - Three hooks (`useLibraryData`, `useLibraryFilters`,
 *     `useLibraryActions`) expose the slices ; consumers re-render
 *     only on the slice they read.
 *   - Sub-components in `components/` (sidebar, picker, view-mode
 *     toggle) and `views/` (the four catalogue layouts + reviews
 *     list) consume the contexts directly — no prop drilling.
 *   - Pure helpers in `lib/` (mappers, grouping, search, date
 *     format, cell filter, labels) carry the Vitest coverage.
 */
export default function LibraryPage() {
  return (
    <LibraryProvider>
      <LibraryView />
    </LibraryProvider>
  );
}

/** Top-level rendering surface. Picks the catalogue (livres) vs the
 *  reviews flat list based on the active sub-view, mounts the
 *  shared chrome (topbar / sidebar) and the always-rendered (self-
 *  conditional) book picker. */
function LibraryView() {
  const { t } = useI18n();
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const subview = useNodeaStore(selectLibrarySubview);
  const { items } = useLibraryData();
  const { searchQuery, setSearchQuery } = useLibraryFilters();
  const { addItem, openReviewPicker, itemForm, reviewForm } =
    useLibraryActions();
  // Focus restore (audit 2026-06, lot G) : Library's topbar CTA
  // stays mounted while its inline form is open, but closing the
  // form still drops focus on <body>. Only one of the two CTAs
  // renders at a time (subview branch), so they share the ref.
  const newCtaRef = useRefocusTrigger(itemForm !== null || reviewForm !== null);

  const searchProps = {
    value: searchQuery,
    onChange: setSearchQuery,
    placeholder: t('library.topbar.searchPlaceholder'),
    clearLabel: t('common.search.clearAria'),
  };

  return (
    <>
      <ModuleShell
        topbar={
          <Topbar
            label={t('library.title')}
            onOpenMenu={() => setMobileMenuOpen(true)}
            search={
              subview === 'livres' ? (
                <TopbarSearch
                  {...searchProps}
                  openLabel={t('common.search.openAria')}
                  closeLabel={t('common.search.closeAria')}
                  className="max-w-[35rem]"
                />
              ) : undefined
            }
          >
            {subview === 'livres' ? (
              <>
                <DirkButton
                  ref={newCtaRef}
                  variant="primary"
                  size="sm"
                  onClick={addItem}
                  className="hidden lg:inline-flex"
                >
                  {t('library.topbar.newBook')}
                </DirkButton>
              </>
            ) : (
              <DirkButton
                ref={newCtaRef}
                variant="primary"
                size="sm"
                onClick={() =>
                  openReviewPicker(subview === 'extraits' ? 'quote' : 'note')
                }
                disabled={items.length === 0}
                className="hidden lg:inline-flex"
                {...(items.length === 0
                  ? { title: t('library.topbar.addBookFirst') }
                  : {})}
              >
                {subview === 'extraits'
                  ? t('library.topbar.newQuote')
                  : t('library.topbar.newNote')}
              </DirkButton>
            )}
          </Topbar>
        }
        fab={
          // Mobile speed-dial — mirrors the subview-dependent topbar CTA.
          subview === 'livres' ? (
            <SpeedDial
              addLabel={t('common.actions.add')}
              closeLabel={t('common.actions.close')}
              hidden={itemForm !== null}
              actions={[{ label: t('library.topbar.newBook'), onClick: addItem }]}
            />
          ) : (
            <SpeedDial
              addLabel={t('common.actions.add')}
              closeLabel={t('common.actions.close')}
              hidden={reviewForm !== null}
              actions={[
                {
                  label:
                    subview === 'extraits'
                      ? t('library.topbar.newQuote')
                      : t('library.topbar.newNote'),
                  onClick: () =>
                    openReviewPicker(subview === 'extraits' ? 'quote' : 'note'),
                  disabled: items.length === 0,
                },
              ]}
            />
          )
        }
        side={<SideColumn />}
      >
        {/* One grid cell wraps the mobile filters toggle + the subview
            content so no `gap-9` sits between them — MobileFilters owns
            that spacing itself (see its margins). On desktop
            MobileFilters is hidden, so this cell is just the 1fr
            content column. */}
        <div className="min-w-0">
          {/* Mobile-only filters collapse — first thing below the
              topbar ; renders nothing at `lg+` where the sidebar
              (`SideColumn`) takes over. Shared across subviews
              (livres / extraits / notes). */}
          <MobileFilters />
          {subview === 'livres' ? (
            <PrimaryColumn />
          ) : (
            <ReviewsList kind={subview === 'extraits' ? 'quote' : 'note'} />
          )}
        </div>
      </ModuleShell>
      <BookPickerModal />
    </>
  );
}
