import type { NormalisedBook } from '@nodea/shared';
import type { ProviderAdapter, ProviderName } from './types.ts';

/**
 * Walk a `Promise.allSettled` result list back to per-provider books.
 * Failed providers are logged server-side and skipped — one broken
 * provider never takes down the whole lookup, the client never knows.
 */
export function collectResults(
  adapters: readonly ProviderAdapter[],
  settled: PromiseSettledResult<NormalisedBook[]>[],
): { provider: ProviderName; books: NormalisedBook[] }[] {
  const out: { provider: ProviderName; books: NormalisedBook[] }[] = [];
  for (let i = 0; i < adapters.length; i += 1) {
    const adapter = adapters[i]!;
    const result = settled[i];
    if (!result || result.status === 'rejected') {
      if (result?.status === 'rejected') {
        console.warn(`[library-lookup] ${adapter.name} failed:`, result.reason);
      }
      continue;
    }
    out.push({ provider: adapter.name, books: result.value });
  }
  return out;
}

/**
 * Merge a set of provider results that all describe **the same
 * book** (typically the case after an ISBN lookup). The result keeps
 * the title from the first non-empty source, the longest list of
 * creators, the union of provider IDs, the first non-null cover, etc.
 *
 * Returns null when the input is empty.
 */
export function mergeOnce(books: NormalisedBook[]): NormalisedBook | null {
  if (books.length === 0) return null;
  const first = books[0]!;
  const merged: NormalisedBook = { ...first };
  for (const b of books) {
    if (!merged.title || merged.title === '(sans titre)') merged.title = b.title;
    if (!merged.year && b.year) merged.year = b.year;
    if (!merged.language && b.language) merged.language = b.language;
    if (!merged.original_language && b.original_language) {
      merged.original_language = b.original_language;
    }
    if (!merged.publisher && b.publisher) merged.publisher = b.publisher;
    if (!merged.collection && b.collection) merged.collection = b.collection;
    if (!merged.summary && b.summary) merged.summary = b.summary;
    if (!merged.isbn13 && b.isbn13) merged.isbn13 = b.isbn13;
    if (!merged.isbn10 && b.isbn10) merged.isbn10 = b.isbn10;
    if (!merged.format && b.format) merged.format = b.format;
    // Cover preference: Amazon wins if it has one (their images are
    // higher resolution and more consistently present than OL's).
    // Otherwise FIFO so the earliest provider with a cover gets to
    // contribute.
    if (b.source === 'amazon' && b.cover_url) {
      merged.cover_url = b.cover_url;
    } else if (!merged.cover_url && b.cover_url) {
      merged.cover_url = b.cover_url;
    }
    if (!merged.series && b.series) merged.series = b.series;
    else if (merged.series && b.series) {
      // Same series, fill gaps in position/of from a richer provider.
      if (!merged.series.position && b.series.position) {
        merged.series = { ...merged.series, position: b.series.position };
      }
      if (!merged.series.of && b.series.of) {
        merged.series = { ...merged.series, of: b.series.of };
      }
    }
    if (b.creators.length > merged.creators.length) merged.creators = b.creators;
    merged.providers = { ...b.providers, ...merged.providers };
  }

  // Second pass for the summary: the FIFO pick above grabs whatever
  // provider landed first, which is almost always Google Books (1 s)
  // — and GB's `description` is often EN even when the volume is
  // tagged `language='fr'` (the publisher uploaded an EN blurb).
  // Prefer a summary from a contributor whose language matches the
  // merged book's language. Fall back to whatever FIFO already
  // picked (better than nothing).
  if (merged.language) {
    const target = merged.language.slice(0, 2).toLowerCase();
    const sameLang = books.find(
      (b) =>
        b.summary &&
        b.language &&
        b.language.slice(0, 2).toLowerCase() === target,
    );
    if (sameLang?.summary) merged.summary = sameLang.summary;
  }

  // Final pass: normalise the summary into the lightweight Markdown
  // subset our front-end editor understands (`**bold**`, `*italic*`).
  // Providers ship raw HTML (Google Books) and ad-hoc wiki markup
  // (`##title##` for italicised titles, courtesy of OL imports from
  // publisher catalogues). Without this pass the user sees literal
  // `##La place##` in the textarea — see the screenshot in the chat
  // log for an example.
  if (merged.summary) {
    merged.summary = cleanSummary(merged.summary);
  }

  return merged;
}

/**
 * Convert provider-specific summary markup into the light Markdown
 * subset the Library Composer's `MarkdownEditor` understands.
 *
 * Transforms applied, in order:
 *   1. HTML inline emphasis tags → Markdown markers
 *      (`<b>`/`<strong>` → `**…**`, `<i>`/`<em>` → `*…*`).
 *   2. `<br>` and `</p>` → newlines so paragraph breaks survive.
 *   3. Strip any remaining HTML tags (links, headings, divs, etc.).
 *      Their text content is preserved.
 *   4. `##text##` → `*text*`. This double-hash convention shows up in
 *      OL descriptions imported from publisher catalogues (Gallimard
 *      especially) where it marks a referenced work title — exactly
 *      what we'd render as italic.
 *   5. Decode the small set of HTML entities that often slip through
 *      (`&amp;`, `&nbsp;`, `&#39;`).
 *   6. Collapse runs of 3+ newlines into a max of two (visual breath).
 */
function cleanSummary(raw: string): string {
  return (
    raw
      // (1) HTML emphasis to Markdown markers.
      .replace(/<\s*(?:b|strong)[^>]*>([\s\S]*?)<\s*\/\s*(?:b|strong)\s*>/gi, '**$1**')
      .replace(/<\s*(?:i|em)[^>]*>([\s\S]*?)<\s*\/\s*(?:i|em)\s*>/gi, '*$1*')
      // (2) Block separators to newlines.
      .replace(/<\s*br\s*\/?\s*>/gi, '\n')
      .replace(/<\s*\/\s*p\s*>/gi, '\n\n')
      // (3) Drop any remaining HTML tag, keep inner text.
      .replace(/<[^>]+>/g, '')
      // (4) Wiki-ish double-hash to italic.
      .replace(/##([^#\n]+?)##/g, '*$1*')
      // (5) Decode common entities (the rest survive but are rare).
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ')
      // (6) Collapse 3+ newlines to 2.
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}
