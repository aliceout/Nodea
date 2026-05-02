import type { Dispatcher } from 'undici';

/**
 * `fetch` wrapper that aborts after `timeoutMs`, so a slow or
 * hung provider can't block the dispatcher's `Promise.allSettled`
 * indefinitely. Wikidata SPARQL in particular can take 30+ seconds
 * on cold queries, and Open Library / BNE have intermittent
 * outages — the dispatcher catches the rejection per-provider, but
 * only if the fetch actually fails.
 *
 * Optionally accepts an undici `Dispatcher` so callers can pass a
 * relaxed-TLS agent for endpoints with known incomplete cert
 * chains (e.g. BNE). The standard `RequestInit` type doesn't carry
 * `dispatcher` (it's a Node-only extension); we accept it on our
 * own option type and merge it into the underlying `fetch` call.
 *
 * Returns the same `Response` object as native `fetch`. Throws an
 * `AbortError` (`error.name === 'AbortError'`) when the timeout
 * fires; this surfaces as a per-provider "failed" log line in the
 * dispatcher and the rest of the lookup keeps going.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number; dispatcher?: Dispatcher } = {},
): Promise<Response> {
  const { timeoutMs = 8000, signal: externalSignal, dispatcher, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // If the caller already passed a signal, wire it through so
  // their abort still works (rare, but cheap to support).
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', () => controller.abort());
  }
  try {
    // `dispatcher` is a Node-specific extension to fetch options;
    // not part of the standard `RequestInit`, so cast to forward it.
    const fetchInit = {
      ...rest,
      signal: controller.signal,
      ...(dispatcher ? { dispatcher } : {}),
    } as RequestInit;
    return await fetch(url, fetchInit);
  } finally {
    clearTimeout(timer);
  }
}
