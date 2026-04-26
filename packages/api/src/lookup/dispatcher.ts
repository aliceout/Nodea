import type {
  LibraryLookupResponse,
  LibraryLookupStreamSnapshot,
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


/**
 * Streaming variant of {@link lookupByQuery}: yields a snapshot
 * after each provider settles, so the front can render results
 * progressively (Google Books usually arrives in 1 s, Open Library
 * in 10–15 s — the user sees partial results immediately instead
 * of staring at a spinner for the whole window).
 *
 * Each yielded snapshot carries the *current accumulated state*
 * (deduped + language-filtered), not just the new chunk: the
 * client can blindly replace its render list on every event,
 * no merging logic needed. The final snapshot has `done: true`.
 *
 * Provider failures are caught per-adapter and emitted in the
 * snapshot's `errored` list — one broken provider never cancels
 * the whole stream.
 *
 * The lookup cache is consulted on entry: a cached response is
 * yielded as a single `done: true` snapshot, no provider calls.
 */
export async function* streamLookupByQuery(
  query: string,
  lang?: string,
): AsyncGenerator<LibraryLookupStreamSnapshot, void, void> {
  const key = `q:${lang ?? '_'}:${query.toLowerCase().replace(/\s+/g, ' ').trim()}`;
  const cached = cache.get(key);
  if (cached) {
    yield {
      results: cached.results,
      queried: cached.queried,
      errored: [],
      done: true,
    };
    return;
  }

  const adapters = reorderForLang(
    PROVIDERS.filter((a) => a.enabled),
    lang,
  );
  if (adapters.length === 0) {
    yield { results: [], queried: [], errored: [], done: true };
    return;
  }

  // Each pending entry is keyed by adapter index so we can delete
  // it from the map after `Promise.race` returns. The race always
  // settles with the first-finished provider — we yield, remove,
  // and loop. JS is single-threaded, so the read-mutate-yield
  // sequence is atomic between awaits — no race hazard despite
  // the name.
  type Settled =
    | { idx: number; ok: true; books: NormalisedBook[] }
    | { idx: number; ok: false; error: unknown };
  const pending = new Map<number, Promise<Settled>>();
  for (let i = 0; i < adapters.length; i += 1) {
    const a = adapters[i]!;
    pending.set(
      i,
      a.byQuery(query, lang).then(
        (books): Settled => ({ idx: i, ok: true, books }),
        (error): Settled => ({ idx: i, ok: false, error }),
      ),
    );
  }

  const accumulator: NormalisedBook[] = [];
  const queried: ProviderName[] = [];
  const errored: { provider: ProviderName; message: string }[] = [];

  while (pending.size > 0) {
    const settled = await Promise.race(pending.values());
    pending.delete(settled.idx);
    const adapter = adapters[settled.idx]!;
    queried.push(adapter.name);
    if (settled.ok) {
      accumulator.push(...settled.books);
    } else {
      const message =
        settled.error instanceof Error ? settled.error.message : String(settled.error);
      errored.push({ provider: adapter.name, message });
      console.warn(`[library-lookup] ${adapter.name} failed:`, settled.error);
    }
    const deduped = dedupeAcrossProviders([...accumulator]);
    const filtered = filterByLanguage(deduped, lang);
    yield {
      results: filtered,
      queried: [...queried],
      errored: [...errored],
      done: pending.size === 0,
    };
  }

  // Once the stream is fully drained, freeze the final result into
  // the LRU cache so the next identical query is one round-trip.
  const finalDeduped = dedupeAcrossProviders([...accumulator]);
  const finalFiltered = filterByLanguage(finalDeduped, lang);
  cache.set(key, {
    results: finalFiltered,
    queried,
    cached: false,
  });
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

/**
 * Dedupe books across providers using *all* identity tokens at
 * once (ISBN-13, ISBN-10, normalised title+first-author). The old
 * approach picked a single key per book — XOR semantics — which
 * meant a record carrying ISBN-X and a tag-less record with the
 * same title+author landed in different groups and stayed split.
 * Now that more providers (OL with `fields=*`, GB) expose ISBNs
 * reliably, the cross-record overlap is more common and worth
 * collapsing.
 *
 * Algorithm: each book contributes a list of tokens. Two books
 * are the same iff they share at least one token. We merge groups
 * iteratively until no two share a token (small N — at most a
 * couple hundred records — so the O(N²) worst case is fine).
 *
 * Insertion order of the *first* contributor of each group is
 * preserved, so the per-provider priority set by `reorderForLang`
 * still drives which row appears at the top.
 */
function dedupeAcrossProviders(books: NormalisedBook[]): NormalisedBook[] {
  type Group = { tokens: Set<string>; books: NormalisedBook[] };
  const groups: Group[] = [];

  for (const book of books) {
    const tokens = identityTokens(book);
    if (tokens.length === 0) {
      // Pathological: no title, no isbn — keep as its own group so
      // we don't accidentally fold it into an unrelated record.
      groups.push({ tokens: new Set(), books: [book] });
      continue;
    }
    const matches: number[] = [];
    for (let i = 0; i < groups.length; i += 1) {
      const g = groups[i]!;
      if (tokens.some((t) => g.tokens.has(t))) {
        matches.push(i);
      }
    }
    if (matches.length === 0) {
      groups.push({ tokens: new Set(tokens), books: [book] });
      continue;
    }
    // Fold the new book + any extra matched groups into the first
    // matching group. This handles the bridge case: book A has
    // token X, book B has token Y, book C has tokens X+Y → C
    // should merge A's and B's groups together.
    const target = groups[matches[0]!]!;
    for (const t of tokens) target.tokens.add(t);
    target.books.push(book);
    if (matches.length > 1) {
      // Walk extras in reverse to splice safely.
      for (let i = matches.length - 1; i >= 1; i -= 1) {
        const idx = matches[i]!;
        const extra = groups[idx]!;
        for (const t of extra.tokens) target.tokens.add(t);
        target.books.push(...extra.books);
        groups.splice(idx, 1);
      }
    }
  }

  const out: NormalisedBook[] = [];
  for (const g of groups) {
    const merged = mergeOnce(g.books);
    if (merged) out.push(merged);
  }
  return out;
}

/**
 * Identity tokens used by the dedupe — every token a record would
 * "claim". Two records sharing any token are the same book.
 *
 * Title normalisation: lowercase + collapse whitespace + strip
 * trailing edition tags (`(English Edition)`, `(Édition de poche)`,
 * `(Folio classique)`) so the same book sold under multiple
 * editions on Amazon doesn't split. We don't strip aggressively
 * (no diacritic folding, no punctuation removal) — being too
 * lenient would conflate genuinely different titles.
 */
function identityTokens(book: NormalisedBook): string[] {
  const tokens: string[] = [];
  if (book.isbn13) tokens.push(`isbn13:${book.isbn13}`);
  if (book.isbn10) tokens.push(`isbn10:${book.isbn10}`);
  const author = book.creators[0]?.name?.toLocaleLowerCase('fr').trim() ?? '';
  const title = book.title
    .toLocaleLowerCase('fr')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (title) tokens.push(`ta:${title}|${author}`);
  return tokens;
}

/**
 * Drop books whose `language` is set and different from `lang`.
 * Books with `language === null` are kept on purpose — providers
 * don't tag every record (niche / academic editions especially),
 * and dropping nulls would over-prune the result set. If a kept
 * `null`-language record turns out to be in another language, the
 * user can re-search.
 *
 * No-op when `lang` is missing — that path is reserved for ISBN
 * lookups (where the code is unambiguous and language doesn't
 * gate the result).
 *
 * `lang` is normalised to its 2-letter prefix so `fr-FR` and `fr`
 * both compare equal. Books carry their own language as a 2-letter
 * BCP-47 code set by the adapters.
 */
function filterByLanguage(books: NormalisedBook[], lang?: string): NormalisedBook[] {
  if (!lang) return books;
  const target = lang.slice(0, 2).toLowerCase();
  if (!target) return books;
  return books.filter((b) => {
    if (!b.language) return true;
    return b.language.slice(0, 2).toLowerCase() === target;
  });
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
