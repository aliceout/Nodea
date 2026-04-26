/**
 * Tiny SPARQL JSON-results client.
 *
 * Used by the BNF / Wikidata / BNE adapters. Each endpoint accepts
 * a `query` parameter and returns the SPARQL 1.1 JSON results
 * format — so this single helper is enough for all three.
 *
 * Reference: https://www.w3.org/TR/sparql11-results-json/
 */
import { Agent, request as undiciRequest } from 'undici';
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
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/sparql-results+json',
    'User-Agent': 'Nodea/0.1 (library-lookup)',
  };
  const body = new URLSearchParams({ query }).toString();

  // For relaxTls callers (BNE), use undici's `request` directly
  // instead of Node's `fetch`. Node's `fetch` uses its own bundled
  // undici and the dispatcher option doesn't always thread through
  // cleanly when the userland `Agent` comes from a different copy
  // of the package — calls failed with a generic `fetch failed`
  // before ever reaching the network. `undici.request` keeps the
  // Agent and the request on the same module, eliminates the
  // ambiguity.
  if (options.relaxTls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const { statusCode, body: responseBody } = await undiciRequest(endpoint, {
        method: 'POST',
        headers,
        body,
        dispatcher: relaxedTlsDispatcher,
        signal: controller.signal,
      });
      if (statusCode >= 400) {
        throw new Error(`sparql ${endpoint} ${statusCode}`);
      }
      const text = await responseBody.text();
      const data = JSON.parse(text) as SparqlJson;
      return data.results?.bindings ?? [];
    } catch (err) {
      throw wrapSparqlError(endpoint, err);
    } finally {
      clearTimeout(timer);
    }
  }

  // Standard path (BNF, Wikidata) — Node's fetch with timeout.
  try {
    const res = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers,
      body,
      timeoutMs: 8000,
    });
    if (!res.ok) throw new Error(`sparql ${endpoint} ${res.status}`);
    const data = (await res.json()) as SparqlJson;
    return data.results?.bindings ?? [];
  } catch (err) {
    throw wrapSparqlError(endpoint, err);
  }
}

/** Surface the underlying cause of a `fetch failed` (DNS, TLS,
 *  connection refused) so the admin "Sources" tab can show
 *  something actionable instead of a generic error string. */
function wrapSparqlError(endpoint: string, err: unknown): Error {
  if (!(err instanceof Error)) return new Error(`sparql ${endpoint}: ${String(err)}`);
  const cause = (err as Error & { cause?: { code?: string; message?: string } }).cause;
  if (cause) {
    const causeMsg = cause.code ?? cause.message ?? '';
    return new Error(`sparql ${endpoint}: ${err.message}${causeMsg ? ` (${causeMsg})` : ''}`);
  }
  return err;
}

/** Pick a binding's value, or undefined if the variable is absent. */
export function bindingValue(row: SparqlRow, key: string): string | undefined {
  return row[key]?.value;
}
