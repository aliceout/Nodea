/**
 * Factory for the LibraryItem composer's `applyResult` callback —
 * wires a picked `NormalisedBook` into the form's setters.
 *
 * Extracted from `LibraryItem.tsx` (REFACTO-04 follow-up) — purely
 * mechanical splash of setters, but it was 30 LOC of
 * `if (book.x) setX(book.x)` cluttering the component. Pulling it
 * out keeps the parent focused on hook/render orchestration.
 *
 * The factory takes every setter the function needs as a dep, plus
 * the current `searchMode` (read at call time via the deps object,
 * so flipping the mode dropdown takes effect without re-creating
 * the callback).
 *
 * Two branches :
 *   - `cover-only` → pull just the cover URL, leave every other
 *     field as the user typed it. Useful when the existing metadata
 *     is fine but the user wants a different cover.
 *   - default     → overwrite the whole form (title, author, year,
 *     publisher, collection, summary, series, format, ISBN, cover).
 *     Always closes the result panel and clears the search input.
 */
import type {
  LibraryFormat,
  NormalisedBook,
} from '@nodea/shared';

export interface MakeApplyResultDeps {
  /** Read at call time — flipping the dropdown takes effect without
   *  re-instantiating the callback. */
  getSearchMode: () => 'all' | 'cover-only';
  setTitle: (next: string) => void;
  setAuthor: (next: string) => void;
  setYear: (next: string) => void;
  setPublisher: (next: string) => void;
  setCollection: (next: string) => void;
  setSummary: (next: string) => void;
  setSeriesName: (next: string) => void;
  setSeriesPosition: (next: string) => void;
  setFormat: (next: LibraryFormat) => void;
  setIsbn: (next: string) => void;
  setCoverUrl: (next: string | null) => void;
  setCoverLoadFailed: (next: boolean) => void;
  lookup: {
    dismiss: () => void;
    setInput: (next: string) => void;
  };
}

export function makeApplyResult(
  deps: MakeApplyResultDeps,
): (book: NormalisedBook) => void {
  return function applyResult(book: NormalisedBook): void {
    if (deps.getSearchMode() === 'cover-only') {
      // Pull only the cover URL — every other field stays as the
      // user typed it. Useful when the existing metadata is fine
      // but the user wants a different cover (or the seed didn't
      // come with one).
      deps.setCoverUrl(book.coverUrl);
      deps.setCoverLoadFailed(false);
      deps.lookup.dismiss();
      // Keep the search input in cover-only mode so the user can
      // browse another result without re-typing.
      return;
    }
    deps.setTitle(book.title);
    if (book.creators[0]?.name) deps.setAuthor(book.creators[0].name);
    if (book.year) deps.setYear(String(book.year));
    if (book.publisher) deps.setPublisher(book.publisher);
    if (book.collection) deps.setCollection(book.collection);
    if (book.summary) deps.setSummary(book.summary);
    if (book.series) {
      deps.setSeriesName(book.series.name);
      if (book.series.position)
        deps.setSeriesPosition(String(book.series.position));
    }
    if (book.format) deps.setFormat(book.format);
    if (book.isbn13) deps.setIsbn(book.isbn13);
    else if (book.isbn10) deps.setIsbn(book.isbn10);
    deps.setCoverUrl(book.coverUrl);
    deps.setCoverLoadFailed(false);
    deps.lookup.dismiss();
    deps.lookup.setInput('');
  };
}
