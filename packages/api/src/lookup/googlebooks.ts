import type { NormalisedBook } from '@nodea/shared';
import type { ProviderAdapter } from './types.ts';
import { getConfig } from '../config.ts';
import { fetchWithTimeout } from './fetch-with-timeout.ts';
import { extractYear, normaliseAuthorName, normaliseIsbn } from './names.ts';

/**
 * Google Books adapter — uses the Volumes API.
 * https://developers.google.com/books/docs/v1/using
 *
 * Disabled when no API key is set (anonymous calls work but quotas
 * are extremely tight). The provider falls back gracefully — when
 * disabled it just returns empty arrays, the rest of the pipeline
 * stays happy.
 */
export const googleBooksAdapter: ProviderAdapter = {
  name: 'googlebooks',
  label: 'Google Books',
  needsKey: true,
  strictProbe: false,
  get enabled() {
    return Boolean(getConfig().LIBRARY_GOOGLE_BOOKS_API_KEY);
  },

  async byIsbn(isbn): Promise<NormalisedBook[]> {
    const { stripped } = normaliseIsbn(isbn);
    return runQuery(`isbn:${stripped}`);
  },

  async byQuery(query, lang): Promise<NormalisedBook[]> {
    // Free-text first. GB's default ranking weights titles + authors
    // together — usually fine, but for queries that *look* like a
    // person's name (Annie Ernaux, Tolkien…) the free-text scoring
    // tends to surface biographies / commentaries / "books about"
    // rather than books *by* the author. When the free-text run is
    // empty (often because `langRestrict` cut all the loosely-matched
    // results), fall back to the explicit `inauthor:"<q>"` operator
    // which targets the author field directly. Two round-trips at
    // most, only when the cheap path failed.
    const free = await runQuery(query, lang);
    if (free.length > 0) return free;
    return runQuery(`inauthor:"${query.replace(/"/g, '')}"`, lang);
  },
};

async function runQuery(q: string, lang?: string): Promise<NormalisedBook[]> {
  const key = getConfig().LIBRARY_GOOGLE_BOOKS_API_KEY;
  if (!key) return [];
  // `langRestrict`: hard-filter at the source when the user picked a
  // language pre-search. Without it, GB ranks globally (heavy EN
  // bias) and the dispatcher's downstream filter ends up dropping
  // most of the response. Restricting at the API saves bandwidth
  // and gives us 10 in-language hits instead of 10 mostly-EN ones.
  // No-op when `lang` is missing (ISBN lookup path).
  // maxResults=40 is GB's hard cap per request. Going wide here
  // helps prolific authors — after `langRestrict` cuts non-FR
  // hits, dedupe by ISBN, and the dispatcher's final slice(0, 30),
  // we still want enough material upstream to fill the response.
  const params = new URLSearchParams({ q, key, maxResults: '40', printType: 'books' });
  if (lang) {
    params.set('langRestrict', lang.slice(0, 2).toLowerCase());
  }
  const res = await fetchWithTimeout(`https://www.googleapis.com/books/v1/volumes?${params}`, {
    headers: { 'User-Agent': 'Nodea/0.1 (library-lookup)' },
    timeoutMs: 6000,
  });
  if (res.status === 429) return [];
  if (!res.ok) {
    // Distinguish "key configured but rejected" from generic outage.
    // Google returns 400 with a JSON error body that names the
    // reason — `keyInvalid`, `keyExpired`, `dailyLimitExceeded`,
    // `accessNotConfigured` (Books API not enabled in the project).
    // Surfacing the verbatim message lets the admin "Sources" tab
    // show something actionable.
    if (res.status === 400 || res.status === 403) {
      const body = (await res.json().catch(() => null)) as
        | { error?: { message?: string; errors?: { reason?: string }[] } }
        | null;
      const reason = body?.error?.errors?.[0]?.reason;
      const message = body?.error?.message;
      if (reason || message) {
        throw new Error(`Google Books — ${reason ?? message}`);
      }
    }
    throw new Error(`googlebooks ${res.status}`);
  }
  const data = (await res.json()) as GoogleBooksRaw;
  return (data.items ?? []).map(volumeToNormalised);
}

/* ---- Raw shapes (only what we use) ----------------------------- */

interface GoogleBooksRaw {
  items?: GoogleBookVolume[];
}

interface GoogleBookVolume {
  id?: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publishedDate?: string;
    publisher?: string;
    language?: string;
    description?: string;
    industryIdentifiers?: { type: string; identifier: string }[];
    imageLinks?: {
      smallThumbnail?: string;
      thumbnail?: string;
      small?: string;
      medium?: string;
      large?: string;
    };
  };
}

function volumeToNormalised(volume: GoogleBookVolume): NormalisedBook {
  const info = volume.volumeInfo ?? {};
  const isbn13 =
    info.industryIdentifiers?.find((i) => i.type === 'ISBN_13')?.identifier ?? null;
  const isbn10 =
    info.industryIdentifiers?.find((i) => i.type === 'ISBN_10')?.identifier ?? null;
  // Google's image links are HTTP for legacy reasons — force HTTPS so
  // the front-end (and our cover proxy later) doesn't run into
  // mixed-content warnings.
  const rawCover =
    info.imageLinks?.large ??
    info.imageLinks?.medium ??
    info.imageLinks?.thumbnail ??
    info.imageLinks?.small ??
    info.imageLinks?.smallThumbnail ??
    null;
  const coverUrl = rawCover ? rawCover.replace(/^http:\/\//, 'https://') : null;

  return {
    title: info.title ?? '(sans titre)',
    creators: (info.authors ?? []).map((raw) => ({
      name: normaliseAuthorName(raw),
      role: 'author',
    })),
    year: extractYear(info.publishedDate ?? null),
    language: info.language ?? null,
    original_language: null,
    publisher: info.publisher ?? null,
    collection: null,
    summary: info.description ?? null,
    isbn13: isbn13 ? isbn13.replace(/[-\s]/g, '') : null,
    isbn10: isbn10 ? isbn10.replace(/[-\s]/g, '') : null,
    format: null,
    series: null,
    cover_url: coverUrl,
    providers: volume.id ? { googlebooks: volume.id } : {},
    source: 'googlebooks',
  };
}
