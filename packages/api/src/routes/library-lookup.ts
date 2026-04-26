import { Hono } from 'hono';
import {
  LibraryLookupByIsbnBodySchema,
  LibraryLookupByQueryBodySchema,
} from '@nodea/shared';
import { lookupByIsbn, lookupByQuery } from '../lookup/dispatcher.ts';
import { rateLimit } from '../middleware/rate-limit.ts';
import { requireUser, type AuthVariables } from '../middleware/require-user.ts';

/**
 * `/library/lookup/by-isbn` and `/library/lookup/by-query` —
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

libraryLookupRoutes.post('/by-query', queryLimiter, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = LibraryLookupByQueryBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  try {
    const response = await lookupByQuery(parsed.data.q, parsed.data.lang);
    return c.json(response);
  } catch (err) {
    console.error('[library-lookup] by-query error', err);
    return c.json({ error: 'lookup_failed' }, 502);
  }
});
