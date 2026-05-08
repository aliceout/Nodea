import type {
  LibraryLookupResponse,
  LibraryLookupStreamSnapshot,
  NormalisedBook,
} from '@nodea/shared';
import type { ProviderAdapter, ProviderName } from './types.ts';

import { LookupCache } from './cache.ts';
import { dedupeAcrossProviders, filterByLanguage } from './dedupe.ts';
import { collectResults, mergeOnce } from './merge.ts';
import { PROVIDERS } from './providers.ts';

export { probeLibraryProviders } from './probe.ts';

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CACHE_MAX = 1024;
const cache = new LookupCache<LibraryLookupResponse>(CACHE_MAX, CACHE_TTL_MS);

/**
 * Drop providers whose `restrictsToLang` doesn't match the query's
 * language hint (issue #38). BNE only knows Spanish-language
 * patrimony — running it for an English query wastes a SPARQL
 * round-trip and pollutes the merge with low-quality rows.
 *
 * When `lang` is unset we keep every provider — without a hint we
 * can't decide what to skip, so we err on the side of more
 * coverage.
 */
export function filterByLangCompat(
  adapters: readonly ProviderAdapter[],
  lang?: string,
): ProviderAdapter[] {
  if (!lang) return [...adapters];
  const prefix = lang.slice(0, 2).toLowerCase();
  return adapters.filter(
    (a) => !a.restrictsToLang || prefix === a.restrictsToLang,
  );
}

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
 * Streaming variant of {@link lookupByIsbn} for free-text queries:
 * yields a snapshot after each provider settles, so the front can
 * render results progressively (Google Books usually arrives in 1 s,
 * Open Library in 10–15 s — the user sees partial results
 * immediately instead of staring at a spinner for the whole window).
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
    filterByLangCompat(
      PROVIDERS.filter((a) => a.enabled),
      lang,
    ),
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
