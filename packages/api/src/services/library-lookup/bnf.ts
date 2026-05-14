import type { NormalisedBook } from '@nodea/shared';
import type { ProviderAdapter } from './types.ts';
import { extractYear, normaliseAuthorName, normaliseIsbn } from './names.ts';
import { bindingValue, runSparql, type SparqlRow } from './sparql.ts';

/**
 * BNF (Bibliothèque nationale de France) adapter via the public
 * SPARQL endpoint at `data.bnf.fr/sparql`. Uses the BIBO / DC
 * vocabulary which BNF exposes for every catalogue record.
 *
 * Strong on French books — both the canonical patrimony and recent
 * trade publications. ISBN coverage is excellent ; full-text search
 * is more uneven, so the byQuery branch matches on `dcterms:title`
 * with a regex (case-insensitive) which is the BNF-recommended
 * pattern for fuzzy lookups.
 */
const ENDPOINT = 'https://data.bnf.fr/sparql';

export const bnfAdapter: ProviderAdapter = {
  name: 'bnf',
  label: 'BNF',
  enabled: true,
  needsKey: false,
  strictProbe: false,

  async byIsbn(isbn): Promise<NormalisedBook[]> {
    const { stripped, kind } = normaliseIsbn(isbn);
    if (kind === 'unknown') return [];
    // BNF stores ISBNs both in `bnf-onto:isbn` (the official slot)
    // and in `dcterms:identifier` as a fallback for older records.
    // Querying both with UNION catches the long tail.
    const query = `
      PREFIX dcterms: <http://purl.org/dc/terms/>
      PREFIX bnf-onto: <http://data.bnf.fr/ontology/bnf-onto/>
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      SELECT DISTINCT ?work ?title ?authorName ?date ?publisher ?language ?seriesName ?collectionName WHERE {
        { ?work bnf-onto:isbn "${stripped}" }
        UNION
        { ?work dcterms:identifier "${stripped}" }
        OPTIONAL { ?work dcterms:title ?title . }
        OPTIONAL { ?work dcterms:creator ?author . ?author foaf:name ?authorName . }
        OPTIONAL { ?work dcterms:date ?date . }
        OPTIONAL { ?work dcterms:publisher ?publisher . }
        OPTIONAL { ?work dcterms:language ?lang . ?lang rdf:value ?language . }
        OPTIONAL { ?work dcterms:isPartOf ?series . ?series dcterms:title ?seriesName . }
        OPTIONAL { ?work bnf-onto:collection ?collectionName . }
      }
      LIMIT 5
    `;
    const rows = await runSparql(ENDPOINT, query);
    return groupRowsByWork(rows, stripped, kind);
  },

  async byQuery(_query, _lang): Promise<NormalisedBook[]> {
    // Free-text search on BNF is intentionally a no-op.
    //
    // Tried two SPARQL approaches, neither flies:
    //   - `?title bif:contains "..."` returns 500 — BNF's Virtuoso
    //     doesn't index `dcterms:title` for full-text search, so
    //     the FTS function errors instead of falling back.
    //   - `FILTER(regex(str(?title), …, "i"))` does a full-table
    //     scan over millions of titles and times out at 8 s on
    //     anything except pathologically rare strings.
    //
    // Free-text queries are well covered by Open Library, Google
    // Books and Wikidata (the latter two work fine on French
    // titles); BNF still pulls its weight on `byIsbn`, where
    // `bnf-onto:isbn` IS indexed and lookups are instant. Adding
    // the SRU XML catalog API (`catalogue.bnf.fr/api/SRU`) is the
    // future direction for FR-specific full-text search; not done
    // here because UNIMARC parsing isn't a small dependency.
    return [];
  },
};

function groupRowsByWork(
  rows: SparqlRow[],
  fallbackIsbn: string | null,
  isbnKind: 'isbn13' | 'isbn10' | null,
): NormalisedBook[] {
  const map = new Map<string, NormalisedBook>();
  for (const row of rows) {
    const workUri = bindingValue(row, 'work');
    if (!workUri) continue;
    const title = bindingValue(row, 'title');
    if (!title) continue;

    if (!map.has(workUri)) {
      const isbn = bindingValue(row, 'isbn');
      const isbn13 =
        isbn && /^\d{13}$/.test(isbn.replace(/[-\s]/g, ''))
          ? isbn.replace(/[-\s]/g, '')
          : isbnKind === 'isbn13'
            ? fallbackIsbn
            : null;
      const isbn10 =
        isbn && /^\d{9}[\dX]$/i.test(isbn.replace(/[-\s]/g, ''))
          ? isbn.replace(/[-\s]/g, '').toUpperCase()
          : isbnKind === 'isbn10'
            ? fallbackIsbn
            : null;
      map.set(workUri, {
        title,
        creators: [],
        year: extractYear(bindingValue(row, 'date') ?? null),
        language: bindingValue(row, 'language') ?? null,
        originalLanguage: null,
        publisher: bindingValue(row, 'publisher') ?? null,
        collection: bindingValue(row, 'collectionName') ?? null,
        summary: null,
        isbn13,
        isbn10,
        format: null,
        series: null,
        coverUrl: null,
        providers: { bnf: workUri },
        source: 'bnf',
      });
    }
    const entry = map.get(workUri)!;
    const authorName = bindingValue(row, 'authorName');
    if (authorName) {
      const normalised = normaliseAuthorName(authorName);
      if (!entry.creators.some((c) => c.name === normalised)) {
        entry.creators.push({ name: normalised, role: 'author' });
      }
    }
    const seriesName = bindingValue(row, 'seriesName');
    if (seriesName && !entry.series) {
      entry.series = { name: seriesName, position: null, of: null };
    }
  }
  return Array.from(map.values());
}

