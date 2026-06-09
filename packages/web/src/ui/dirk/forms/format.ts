/**
 * Pure helpers for the Composer's text / display surface. No
 * React, no I/O — testable in isolation.
 */

/**
 * Normalise an author input into the canonical « Firstname
 * LASTNAME » shape. Heuristic :
 *
 *   - Single token (« Hugo ») → uppercase the whole thing
 *     (« HUGO »). Mononyms stay all-caps so the grouper can
 *     spot them.
 *   - First token already in MAJUSCULES (« HUGO Victor ») →
 *     flip the order to « Victor HUGO ». The user typed it the
 *     « lastname-first » way and we re-canonicalise.
 *   - Default — last token is the lastname → uppercase only
 *     it. « Victor Hugo » → « Victor HUGO ».
 *
 * Whitespace runs (tabs, multiple spaces) collapse to single
 * spaces. Empty input returns empty.
 */
export function normaliseAuthorName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) return trimmed;
  const tokens = trimmed.split(' ');
  if (tokens.length === 1) return tokens[0]!.toLocaleUpperCase('fr');
  // Heuristic : if the first token is already in MAJUSCULES,
  // the user probably typed « HUGO Victor » — flip.
  const first = tokens[0]!;
  if (
    first === first.toLocaleUpperCase('fr') &&
    first !== first.toLocaleLowerCase('fr')
  ) {
    const rest = tokens.slice(1).join(' ');
    return `${rest} ${first}`;
  }
  // Default : last token = lastname → uppercase
  const last = tokens[tokens.length - 1]!;
  const rest = tokens.slice(0, -1).join(' ');
  return `${rest} ${last.toLocaleUpperCase('fr')}`;
}

/**
 * Count facet values across results (e.g. how many books per
 * language). Drops null/undefined extractions, returns
 * descending counts so the most-populated chip renders first.
 * Used to drive the filter chips below the lookup search bar.
 */
export function countBy<T, K>(
  items: ReadonlyArray<T>,
  pick: (item: T) => K | null | undefined,
): Array<{ value: K; count: number }> {
  const map = new Map<K, number>();
  for (const item of items) {
    const v = pick(item);
    if (v === null || v === undefined) continue;
    map.set(v, (map.get(v) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Normalise the various language codes providers spit out
 * (`fr`, `fre`, `fr-FR`, `eng`, `en`) into a 2-letter BCP 47
 * code for display + filtering. Returns null when the input
 * doesn't look like a language at all.
 */
export function shortLang(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const lc = raw.toLowerCase();
  // 3-letter MARC codes Open Library still returns sometimes
  const marcToBcp: Record<string, string> = {
    fre: 'fr',
    eng: 'en',
    spa: 'es',
    ger: 'de',
    ita: 'it',
    por: 'pt',
    jpn: 'ja',
    rus: 'ru',
  };
  if (marcToBcp[lc]) return marcToBcp[lc] ?? null;
  // BCP 47 like `fr-FR` → first two letters
  const m = /^([a-z]{2})(?:[-_].*)?$/.exec(lc);
  return m ? m[1]! : null;
}

/**
 * `Cmd+Enter` / `Ctrl+Enter` on an input or textarea fires
 * `onSubmit`. Same shortcut is wired everywhere a multi-line
 * textarea sits inside the Composer so the user can save
 * without reaching for the trackpad.
 */
export function submitOnCmdEnter(
  e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  onSubmit: () => void,
): void {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    onSubmit();
  }
}
