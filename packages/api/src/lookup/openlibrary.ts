import type { NormalisedBook } from '@nodea/shared';
import type { ProviderAdapter } from './types.ts';
import { fetchWithTimeout } from './fetch-with-timeout.ts';
import { extractYear, normaliseAuthorName, normaliseIsbn } from './names.ts';

/**
 * Open Library adapter — public, no key required.
 * https://openlibrary.org/developers/api
 *
 * Strategy:
 *   - ISBN: hit `/isbn/{isbn}.json` (the cleanest endpoint); fall
 *     back to the search API if 404.
 *   - Query: hit `/search.json?q=...&limit=10` and pull the top
 *     results. Each result already carries enough fields for our
 *     UI; we don't drill into work/edition records here (one
 *     network round-trip is the goal).
 */
export const openLibraryAdapter: ProviderAdapter = {
  name: 'openlibrary',
  label: 'Open Library',
  enabled: true,
  needsKey: false,
  strictProbe: false,

  async byIsbn(isbn): Promise<NormalisedBook[]> {
    const { stripped } = normaliseIsbn(isbn);
    const res = await fetchWithTimeout(`https://openlibrary.org/isbn/${stripped}.json`, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Nodea/0.1 (library-lookup)' },
      timeoutMs: 6000,
    });
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`openlibrary isbn ${res.status}`);
    const data = (await res.json()) as OpenLibraryEditionRaw;
    const book = await editionToNormalised(data, stripped);
    return book ? [book] : [];
  },

  async byQuery(query, lang): Promise<NormalisedBook[]> {
    // We deliberately do NOT pass `language` — OL's `language=fre`
    // filter behaves as a hard cut: any record without an explicit
    // language tag (very common on French niche / academic titles)
    // gets dropped, even when it would otherwise match the query.
    // Better to let OL rank freely and let the dispatcher merge with
    // BNF/Wikidata for FR-specific signals.
    // limit=100: OL's API ceiling is fine here, and prolific authors
    // (Asimov, King, Simenon…) genuinely have 50+ works. The
    // dispatcher dedupes downstream so duplicate editions across
    // OL works collapse — we want the raw breadth, not a small
    // pre-truncated sample. No final slice anymore (streaming UX),
    // so OL's contribution flows through entirely.
    //
    // `fields=*`: by default search.json returns a *trimmed* doc
    // shape that often omits `isbn`, leaving our rows without an
    // identifier. Asking for everything is the cheapest way to
    // guarantee the fields we use are populated. We could enumerate
    // the exact list (key,title,author_name,isbn,language,…) but
    // the response payload is small enough that the wildcard isn't
    // worth being clever about.
    const params = new URLSearchParams({ q: query, limit: '100', fields: '*' });
    const res = await fetchWithTimeout(`https://openlibrary.org/search.json?${params}`, {
      headers: { 'User-Agent': 'Nodea/0.1 (library-lookup)' },
      // 20 s — OL's full-text search is genuinely slow on common
      // queries (popular authors hit 9-15 s on cold cache, sometimes
      // more under load). Earlier values (8 s, 12 s) kept aborting
      // and wiping OL out of the result set entirely.
      timeoutMs: 20000,
    });
    if (!res.ok) throw new Error(`openlibrary search ${res.status}`);
    const data = (await res.json()) as OpenLibrarySearchRaw;
    return (data.docs ?? []).map((doc) => searchDocToNormalised(doc, lang));
  },
};

/* ---- Raw response shapes (only what we use) -------------------- */

interface OpenLibraryEditionRaw {
  title?: string;
  authors?: { key: string }[];
  publish_date?: string;
  publishers?: string[];
  number_of_pages?: number;
  isbn_10?: string[];
  isbn_13?: string[];
  works?: { key: string }[];
  /** Cover ID — `https://covers.openlibrary.org/b/id/{id}-L.jpg`. */
  covers?: number[];
  languages?: { key: string }[];
  key?: string;
  physical_format?: string;
  series?: string[];
  description?: string | { value: string };
}

interface OpenLibrarySearchDoc {
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  publisher?: string[];
  isbn?: string[];
  cover_i?: number;
  language?: string[];
  number_of_pages_median?: number;
  key?: string; // "/works/OL45804W"
  series?: string[];
  first_sentence?: string[];
}

interface OpenLibrarySearchRaw {
  docs?: OpenLibrarySearchDoc[];
}

/* ---- Normalisation -------------------------------------------- */

async function editionToNormalised(
  edition: OpenLibraryEditionRaw,
  searchedIsbn: string,
): Promise<NormalisedBook | null> {
  if (!edition.title) return null;

  // The /isbn/ endpoint returns author refs as `{ key: '/authors/OL...' }`
  // — we'd need a second round-trip per author to resolve names. Skip
  // that here: the search adapter gives us names directly, and on
  // ISBN lookups we accept "no names" as a tradeoff for speed. The
  // user can edit afterwards, or we'll fill in via Google Books in
  // the merge step.
  const creators: NormalisedBook['creators'] = [];

  const olKey = edition.works?.[0]?.key ?? edition.key ?? null;
  const isbn13 = edition.isbn_13?.[0] ?? (searchedIsbn.length === 13 ? searchedIsbn : null);
  const isbn10 = edition.isbn_10?.[0] ?? (searchedIsbn.length === 10 ? searchedIsbn : null);
  const coverId = edition.covers?.[0];
  const language = edition.languages?.[0]?.key
    ? edition.languages[0].key.replace('/languages/', '').slice(0, 2)
    : null;
  const seriesName = edition.series?.[0] ?? null;
  const description = edition.description
    ? typeof edition.description === 'string'
      ? edition.description
      : edition.description.value
    : null;

  return {
    title: edition.title,
    creators,
    year: extractYear(edition.publish_date ?? null),
    language,
    original_language: null,
    publisher: edition.publishers?.[0] ?? null,
    collection: null,
    summary: description,
    isbn13: isbn13 ?? null,
    isbn10: isbn10 ?? null,
    format: inferFormat(edition.physical_format),
    series: seriesName ? parseSeriesString(seriesName) : null,
    cover_url: coverId
      ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
      : null,
    providers: olKey ? { openlibrary: olKey } : {},
    source: 'openlibrary',
  };
}

