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
    return runQuery(query, lang);
  },
};

async function runQuery(q: string, lang?: string): Promise<NormalisedBook[]> {
  const key = getConfig().LIBRARY_GOOGLE_BOOKS_API_KEY;
  if (!key) return [];
  const params = new URLSearchParams({ q, key, maxResults: '10', printType: 'books' });
  if (lang) params.set('langRestrict', lang.slice(0, 2));
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
  return (data.items ?? []).slice(0, 10).map(volumeToNormalised);
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
    pageCount?: number;
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
    page_count:
      typeof info.pageCount === 'number' && info.pageCount > 0
        ? info.pageCount
        : null,
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
