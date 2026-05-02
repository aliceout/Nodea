import type { NormalisedBook } from '@nodea/shared';
import type { ProviderAdapter } from './types.ts';
import { extractYear, normaliseAuthorName, normaliseIsbn } from './names.ts';
import { bindingValue, runSparql, type SparqlRow } from './sparql.ts';

/**
 * Wikidata adapter — multilingual, no API key.
 * https://query.wikidata.org/sparql
 *
 * Strategy:
 *   - ISBN: P212 (ISBN-13) or P957 (ISBN-10) lookup. Returns the
 *     work's `Q…` id, label, author label(s), publication date,
 *     and page count when available.
 *   - Query: full-text search via `wikibase:label` services on
 *     items of class Q571 (book) or Q47461344 (written work).
 *     Limit 10 to keep the round-trip snappy.
 *
 * The query asks for results in `fr,en,es` so labels come back in
 * a sensible language — the front-end can treat them as-is.
 */
const ENDPOINT = 'https://query.wikidata.org/sparql';

export const wikidataAdapter: ProviderAdapter = {
  name: 'wikidata',
  label: 'Wikidata',
  enabled: true,
  needsKey: false,
  strictProbe: false,

  async byIsbn(isbn): Promise<NormalisedBook[]> {
    const { stripped, kind } = normaliseIsbn(isbn);
    if (kind === 'unknown') return [];
    const property = kind === 'isbn13' ? 'P212' : 'P957';
    const query = `
      SELECT ?work ?workLabel ?authorLabel ?date ?pages ?language ?seriesLabel ?ordinal WHERE {
        ?work wdt:${property} "${escapeLiteral(stripped)}" .
        OPTIONAL { ?work wdt:P50 ?author . }
        OPTIONAL { ?work wdt:P577 ?date . }
        OPTIONAL { ?work wdt:P1104 ?pages . }
        OPTIONAL { ?work wdt:P407 ?lang . ?lang wdt:P218 ?language . }
        OPTIONAL {
          ?work p:P179 ?seriesStmt .
          ?seriesStmt ps:P179 ?series .
          OPTIONAL { ?seriesStmt pq:P1545 ?ordinal . }
        }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en,es,de,it" . }
      }
      LIMIT 5
    `;
    const rows = await runSparql(ENDPOINT, query);
    return groupRowsByWork(rows, stripped, kind);
  },

  async byQuery(query, lang): Promise<NormalisedBook[]> {
    const search = escapeLiteral(query);
    const langs = lang ? `${lang.slice(0, 2)},fr,en,es` : 'fr,en,es,de,it';
    const sparql = `
      SELECT ?work ?workLabel ?authorLabel ?date ?pages ?isbn13 ?language ?seriesLabel ?ordinal WHERE {
        SERVICE wikibase:mwapi {
          bd:serviceParam wikibase:api "EntitySearch" ;
                          wikibase:endpoint "www.wikidata.org" ;
                          mwapi:search "${search}" ;
                          mwapi:language "${lang ? lang.slice(0, 2) : 'en'}" .
          ?work wikibase:apiOutputItem mwapi:item .
        }
        ?work wdt:P31/wdt:P279* wd:Q571 .
        OPTIONAL { ?work wdt:P50 ?author . }
        OPTIONAL { ?work wdt:P577 ?date . }
        OPTIONAL { ?work wdt:P1104 ?pages . }
        OPTIONAL { ?work wdt:P212 ?isbn13 . }
        OPTIONAL { ?work wdt:P407 ?lang . ?lang wdt:P218 ?language . }
        OPTIONAL {
          ?work p:P179 ?seriesStmt .
          ?seriesStmt ps:P179 ?series .
          OPTIONAL { ?seriesStmt pq:P1545 ?ordinal . }
        }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "${langs}" . }
      }
      LIMIT 30
    `;
    const rows = await runSparql(ENDPOINT, sparql);
    return groupRowsByWork(rows, null, null).slice(0, 10);
  },
};

function groupRowsByWork(
  rows: SparqlRow[],
  fallbackIsbn: string | null,
  isbnKind: 'isbn13' | 'isbn10' | null,
): NormalisedBook[] {
  // Wikidata SPARQL returns one row per (work × author × …) cross
  // product. Collapse rows by `?work` URI, accumulating distinct
  // authors / picking the first scalar value for the rest.
  const map = new Map<string, NormalisedBook>();
  for (const row of rows) {
    const workUri = bindingValue(row, 'work');
    if (!workUri) continue;
    const wikidataId = workUri.replace('http://www.wikidata.org/entity/', '');
    const title = bindingValue(row, 'workLabel') ?? '(sans titre)';
    if (!map.has(workUri)) {
      const isbn13 =
        bindingValue(row, 'isbn13') ??
        (isbnKind === 'isbn13' ? fallbackIsbn : null);
      const isbn10 = isbnKind === 'isbn10' ? fallbackIsbn : null;
      const language = bindingValue(row, 'language') ?? null;
      map.set(workUri, {
        title,
        creators: [],
        year: extractYear(bindingValue(row, 'date') ?? null),
        language,
        originalLanguage: language,
        publisher: null,
        collection: null,
        summary: null,
        isbn13: isbn13 ? isbn13.replace(/[-\s]/g, '') : null,
        isbn10: isbn10 ? isbn10.replace(/[-\s]/g, '') : null,
        format: null,
        series: null,
        coverUrl: null,
        providers: { wikidata: wikidataId },
        source: 'wikidata',
      });
    }
    const entry = map.get(workUri)!;
    const authorLabel = bindingValue(row, 'authorLabel');
    if (authorLabel) {
      const normalised = normaliseAuthorName(authorLabel);
      if (!entry.creators.some((c) => c.name === normalised)) {
        entry.creators.push({ name: normalised, role: 'author' });
      }
    }
    const seriesLabel = bindingValue(row, 'seriesLabel');
    if (seriesLabel && !entry.series) {
      const ordinalRaw = bindingValue(row, 'ordinal');
      const ordinal = ordinalRaw ? parseIntSafe(ordinalRaw) : null;
      entry.series = { name: seriesLabel, position: ordinal, of: null };
    }
  }
  return Array.from(map.values());
}

function escapeLiteral(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function parseIntSafe(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
