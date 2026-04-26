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

  async byQuery(query, _lang): Promise<NormalisedBook[]> {
    // BNF runs on Virtuoso, which exposes a full-text index via
    // `bif:contains`. Way faster than `regex(str(?title), …)` —
    // an FTS lookup is millisecond-range, the regex variant was
    // a full-table scan that timed out at 8 s on common French
    // queries (« Les origines républicaines de Vichy » etc.).
    //
    // Stop words are stripped server-side, accents folded — we
    // just pass the user input verbatim. Words are AND-combined
    // by default in Virtuoso, which is what we want.
    const fts = escapeLiteral(query);
    const sparql = `
      PREFIX dcterms: <http://purl.org/dc/terms/>
      PREFIX bnf-onto: <http://data.bnf.fr/ontology/bnf-onto/>
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      SELECT DISTINCT ?work ?title ?authorName ?date ?publisher ?isbn ?language ?seriesName ?collectionName WHERE {
        ?work dcterms:title ?title .
        ?title bif:contains "${fts}" .
        OPTIONAL { ?work dcterms:creator ?author . ?author foaf:name ?authorName . }
        OPTIONAL { ?work dcterms:date ?date . }
        OPTIONAL { ?work dcterms:publisher ?publisher . }
        OPTIONAL { ?work bnf-onto:isbn ?isbn . }
        OPTIONAL { ?work dcterms:language ?lang . ?lang rdf:value ?language . }
        OPTIONAL { ?work dcterms:isPartOf ?series . ?series dcterms:title ?seriesName . }
        OPTIONAL { ?work bnf-onto:collection ?collectionName . }
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
        original_language: null,
        page_count: null,
        publisher: bindingValue(row, 'publisher') ?? null,
        collection: bindingValue(row, 'collectionName') ?? null,
        summary: null,
        isbn13,
        isbn10,
        format: null,
        series: null,
        cover_url: null,
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

function escapeLiteral(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
