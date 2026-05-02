import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import {
  LibraryLookupByIsbnBodySchema,
  LibraryLookupByQueryBodySchema,
} from '@nodea/shared';
import { lookupByIsbn, streamLookupByQuery } from '../services/library-lookup/dispatcher.ts';
import { rateLimit } from '../middleware/rate-limit.ts';
import { requireUser, type AuthVariables } from '../middleware/require-user.ts';

/**
 * `/library/lookup/by-isbn` (one-shot JSON) and
 * `/library/lookup/by-query/stream` (NDJSON streaming) —
 * server-side proxy in front of the metadata providers (Open
 * Library, Google Books, BNF, Wikidata, BNE).
 *
 * Why a proxy:
 *   1. Hide the user's IP from the providers (only the Nodea
 *      instance's IP shows up across all users).
 *   2. Hold the Google Books API key (and any future paid keys)
 *      server-side instead of shipping them to the browser.
 *   3. Cache responses so a popular book isn't re-fetched for
 *      every user who adds it.
 *
 * Auth: `requireUser` — the proxy is for logged-in users only,
 * which lets the rate limiter key on user id (so one user can't
 * starve another sharing the same NAT egress IP).
 */
export const libraryLookupRoutes = new Hono<{ Variables: AuthVariables }>();

libraryLookupRoutes.use('*', requireUser);

const isbnLimiter = rateLimit({
  max: 30,
  windowMs: 60_000,
  keyPrefix: 'library-lookup-isbn',
});
const queryLimiter = rateLimit({
  max: 30,
  windowMs: 60_000,
  keyPrefix: 'library-lookup-query',
});
const coverLimiter = rateLimit({
  max: 60,
  windowMs: 60_000,
  keyPrefix: 'library-lookup-cover',
});

/**
 * Allowlisted host suffixes for the cover-fetch proxy. The proxy
 * blindly forwards to whatever the client passes, so without this
 * list it would be a generic SSRF gadget — anyone with a session
 * could probe internal IPs / metadata endpoints / arbitrary HTTP.
 *
 * Suffix-match (`endsWith`) so subdomains like `images-eu.ssl-...`
 * pass without needing one allowlist entry per region. We also
 * pin to HTTPS in the handler to cut off any http://localhost
 * smuggling.
 */
const COVER_HOST_ALLOWLIST: readonly string[] = [
  'covers.openlibrary.org',
  'books.google.com',
  'books.googleusercontent.com',
  'm.media-amazon.com',
  'images-na.ssl-images-amazon.com',
  'images-eu.ssl-images-amazon.com',
  'commons.wikimedia.org',
  'upload.wikimedia.org',
];

const COVER_MAX_BYTES = 5 * 1024 * 1024; // 5 MB — covers run 30-300 KB

libraryLookupRoutes.post('/by-isbn', isbnLimiter, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = LibraryLookupByIsbnBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  try {
    const response = await lookupByIsbn(parsed.data.isbn);
    return c.json(response);
  } catch (err) {
    console.error('[library-lookup] by-isbn error', err);
    return c.json({ error: 'lookup_failed' }, 502);
  }
});

/**
 * NDJSON streaming endpoint for free-text library lookups. The
 * client opens the connection, the server writes one JSON snapshot
 * per line as each provider settles, and the stream ends with a
 * final snapshot carrying `done: true`. Front-end uses fetch +
 * ReadableStream to consume incrementally — see
 * `streamLibraryLookupByQuery` in
 * `packages/web/src/core/api/client.ts`.
 *
 * The connection is kept open for ~the duration of the slowest
 * provider (Open Library can spike to 15 s); Hono's streaming
 * pipeline flushes each line through. The headers below disable
 * buffering on common reverse proxies (nginx, Cloud Run) so the
 * stream actually surfaces in real time.
 */