function searchDocToNormalised(
  doc: OpenLibrarySearchDoc,
  langHint?: string,
): NormalisedBook {
  const creators: NormalisedBook['creators'] = (doc.author_name ?? []).map(
    (raw) => ({ name: normaliseAuthorName(raw), role: 'author' }),
  );
  const isbn13 = (doc.isbn ?? []).find((i) => /^\d{13}$/.test(i.replace(/[-\s]/g, ''))) ?? null;
  const isbn10 =
    (doc.isbn ?? []).find((i) => /^\d{9}[\dX]$/.test(i.replace(/[-\s]/g, ''))) ?? null;
  const seriesName = doc.series?.[0] ?? null;
  return {
    title: doc.title ?? '(sans titre)',
    creators,
    year: doc.first_publish_year ?? null,
    // OL search docs are work-level — `doc.language` lists *every*
    // edition's language across translations. Picking `[0]` blindly
    // labels translated works with whatever ISO code happened to come
    // first (often the original, often `eng`), which makes the
    // dispatcher's hard language filter drop FR users' results for
    // any author whose work was translated. Instead, when the user
    // gave a language hint, prefer that one if it's present in the
    // edition list — it means an edition in that language exists.
    // Fallback to `[0]` when no hint or no match.
    language: pickLanguage(doc.language, langHint),
    original_language: null,
    publisher: doc.publisher?.[0] ?? null,
    collection: null,
    summary: doc.first_sentence?.[0] ?? null,
    isbn13: isbn13 ? isbn13.replace(/[-\s]/g, '') : null,
    isbn10: isbn10 ? isbn10.replace(/[-\s]/g, '') : null,
    format: null,
    series: seriesName ? parseSeriesString(seriesName) : null,
    cover_url: doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
      : null,
    providers: doc.key ? { openlibrary: doc.key } : {},
    source: 'openlibrary',
  };
}

/**
 * Pick the language code that best matches the user's hint from a
 * list of edition languages. OL search docs return a `language`
 * array spanning every translation of the work; without a hint we
 * just take the first entry (arbitrary), but with a hint we prefer
 * a match because it tells the dispatcher's language filter that
 * an edition in the requested language exists. `slice(0, 2)`
 * folds 3-letter MARC codes (`fre`, `eng`, `spa`) to their 2-letter
 * BCP-47 equivalents — happens to work for the major languages we
 * care about because the first 2 chars line up.
 */
function pickLanguage(
  langs: string[] | undefined,
  hint: string | undefined,
): string | null {
  if (!langs || langs.length === 0) return null;
  const norm = langs.map((l) => l.slice(0, 2).toLowerCase());
  if (hint) {
    const target = hint.slice(0, 2).toLowerCase();
    if (norm.includes(target)) return target;
  }
  return norm[0] ?? null;
}

/**
 * Treat 0 / negative / undefined page counts as "unknown". Some
 * OL records carry `number_of_pages: 0` as a placeholder for
 * missing data, which would fail downstream validation that
 * (correctly) refuses zero-page books.
 */
function positiveOrNull(n: number | undefined | null): number | null {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Map the free-form `physical_format` string Open Library returns
 * (typical values: "Paperback", "Hardcover", "Mass Market Paperback",
 * "eBook", "Kindle Edition", "Audio CD", "Audiobook"…) onto our
 * compact enum. Falls back to null when nothing matches — the form
 * defaults to `unknown` and the user can pick.
 */
function inferFormat(raw: string | undefined): NormalisedBook['format'] {
  if (!raw) return null;
  const lc = raw.toLocaleLowerCase('en');
  if (lc.includes('audio') || lc.includes('cd')) return 'audio';
  if (lc.includes('ebook') || lc.includes('kindle') || lc.includes('epub')) {
    return 'ebook';
  }
  if (lc.includes('paperback') || lc.includes('hardcover') || lc.includes('mass market')) {
    return 'paper';
  }
  return null;
}

/**
 * Parse a series string like "Les Misérables, tome 2" or
 * "Les Misérables (Tome 2/5)" into `{name, position, of}`. Defaults
 * to `{name, position: null}` when the position can't be extracted.
 * OL returns these as plain strings, so this is best-effort regex.
 */
function parseSeriesString(raw: string): NonNullable<NormalisedBook['series']> {
  const cleaned = raw.trim();
  // "Name, tome N", "Name, vol. N", "Name #N", "Name (Tome N/M)"
  const m =
    /^(.+?)[,\s]+(?:tome|vol\.?|volume|t\.|#)\s*(\d+)(?:\s*\/\s*(\d+))?[)\]]*\s*$/iu.exec(
      cleaned,
    );
  if (m) {
    return {
      name: m[1]!.trim(),
      position: Number(m[2]),
      of: m[3] ? Number(m[3]) : null,
    };
  }
  return { name: cleaned, position: null, of: null };
}

