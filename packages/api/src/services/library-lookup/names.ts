/**
 * Normalise an author/creator name to the Library convention:
 * `<Prénom> <NOM en MAJUSCULES>` (decision documented 2026-04-26
 * in `documentation/Modules/Library.md` §3.1).
 *
 * Heuristic — mirrors the front-end `normaliseAuthorName` so the
 * server and client agree on the canonical form:
 *   - Empty/whitespace-only → "" (caller drops it).
 *   - Single token → uppercased.
 *   - First token is already in MAJUSCULES (Babelio-style "HUGO Victor")
 *     → flip to "Victor HUGO".
 *   - Otherwise → assume the last token is the lastname, uppercase it.
 *
 * Edge cases (compound surnames, particles, family-name-first East
 * Asian conventions) get the simple heuristic and may be wrong;
 * surfaced in the import preview UI for manual fixup.
 */
export function normaliseAuthorName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  const tokens = trimmed.split(' ');
  if (tokens.length === 1) return tokens[0]!.toLocaleUpperCase('fr');
  const first = tokens[0]!;
  if (
    first === first.toLocaleUpperCase('fr') &&
    first !== first.toLocaleLowerCase('fr')
  ) {
    return `${tokens.slice(1).join(' ')} ${first}`;
  }
  const last = tokens[tokens.length - 1]!;
  const rest = tokens.slice(0, -1).join(' ');
  return `${rest} ${last.toLocaleUpperCase('fr')}`;
}

/**
 * Normalise an ISBN by stripping spaces / hyphens. Returns the
 * stripped string and a `kind` tag indicating whether it's a
 * 10-digit, 13-digit, or unknown-shaped identifier.
 */
export function normaliseIsbn(raw: string): {
  stripped: string;
  kind: 'isbn10' | 'isbn13' | 'unknown';
} {
  const stripped = raw.replace(/[\s-]/g, '').toUpperCase();
  if (/^\d{13}$/.test(stripped)) return { stripped, kind: 'isbn13' };
  if (/^\d{9}[\dX]$/.test(stripped)) return { stripped, kind: 'isbn10' };
  return { stripped, kind: 'unknown' };
}

/**
 * Pull the year out of a date string. Tolerates the shapes the
 * various providers return: "1862", "1862-01-06", "January 1862",
 * "[1862]". Returns null when nothing 4-digit looking is found.
 */
export function extractYear(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const match = raw.match(/(\d{4})/);
  if (!match) return null;
  const year = Number(match[1]);
  if (year < 1000 || year > 2100) return null;
  return year;
}