libraryLookupRoutes.post('/by-query/stream', queryLimiter, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = LibraryLookupByQueryBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  c.header('Content-Type', 'application/x-ndjson; charset=utf-8');
  // Disable buffering hints — some reverse proxies (nginx, Cloud
  // Run) hold streamed responses unless asked otherwise.
  c.header('Cache-Control', 'no-cache, no-transform');
  c.header('X-Accel-Buffering', 'no');
  return stream(c, async (s) => {
    try {
      for await (const snapshot of streamLookupByQuery(
        parsed.data.q,
        parsed.data.lang,
      )) {
        await s.write(`${JSON.stringify(snapshot)}\n`);
      }
    } catch (err) {
      console.error('[library-lookup] by-query/stream error', err);
      // Best-effort: try to surface the failure to the client as a
      // last NDJSON line. If the connection is already half-broken
      // this write will throw — swallow, the client will see EOF.
      const message = err instanceof Error ? err.message : String(err);
      try {
        await s.write(
          `${JSON.stringify({ results: [], queried: [], errored: [{ provider: 'openlibrary', message }], done: true })}\n`,
        );
      } catch {
        /* connection gone */
      }
    }
  });
});

/**
 * Cover image fetch proxy. Browsers can't `fetch().arrayBuffer()`
 * the provider URLs directly because OL / Google Books / Amazon
 * don't ship `Access-Control-Allow-Origin` headers (they only
 * permit `<img>` tag rendering). So the front asks us, we fetch
 * server-side, and we hand back base64 + MIME for the client to
 * encrypt and store as a `library_covers_entries` row.
 *
 * Security: the URL is checked against {@link COVER_HOST_ALLOWLIST}
 * — without the allowlist this would be a generic SSRF gadget
 * (any logged-in user could probe internal IPs / cloud metadata
 * endpoints / pull arbitrary HTTP through our box). We also pin
 * to HTTPS, cap the response at {@link COVER_MAX_BYTES}, and
 * refuse non-image MIME types.
 *
 * The blob *itself* never touches the database server-side: we
 * proxy bytes through to the client which encrypts them and posts
 * them back via the standard `library-covers` collection client.
 */
libraryLookupRoutes.get('/cover-fetch', coverLimiter, async (c) => {
  const url = c.req.query('url');
  if (typeof url !== 'string' || url.length === 0) {
    return c.json({ error: 'missing_url' }, 400);
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return c.json({ error: 'invalid_url' }, 400);
  }
  if (parsed.protocol !== 'https:') {
    return c.json({ error: 'https_required' }, 400);
  }
  const host = parsed.hostname.toLowerCase();
  const allowed = COVER_HOST_ALLOWLIST.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
  if (!allowed) {
    return c.json({ error: 'host_not_allowed' }, 403);
  }
  try {
    const upstream = await fetch(parsed.toString(), {
      // Some providers (Google Books) want a UA — they 403 anonymous
      // fetches. We don't impersonate a browser, just identify ourselves.
      headers: { 'User-Agent': 'Nodea/0.1 (library-cover-proxy)' },
      // 8 s is plenty for a cover image; longer than that is a
      // signal the provider is wedged.
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) {
      return c.json({ error: `upstream_${upstream.status}` }, 502);
    }
    const mime = upstream.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
    if (!mime.startsWith('image/')) {
      return c.json({ error: 'not_an_image' }, 415);
    }
    // Stream-read the body but cap at COVER_MAX_BYTES so a malicious
    // / misbehaving provider can't pin our memory by serving GBs.
    const reader = upstream.body?.getReader();
    if (!reader) return c.json({ error: 'no_body' }, 502);
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > COVER_MAX_BYTES) {
        await reader.cancel();
        return c.json({ error: 'too_large' }, 413);
      }
      chunks.push(value);
    }
    const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    const blobB64 = buffer.toString('base64');
    return c.json({ mime, blobB64 });
  } catch (err) {
    console.error('[library-lookup] cover-fetch error', err);
    return c.json({ error: 'fetch_failed' }, 502);
  }
});
