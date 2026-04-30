import { describe, expect, it } from 'vitest';

import { en } from './locales/en.ts';
import { fr } from './locales/fr.ts';

/**
 * FR ↔ EN parity test — mirrors the web-side
 * `i18n/parity.test.ts`. Walks both locales as a tree of leaf
 * paths and asserts the key sets match.
 *
 * The FR side is canonical (DEFAULT_LANGUAGE in `i18n.ts`) ; an
 * EN-only key is a typo-style drift (the FR contract was edited
 * without updating EN). An FR-only key is a missing translation
 * — `emailT('en', …)` would silently fall back to FR at runtime,
 * making the EN inbox a half-translated mishmash. We catch both
 * here.
 */
function flattenKeys(bag: unknown, prefix = ''): string[] {
  if (!bag || typeof bag !== 'object') return prefix ? [prefix] : [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(bag as Record<string, unknown>)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') {
      out.push(...flattenKeys(v, next));
    } else {
      out.push(next);
    }
  }
  return out;
}

describe('email i18n parity (FR ↔ EN)', () => {
  it('FR and EN expose the same leaf-key set', () => {
    const frKeys = new Set(flattenKeys(fr));
    const enKeys = new Set(flattenKeys(en));
    const onlyFr = [...frKeys].filter((k) => !enKeys.has(k)).sort();
    const onlyEn = [...enKeys].filter((k) => !frKeys.has(k)).sort();
    expect(
      { fr_only: onlyFr, en_only: onlyEn },
      'email i18n drift :\n' +
        `  FR-only : ${onlyFr.length === 0 ? '∅' : onlyFr.join(', ')}\n` +
        `  EN-only : ${onlyEn.length === 0 ? '∅' : onlyEn.join(', ')}`,
    ).toEqual({ fr_only: [], en_only: [] });
  });
});
