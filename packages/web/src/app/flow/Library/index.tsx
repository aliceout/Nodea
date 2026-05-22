import {
  useNodeaStore,
  selectLibrarySubview,
} from '@/core/store/nodea-store';
import DirkButton from '@/ui/atoms/dirk/Button';
import ModuleShell from '@/ui/dirk/module/ModuleShell';
import Topbar from '@/ui/dirk/Topbar';
import TopbarSearchInput from '@/ui/dirk/TopbarSearchInput';

import BookPickerModal from './components/BookPickerModal';
import MobileFilters from './components/MobileFilters';
import SideColumn from './components/SideColumn';
import ViewModeToggle from './components/ViewModeToggle';
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
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const subview = useNodeaStore(selectLibrarySubview);
  const { items } = useLibraryData();
  const { searchQuery, setSearchQuery } = useLibraryFilters();
  const { addItem, openReviewPicker } = useLibraryActions();

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
                <TopbarSearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Rechercher dans Library…"
                  clearLabel="Effacer la recherche"
                  className="w-44 md:w-56"
                />
                {/* The 5 view-mode toggles are a desktop affordance —
                    on a phone the layout is a single column anyway,
                    so the choice between list/grid/wall is moot, and
                    keeping the pill in the topbar pushes the CTA off
                    the edge. `md:contents` keeps it as a regular
                    flex item at md+, hides it entirely below. */}
                <div className="hidden md:contents">
                  <ViewModeToggle />
                </div>
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
        {/* Mobile-only filters collapse — sits at the top of the
            children flow (above the subview content) so it's the
            first thing the user sees below the topbar. Folded by
            default ; renders nothing at `lg+` because the right
            sidebar (`SideColumn`) takes over. Shared across both
            subviews (livres / extraits / notes) because the
            status filter applies to all. */}
        <MobileFilters />
        {subview === 'livres' ? (
          <PrimaryColumn />
        ) : (
          <ReviewsList kind={subview === 'extraits' ? 'quote' : 'note'} />
        )}
      </ModuleShell>
      <BookPickerModal />
    </>
  );
}
