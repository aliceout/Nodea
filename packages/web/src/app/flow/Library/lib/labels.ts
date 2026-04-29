import type { LibraryItem } from './types';

/** FR display labels for ISO-639 language codes seen in book
 *  metadata. Used by the table / list views ; falls back to the raw
 *  code when unknown. */
export const LANGUAGE_LABEL: Record<string, string> = {
  fr: 'Français',
  en: 'Anglais',
  es: 'Espagnol',
  de: 'Allemand',
  it: 'Italien',
  pt: 'Portugais',
  jp: 'Japonais',
  ja: 'Japonais',
  zh: 'Chinois',
  ar: 'Arabe',
  ru: 'Russe',
  he: 'Hébreu',
};

/** Resolve a raw `item.language` code to a French label, falling
 *  back to the raw code if unknown. Empty / undefined → empty
 *  string so the caller can render `—` for missing values. */
export function languageLabel(code: string | undefined): string {
  if (!code) return '';
  return LANGUAGE_LABEL[code.toLowerCase()] ?? code;
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
