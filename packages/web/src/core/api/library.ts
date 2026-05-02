import {
  LibraryLookupResponseSchema,
  LibraryLookupStreamSnapshotSchema,
  type LibraryLookupByIsbnBody,
  type LibraryLookupByQueryBody,
  type LibraryLookupResponse,
  type LibraryLookupStreamSnapshot,
} from '@nodea/shared';

import { apiBase, isRecord, request, safeJson, type ApiError } from './internal.ts';

export async function apiLibraryLookupByIsbn(
  body: LibraryLookupByIsbnBody,
): Promise<LibraryLookupResponse> {
  return request(
    'POST',
    '/library/lookup/by-isbn',
    body,
    LibraryLookupResponseSchema,
  );
}

export interface LibraryCoverFetchResult {
  mime: string;
  /** Base64 (no `data:` prefix) of the raw image bytes. */
  blobB64: string;
}

/**
 * Fetch a cover image via the server-side proxy. Browsers can't
 * directly `fetch().arrayBuffer()` cover URLs because OL / Google
 * Books / Amazon don't expose CORS for arbitrary fetches (only
 * `<img>` tag loading). The proxy validates the URL against an
 * allowlist of provider hosts, downloads the bytes server-side,
 * and hands them back as `{ mime, blobB64 }`.
 *
 * Returns `null` on any failure (provider 404, host not allowed,
 * timeout, oversized, network error). The caller treats a missing
 * cover as non-fatal — the book still gets saved.
 */
export async function apiLibraryFetchCover(
  url: string,
): Promise<LibraryCoverFetchResult | null> {
  try {
    const raw = await request<unknown>(
      'GET',
      `/library/lookup/cover-fetch?url=${encodeURIComponent(url)}`,
    );
    if (
      isRecord(raw) &&
      typeof raw.mime === 'string' &&
      typeof raw.blobB64 === 'string'
    ) {
      return { mime: raw.mime, blobB64: raw.blobB64 };
    }
    return null;
  } catch {
    // Cover failures are non-blocking: we never want a broken
    // provider URL to stop the user from saving their book.
    return null;
  }
}

export interface StreamLibraryLookupOptions {
  /** Called for every NDJSON snapshot the server emits, including the
   * final one (where `done === true`). The list contains the *current*
   * accumulated, deduped, language-filtered results — the consumer
   * should replace its render list, not append. */
  onSnapshot: (snapshot: LibraryLookupStreamSnapshot) => void;
  /** Allows the caller to abort an in-flight stream — typically when
   * the user kicks off a fresh search before the previous one
   * finished. The fetch is cancelled, the reader stops. */
  signal?: AbortSignal;
}

/**
 * Free-text library lookup via the NDJSON streaming endpoint.
 * Opens an NDJSON connection and invokes `onSnapshot` for every
 * line the server emits.
 *
 * Implementation notes:
 *   - Uses `fetch` + `ReadableStream` (no EventSource — that would
 *     force GET, and we want POST with a JSON body).
 *   - Lines are split on `\n`; partial trailing data is buffered
 *     across reads. Empty lines are tolerated.
 *   - Each line is `JSON.parse`d and validated with the shared Zod
 *     schema; malformed lines are skipped with a console warning so
 *     a single bad chunk doesn't kill the whole stream.
 *   - Resolves when the stream ends (server signalled `done` and
 *     closed). Rejects with an `ApiError` on non-2xx response, or
 *     with the underlying error on network failure / abort.
 */
export async function streamLibraryLookupByQuery(
  body: LibraryLookupByQueryBody,
  opts: StreamLibraryLookupOptions,
): Promise<void> {
  const init: RequestInit = {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
  // Only attach `signal` when present — `exactOptionalPropertyTypes`
  // forbids `signal: undefined` against the DOM's `signal: AbortSignal | null` shape.
  if (opts.signal) init.signal = opts.signal;
  const res = await fetch(`${apiBase()}/library/lookup/by-query/stream`, init);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const payload: unknown = text ? safeJson(text) : null;
    const err: ApiError = {
      status: res.status,
      error:
        isRecord(payload) && typeof payload.error === 'string'
          ? payload.error
          : res.statusText,
    };
    throw err;
  }

  if (!res.body) {
    throw new Error('streamLibraryLookupByQuery: no response body');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl = buffer.indexOf('\n');
      while (nl !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (line) {
          try {
            const parsed = LibraryLookupStreamSnapshotSchema.parse(JSON.parse(line));
            opts.onSnapshot(parsed);
          } catch (parseErr) {
            console.warn('streamLibraryLookupByQuery: skipping bad chunk', parseErr);
          }
        }
        nl = buffer.indexOf('\n');
      }
    }
  } finally {
    reader.releaseLock();
  }
}
