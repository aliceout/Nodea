/**
 * Pure text-search helpers shared across module-level search bars
 * (Mood / Journal / Library — cf. issue #33 umbrella).
 *
 * The match is deliberately simple: case-insensitive, accent-
 * insensitive substring (`includes`). No regex (escape hassle, no
 * usable UX on a search field), no fuzzy ranking (overkill at the
 * volumes we deal with — a few thousand entries max per module).
 *
 * Decryption is the caller's job: by the time these helpers run we
 * already have cleartext payloads in memory (loaded via the module
 * provider). See issue #92 for the per-module wiring plan.
 */

// U+0300 – U+036F — Combining Diacritical Marks. Built once and
// reused, so we don't re-parse the regex on every call.
const COMBINING_MARKS = /[̀-ͯ]/g;

/** Normalise a string for case- and accent-insensitive comparison.
 *
 *  Decompose to NFD, strip the combining-mark block, lowercase.
 *  Non-Latin scripts (Greek, Cyrillic, CJK, Arabic) just round-trip
 *  through `toLowerCase()` — those scripts are out of scope for the
 *  search UX today, but the helper doesn't break on them. */
export function normalizeForSearch(value: string): string {
  return value.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
}

/** Returns `true` when the haystack contains every whitespace-
 *  separated token of the query (after normalisation). Empty query
 *  always matches — that's the "no filter" case the caller should
 *  short-circuit anyway, but keeping the contract here means the
 *  helper is safe to call unconditionally.
 *
 *  Multi-token AND match is intentional: typing « anouk plage »
 *  in the search field should retrieve entries that mention both
 *  words, in any order. */
export function matchesSearch(haystack: string, query: string): boolean {
  const normalisedQuery = normalizeForSearch(query).trim();
  if (normalisedQuery.length === 0) return true;
  const tokens = normalisedQuery.split(/\s+/);
  const normalisedHaystack = normalizeForSearch(haystack);
  return tokens.every((token) => normalisedHaystack.includes(token));
}

/** Convenience: returns `true` when at least one of the supplied
 *  fields contains every token of the query. Missing / empty
 *  fields are skipped silently — many module payloads have
 *  optional text fields (Mood `comment`, Journal `title`) and we
 *  don't want the caller to gate every field with a `?? ''`.
 *
 *  Tokens are AND-combined across the whole field set: a query
 *  « anouk plage » matches if « anouk » lives anywhere in the
 *  fields and « plage » lives anywhere too (possibly different
 *  fields).
 *
 *  NOTE — re-normalises the fields on every call. Fine for one-shot
 *  use ; on a list filter that runs per-keystroke over thousands of
 *  entries, precompute a haystack with `buildSearchHaystack` at map
 *  time and match with `matchesHaystack` instead (audit 2026-06
 *  passe 2 — search was the #2 lag source after un-virtualized
 *  lists). */
export function matchesAnyField(
  fields: ReadonlyArray<string | null | undefined>,
  query: string,
): boolean {
  const normalisedQuery = normalizeForSearch(query).trim();
  if (normalisedQuery.length === 0) return true;
  const tokens = normalisedQuery.split(/\s+/);
  const normalisedFields = fields
    .filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    )
    .map(normalizeForSearch);
  return tokens.every((token) =>
    normalisedFields.some((field) => field.includes(token)),
  );
}

// Field separator for precomputed haystacks. A normalised query
// token can never contain a newline (the query is whitespace-split),
// so joining fields with `\n` keeps the same "a token must live
// wholly inside one field" semantics `matchesAnyField` has — a token
// can't accidentally match across a field boundary.
const HAYSTACK_SEP = '\n';

/** Build the normalised search haystack for a record ONCE, at the
 *  point its entry is mapped from the decrypted payload. Stored on
 *  the entry (e.g. `searchHaystack`) and fed to `matchesHaystack` so
 *  the per-keystroke filter normalises only the (short) query, not
 *  every (long) field of every entry. */
export function buildSearchHaystack(
  fields: ReadonlyArray<string | null | undefined>,
): string {
  return fields
    .filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    )
    .map(normalizeForSearch)
    .join(HAYSTACK_SEP);
}

/** Match a query against a haystack already produced by
 *  `buildSearchHaystack` (i.e. already normalised). Only the query
 *  is normalised here. Multi-token AND, same contract as
 *  `matchesAnyField`. Empty query always matches. */
export function matchesHaystack(haystack: string, query: string): boolean {
  const normalisedQuery = normalizeForSearch(query).trim();
  if (normalisedQuery.length === 0) return true;
  const tokens = normalisedQuery.split(/\s+/);
  return tokens.every((token) => haystack.includes(token));
}
