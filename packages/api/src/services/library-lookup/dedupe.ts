import type { NormalisedBook } from '@nodea/shared';

import { mergeOnce } from './merge.ts';

/**
 * Dedupe books across providers using *all* identity tokens at
 * once (ISBN-13, ISBN-10, normalised title+first-author). The old
 * approach picked a single key per book — XOR semantics — which
 * meant a record carrying ISBN-X and a tag-less record with the
 * same title+author landed in different groups and stayed split.
 * Now that more providers (OL with `fields=*`, GB) expose ISBNs
 * reliably, the cross-record overlap is more common and worth
 * collapsing.
 *
 * Algorithm: each book contributes a list of tokens. Two books
 * are the same iff they share at least one token. We merge groups
 * iteratively until no two share a token (small N — at most a
 * couple hundred records — so the O(N²) worst case is fine).
 *
 * Insertion order of the *first* contributor of each group is
 * preserved, so the per-provider priority set by `reorderForLang`
 * still drives which row appears at the top.
 */
export function dedupeAcrossProviders(books: NormalisedBook[]): NormalisedBook[] {
  type Group = { tokens: Set<string>; books: NormalisedBook[] };
  const groups: Group[] = [];

  for (const book of books) {
    const tokens = identityTokens(book);
    if (tokens.length === 0) {
      // Pathological: no title, no isbn — keep as its own group so
      // we don't accidentally fold it into an unrelated record.
      groups.push({ tokens: new Set(), books: [book] });
      continue;
    }
    const matches: number[] = [];
    for (let i = 0; i < groups.length; i += 1) {
      const g = groups[i]!;
      if (tokens.some((t) => g.tokens.has(t))) {
        matches.push(i);
      }
    }
    if (matches.length === 0) {
      groups.push({ tokens: new Set(tokens), books: [book] });
      continue;
    }
    // Fold the new book + any extra matched groups into the first
    // matching group. This handles the bridge case: book A has
    // token X, book B has token Y, book C has tokens X+Y → C
    // should merge A's and B's groups together.
    const target = groups[matches[0]!]!;
    for (const t of tokens) target.tokens.add(t);
    target.books.push(book);
    if (matches.length > 1) {
      // Walk extras in reverse to splice safely.
      for (let i = matches.length - 1; i >= 1; i -= 1) {
        const idx = matches[i]!;
        const extra = groups[idx]!;
        for (const t of extra.tokens) target.tokens.add(t);
        target.books.push(...extra.books);
        groups.splice(idx, 1);
      }
    }
  }

  const out: NormalisedBook[] = [];
  for (const g of groups) {
    const merged = mergeOnce(g.books);
    if (merged) out.push(merged);
  }
  return out;
}

/**
 * Identity tokens used by the dedupe — every token a record would
 * "claim". Two records sharing any token are the same book.
 *
 * Title normalisation: lowercase + collapse whitespace + strip
 * trailing edition tags (`(English Edition)`, `(Édition de poche)`,
 * `(Folio classique)`) so the same book sold under multiple
 * editions on Amazon doesn't split. We don't strip aggressively
 * (no diacritic folding, no punctuation removal) — being too
 * lenient would conflate genuinely different titles.
 */
function identityTokens(book: NormalisedBook): string[] {
  const tokens: string[] = [];
  if (book.isbn13) tokens.push(`isbn13:${book.isbn13}`);
  if (book.isbn10) tokens.push(`isbn10:${book.isbn10}`);
  const author = book.creators[0]?.name?.toLocaleLowerCase('fr').trim() ?? '';
  const title = book.title
    .toLocaleLowerCase('fr')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (title) tokens.push(`ta:${title}|${author}`);
  return tokens;
}

/**
 * Drop books whose `language` is set and different from `lang`.
 * Books with `language === null` are kept on purpose — providers
 * don't tag every record (niche / academic editions especially),
 * and dropping nulls would over-prune the result set. If a kept
 * `null`-language record turns out to be in another language, the
 * user can re-search.
 *
 * No-op when `lang` is missing — that path is reserved for ISBN
 * lookups (where the code is unambiguous and language doesn't
 * gate the result).
 *
 * `lang` is normalised to its 2-letter prefix so `fr-FR` and `fr`
 * both compare equal. Books carry their own language as a 2-letter
 * BCP-47 code set by the adapters.
 */
export function filterByLanguage(books: NormalisedBook[], lang?: string): NormalisedBook[] {
  if (!lang) return books;
  const target = lang.slice(0, 2).toLowerCase();
  if (!target) return books;
  return books.filter((b) => {
    if (!b.language) return true;
    return b.language.slice(0, 2).toLowerCase() === target;
  });
}
