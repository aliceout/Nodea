import type {
  LibraryLookupResponse,
  NormalisedBook,
  SourceHealth,
} from '@nodea/shared';
import type { ProviderAdapter, ProviderName } from './types.ts';
import { openLibraryAdapter } from './openlibrary.ts';
import { googleBooksAdapter } from './googlebooks.ts';
import { bnfAdapter } from './bnf.ts';
import { wikidataAdapter } from './wikidata.ts';
import { bneAdapter } from './bne.ts';
import { amazonAdapter } from './amazon.ts';
import { LookupCache } from './cache.ts';

/**
 * Provider order — controls (a) which adapters are queried at all,
 * and (b) the priority used by `mergeBooks` when fields collide.
 * Adapters are queried in **parallel** (`Promise.allSettled`); the
 * order only matters for the merge.
 *
 * Open Library and Google Books come first because they have
 * covers, summaries, and page counts. The SPARQL providers go
 * after — they fill in the gaps for niche / multilingual books
 * the commercial-ish providers don't cover well.
 */
const PROVIDERS: readonly ProviderAdapter[] = [
  openLibraryAdapter,
  googleBooksAdapter,
  bnfAdapter,
  wikidataAdapter,
  bneAdapter,
  // Amazon is last on purpose: scraped HTML, the most fragile of the
  // bunch. The merge prefers fields from earlier providers when they
  // exist, so Amazon mostly fills gaps (covers, recent editions
  // missing from OL).
  amazonAdapter,
];

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CACHE_MAX = 1024;
const cache = new LookupCache<LibraryLookupResponse>(CACHE_MAX, CACHE_TTL_MS);

/**
 * Reorder providers so that the language-aligned national library
 * comes first when the caller hints at a specific language. BNF
 * leads on `fr`, BNE on `es`; everything else stays in default
 * priority order. Doesn't change the set, only the merge weight.
 */
function reorderForLang(adapters: readonly ProviderAdapter[], lang?: string): ProviderAdapter[] {
  if (!lang) return [...adapters];
  const target =
    lang.startsWith('fr')
      ? 'bnf'
      : lang.startsWith('es')
        ? 'bne'
        : null;
  if (!target) return [...adapters];
  const front: ProviderAdapter[] = [];
  const tail: ProviderAdapter[] = [];
  for (const a of adapters) {
    if (a.name === target) front.push(a);
    else tail.push(a);
  }
  return [...front, ...tail];
}

export async function lookupByIsbn(isbn: string): Promise<LibraryLookupResponse> {
  const key = `isbn:${isbn}`;
  const cached = cache.get(key);
  if (cached) return { ...cached, cached: true };

  const adapters = PROVIDERS.filter((a) => a.enabled);
  const settled = await Promise.allSettled(adapters.map((a) => a.byIsbn(isbn)));
  const collected = collectResults(adapters, settled);
  const merged = mergeOnce(collected.flatMap((r) => r.books));
  const response: LibraryLookupResponse = {
    results: merged ? [merged] : [],
    queried: adapters.map((a) => a.name),
    cached: false,
  };
  cache.set(key, response);
  return response;
}

export async function lookupByQuery(
  query: string,
  lang?: string,
): Promise<LibraryLookupResponse> {
  const key = `q:${lang ?? '_'}:${query.toLowerCase().replace(/\s+/g, ' ').trim()}`;
  const cached = cache.get(key);
  if (cached) return { ...cached, cached: true };

  const adapters = reorderForLang(
    PROVIDERS.filter((a) => a.enabled),
    lang,
  );
  const settled = await Promise.allSettled(adapters.map((a) => a.byQuery(query, lang)));
  const collected = collectResults(adapters, settled);
  // For free-text queries we don't merge into a single best-guess —
  // the user wants alternatives. We dedupe by ISBN when present, by
  // (title, first-author) otherwise, and keep the highest-priority
  // version of each.
  const deduped = dedupeAcrossProviders(collected.flatMap((r) => r.books));
  const response: LibraryLookupResponse = {
    results: deduped.slice(0, 15),
    queried: adapters.map((a) => a.name),
    cached: false,
  };
  cache.set(key, response);
  return response;
}

