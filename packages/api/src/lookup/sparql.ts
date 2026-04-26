/**
 * Tiny SPARQL JSON-results client.
 *
 * Used by the BNF / Wikidata / BNE adapters. Each endpoint accepts
 * a `query` parameter and returns the SPARQL 1.1 JSON results
 * format — so this single helper is enough for all three.
 *
 * Reference: https://www.w3.org/TR/sparql11-results-json/
 */
import { Agent } from 'undici';
import { fetchWithTimeout } from './fetch-with-timeout.ts';

export interface SparqlBinding {
  type: 'uri' | 'literal' | 'bnode' | 'typed-literal';
  value: string;
  'xml:lang'?: string;
}
export type SparqlRow = Record<string, SparqlBinding>;

interface SparqlJson {
  results?: { bindings?: SparqlRow[] };
}

/**
 * Relaxed-TLS dispatcher for endpoints with known broken cert
 * chains (datos.bne.es serves an incomplete chain — Sectigo
 * intermediates aren't sent, so Node's default trust store can't
 * verify the leaf). Opt-in only via `runSparql(..., { relaxTls: true })`,
 * never the default.
 *
 * Trade-off: an attacker on the network path between the Nodea
 * server and the targeted SPARQL endpoint could MITM the response
 * and inject fake metadata (a wrong title/author landing in the
 * user's library). For public, read-only catalogues the practical
 * risk is low; users can always edit / delete a fishy import.
 */
const relaxedTlsDispatcher = new Agent({
  connect: { rejectUnauthorized: false },
});

export async function runSparql(
  endpoint: string,
  query: string,
  options: { relaxTls?: boolean } = {},
): Promise<SparqlRow[]> {
  // Use POST with form-urlencoded body — SPARQL queries can be longer
  // than what fits in a GET URL on some endpoints (BNE in particular).
  const res = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/sparql-results+json',
      'User-Agent': 'Nodea/0.1 (library-lookup)',
    },
    body: new URLSearchParams({ query }).toString(),
    timeoutMs: 8000,
    ...(options.relaxTls ? { dispatcher: relaxedTlsDispatcher } : {}),
  });
  if (!res.ok) throw new Error(`sparql ${endpoint} ${res.status}`);
  const data = (await res.json()) as SparqlJson;
  return data.results?.bindings ?? [];
}

/** Pick a binding's value, or undefined if the variable is absent. */
export function bindingValue(row: SparqlRow, key: string): string | undefined {
  return row[key]?.value;
}
