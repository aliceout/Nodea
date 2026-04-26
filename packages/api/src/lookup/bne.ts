import type { NormalisedBook } from '@nodea/shared';
import type { ProviderAdapter } from './types.ts';
import { extractYear, normaliseAuthorName, normaliseIsbn } from './names.ts';
import { bindingValue, runSparql, type SparqlRow } from './sparql.ts';

/**
 * BNE (Biblioteca Nacional de España) adapter via the public
 * SPARQL endpoint at `datos.bne.es/sparql`. Strong on Spanish-
 * language patrimony — Cervantes, Lorca, Bolaño, Borges, etc.
 *
 * BNE uses the IFLA FRBR-aligned ontology with `frbr:Work` /
 * `frbr:Manifestation`. Books are usually `frbr:Manifestation`
 * with an `iflafr:isbn` and `dcterms:title`. The query below joins
 * manifestation → expression → work to surface author, title, year.
 */
const ENDPOINT = 'https://datos.bne.es/sparql';

export const bneAdapter: ProviderAdapter = {
  name: 'bne',
  label: 'BNE (Esp.)',
  enabled: true,
  needsKey: false,
  strictProbe: false,

  async byIsbn(isbn): Promise<NormalisedBook[]> {
    const { stripped, kind } = normaliseIsbn(isbn);
    if (kind === 'unknown') return [];
    const query = `
      PREFIX dc: <http://purl.org/dc/elements/1.1/>
      PREFIX dcterms: <http://purl.org/dc/terms/>
      PREFIX iflafr: <http://iflastandards.info/ns/fr/frbr/frbrer/>
      SELECT DISTINCT ?manif ?title ?authorName ?date ?publisher WHERE {
        { ?manif iflafr:isbn "${stripped}" }
        UNION
        { ?manif dcterms:identifier "${stripped}" }
        OPTIONAL { ?manif dc:title ?title . }
        OPTIONAL { ?manif dc:creator ?author . ?author dc:name ?authorName . }
        OPTIONAL { ?manif dcterms:issued ?date . }
        OPTIONAL { ?manif dc:publisher ?publisher . }
      }
      LIMIT 5
    `;
    const rows = await runSparql(ENDPOINT, query, { relaxTls: true });
    return groupRowsByManif(rows, stripped, kind);
  },

  async byQuery(query, _lang): Promise<NormalisedBook[]> {
    // Same rationale as BNF — datos.bne.es is Virtuoso, so the
    // full-text `bif:contains` index makes title search
    // millisecond-range instead of a regex full-table scan.
    const fts = escapeLiteral(query);
    const sparql = `
      PREFIX dc: <http://purl.org/dc/elements/1.1/>
      PREFIX dcterms: <http://purl.org/dc/terms/>
      PREFIX iflafr: <http://iflastandards.info/ns/fr/frbr/frbrer/>
      SELECT DISTINCT ?manif ?title ?authorName ?date ?publisher ?isbn WHERE {
        ?manif dc:title ?title .
        ?title bif:contains "${fts}" .
        OPTIONAL { ?manif dc:creator ?author . ?author dc:name ?authorName . }
        OPTIONAL { ?manif dcterms:issued ?date . }
        OPTIONAL { ?manif dc:publisher ?publisher . }
        OPTIONAL { ?manif iflafr:isbn ?isbn . }
      }
      LIMIT 30
    `;
    const rows = await runSparql(ENDPOINT, sparql, { relaxTls: true });
    return groupRowsByManif(rows, null, null).slice(0, 10);
  },
};

function groupRowsByManif(
  rows: SparqlRow[],
  fallbackIsbn: string | null,
  isbnKind: 'isbn13' | 'isbn10' | null,
): NormalisedBook[] {
  const map = new Map<string, NormalisedBook>();
  for (const row of rows) {
    const manifUri = bindingValue(row, 'manif');
    if (!manifUri) continue;
    const title = bindingValue(row, 'title');
    if (!title) continue;

    if (!map.has(manifUri)) {
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
      map.set(manifUri, {
        title,
        creators: [],
        year: extractYear(bindingValue(row, 'date') ?? null),
        language: 'es',
        original_language: 'es',
        page_count: null,
        publisher: bindingValue(row, 'publisher') ?? null,
        collection: null,
        summary: null,
        isbn13,
        isbn10,
        format: null,
        series: null,
        cover_url: null,
        providers: { bne: manifUri },
        source: 'bne',
      });
    }
    const authorName = bindingValue(row, 'authorName');
    if (authorName) {
      const entry = map.get(manifUri)!;
      const normalised = normaliseAuthorName(authorName);
      if (!entry.creators.some((c) => c.name === normalised)) {
        entry.creators.push({ name: normalised, role: 'author' });
      }
    }
  }
  return Array.from(map.values());
}

function escapeLiteral(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