function collectResults(
  adapters: readonly ProviderAdapter[],
  settled: PromiseSettledResult<NormalisedBook[]>[],
): { provider: ProviderName; books: NormalisedBook[] }[] {
  const out: { provider: ProviderName; books: NormalisedBook[] }[] = [];
  for (let i = 0; i < adapters.length; i += 1) {
    const adapter = adapters[i]!;
    const result = settled[i];
    if (!result || result.status === 'rejected') {
      // One broken provider doesn't take down the whole lookup —
      // log it server-side and move on. The client never knows.
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
function mergeOnce(books: NormalisedBook[]): NormalisedBook | null {
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
    if (!merged.page_count && b.page_count) merged.page_count = b.page_count;
    if (!merged.publisher && b.publisher) merged.publisher = b.publisher;
    if (!merged.collection && b.collection) merged.collection = b.collection;
    if (!merged.summary && b.summary) merged.summary = b.summary;
    if (!merged.isbn13 && b.isbn13) merged.isbn13 = b.isbn13;
    if (!merged.isbn10 && b.isbn10) merged.isbn10 = b.isbn10;
    if (!merged.format && b.format) merged.format = b.format;
    if (!merged.cover_url && b.cover_url) merged.cover_url = b.cover_url;
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
  return merged;
}

function dedupeAcrossProviders(books: NormalisedBook[]): NormalisedBook[] {
  // Group by best identity key — ISBN-13 if present, else (title,
  // first-author normalised). Within a group, run `mergeOnce` so
  // we keep the union of fields rather than picking blindly.
  const groups = new Map<string, NormalisedBook[]>();
  const order: string[] = [];
  for (const book of books) {
    const key = identityKey(book);
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(book);
  }
  const out: NormalisedBook[] = [];
  for (const key of order) {
    const merged = mergeOnce(groups.get(key) ?? []);
    if (merged) out.push(merged);
  }
  return out;
}

function identityKey(book: NormalisedBook): string {
  if (book.isbn13) return `isbn13:${book.isbn13}`;
  if (book.isbn10) return `isbn10:${book.isbn10}`;
  const author = book.creators[0]?.name?.toLocaleLowerCase('fr') ?? '';
  const title = book.title.toLocaleLowerCase('fr').replace(/\s+/g, ' ').trim();
  return `ta:${title}|${author}`;
}

/* ---- Health checks (admin "Sources" tab) ---------------------- */

/**
 * Test ISBNs used by the health probe. Each provider gets one we
 * expect to be in its catalogue:
 *   - OL / GB / BNF / Wikidata: Le Petit Prince (universal, present
 *     in every major catalogue, French original).
 *   - BNE: Don Quixote (canonical Spanish title, BNE patrimony).
 */
const TEST_ISBN_BY_PROVIDER: Record<ProviderName, string> = {
  openlibrary: '9782070408504',
  googlebooks: '9782070408504',
  bnf: '9782070408504',
  wikidata: '9782070408504',
  bne: '9788424915377',
  amazon: '9782070408504',
};

async function probeProvider(adapter: ProviderAdapter): Promise<SourceHealth> {
  const base = {
    name: adapter.name,
    label: adapter.label,
    module: 'library',
    needsKey: adapter.needsKey,
  };
  // Provider is keyed and the key is missing: short-circuit.
  if (!adapter.enabled) {
    return {
      ...base,
      configured: false,
      online: false,
      responseMs: null,
      testFoundResults: false,
      error: adapter.needsKey
        ? 'Clé API absente — voir LIBRARY_GOOGLE_BOOKS_API_KEY dans .env'
        : 'Adapter désactivé',
    };
  }
  const isbn = TEST_ISBN_BY_PROVIDER[adapter.name];
  const start = Date.now();
  try {
    const results = await adapter.byIsbn(isbn);
    // For scraped providers (strictProbe=true), 0 results on the
    // universal test ISBN means the HTML parser is broken or bot
    // detection has kicked in — both demand operator attention,
    // both should land as a hard failure rather than a green tick.
    if (adapter.strictProbe && results.length === 0) {
      return {
        ...base,
        configured: true,
        online: false,
        responseMs: Date.now() - start,
        testFoundResults: false,
        error:
          'Sonde négative sur l’ISBN test — parser HTML cassé ou détection bot. ' +
          'Vérifier la structure des résultats côté provider et mettre à jour les regex.',
      };
    }
    return {
      ...base,
      configured: true,
      online: true,
      responseMs: Date.now() - start,
      testFoundResults: results.length > 0,
      error: null,
    };
  } catch (err) {
    return {
      ...base,
      configured: true,
      online: false,
      responseMs: Date.now() - start,
      testFoundResults: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Run the health probe across every Library provider in parallel.
 * Each probe runs independently — one timeout doesn't block the
 * others — and is bounded by the per-adapter fetch timeout
 * (`fetchWithTimeout`, currently 6–8 s).
 */
export async function probeLibraryProviders(): Promise<SourceHealth[]> {
  const results = await Promise.allSettled(PROVIDERS.map((p) => probeProvider(p)));
  const out: SourceHealth[] = [];
  for (let i = 0; i < PROVIDERS.length; i += 1) {
    const adapter = PROVIDERS[i]!;
    const result = results[i];
    if (result?.status === 'fulfilled') {
      out.push(result.value);
    } else {
      out.push({
        name: adapter.name,
        label: adapter.label,
        module: 'library',
        needsKey: adapter.needsKey,
        configured: adapter.enabled,
        online: false,
        responseMs: null,
        testFoundResults: false,
        error:
          result?.status === 'rejected'
            ? result.reason instanceof Error
              ? result.reason.message
              : String(result.reason)
            : 'unknown error',
      });
    }
  }
  return out;
}
