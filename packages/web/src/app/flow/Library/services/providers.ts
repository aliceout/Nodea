/**
 * External catalog providers for Library autofill.
 *
 * ⚠ Privacy — these endpoints are third-party, un-encrypted GETs. Hit
 * them only after the user opts in and understands that the search
 * term leaves the device. No history is persisted client-side either:
 * results are in-memory only.
 */
import type { LibraryItemPayload } from '@nodea/shared';

export interface ProviderSuggestion {
  provider: 'openlibrary' | 'googlebooks';
  external_id: string;
  title: string;
  creators: string[];
  year?: number;
  language?: string;
  cover_url?: string;
  type: LibraryItemPayload['type'];
}

/**
 * OpenLibrary search (books). Public endpoint, no API key required.
 */
export async function searchOpenLibrary(query: string, limit = 6): Promise<ProviderSuggestion[]> {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('OpenLibrary: ' + res.status);
  const body = (await res.json()) as {
    docs?: Array<{
      key?: string;
      title?: string;
      author_name?: string[];
      first_publish_year?: number;
      language?: string[];
      cover_i?: number;
    }>;
  };
  const docs = body.docs ?? [];
  return docs
    .filter((d) => d.title && d.key)
    .map<ProviderSuggestion>((d) => {
      const entry: ProviderSuggestion = {
        provider: 'openlibrary',
        external_id: String(d.key ?? ''),
        title: String(d.title ?? ''),
        creators: Array.isArray(d.author_name) ? d.author_name.slice(0, 5) : [],
        type: 'book',
      };
      if (d.first_publish_year != null) entry.year = d.first_publish_year;
      if (d.language && d.language.length > 0 && d.language[0]) entry.language = d.language[0];
      if (d.cover_i) entry.cover_url = `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`;
      return entry;
    });
}

/**
 * Google Books search. Public endpoint; without an API key we're
 * rate-limited but fine for a handful of queries.
 */
export async function searchGoogleBooks(query: string, limit = 6): Promise<ProviderSuggestion[]> {
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('GoogleBooks: ' + res.status);
  const body = (await res.json()) as {
    items?: Array<{
      id?: string;
      volumeInfo?: {
        title?: string;
        authors?: string[];
        publishedDate?: string;
        language?: string;
        imageLinks?: { thumbnail?: string; smallThumbnail?: string };
      };
    }>;
  };
  const items = body.items ?? [];
  return items
    .filter((v) => v.id && v.volumeInfo?.title)
    .map<ProviderSuggestion>((v) => {
      const vi = v.volumeInfo ?? {};
      const year = vi.publishedDate ? Number(vi.publishedDate.slice(0, 4)) : undefined;
      const cover = vi.imageLinks?.thumbnail ?? vi.imageLinks?.smallThumbnail;
      const entry: ProviderSuggestion = {
        provider: 'googlebooks',
        external_id: String(v.id ?? ''),
        title: String(vi.title ?? ''),
        creators: Array.isArray(vi.authors) ? vi.authors.slice(0, 5) : [],
        type: 'book',
      };
      if (year != null && !Number.isNaN(year)) entry.year = year;
      if (vi.language) entry.language = vi.language;
      if (cover) entry.cover_url = cover.replace(/^http:/, 'https:');
      return entry;
    });
}

/**
 * Router for a given provider — dispatches to the correct search
 * function and swallows its own errors into an empty list (the form
 * surfaces the error textually).
 */
export async function searchProvider(
  provider: ProviderSuggestion['provider'],
  query: string,
): Promise<ProviderSuggestion[]> {
  if (provider === 'openlibrary') return searchOpenLibrary(query);
  if (provider === 'googlebooks') return searchGoogleBooks(query);
  return [];
}
