import type { LibraryItem, TranslateFn } from './types';

/** Resolve a raw `item.language` ISO-639 code to a localised label
 *  (`library.language.*` keys), falling back to the raw code when
 *  the code isn't in the dictionary. Empty / undefined → empty
 *  string so the caller can render `—` for missing values. Takes
 *  the caller's `t` so this stays a pure, hook-free helper. */
export function languageLabel(
  code: string | undefined,
  t: TranslateFn,
): string {
  if (!code) return '';
  const normalised = code.toLowerCase();
  return t(`library.language.${normalised}`, { defaultValue: code });
}

/** Author names joined by `, `. Honors `role: 'author'` or
 *  unspecified (the schema-default would always set it, but we
 *  defend against legacy records). Trimmed, empty entries
 *  filtered. */
export function authorsLabel(it: LibraryItem): string {
  return (
    it.creators
      ?.filter((c) => !c.role || c.role === 'author')
      .map((c) => c.name.trim())
      .filter(Boolean)
      .join(', ') ?? ''
  );
}
