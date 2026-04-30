/**
 * Recursive key comparison between two translation namespaces.
 *
 * The provider resolves dotted paths (`namespace.section.key`),
 * so parity is about *the set of leaf paths* — not just top-level
 * keys. A namespace where one side carries `passkey.count.one /
 * other` and the other only carries `passkey.count` would silently
 * drop pluralisation under one locale ; this helper catches that.
 *
 * Both leaf strings (translations) and leaf arrays (legacy /
 * editorial data — none in the namespaces today, but the helper
 * stays robust) are treated as terminal. Objects are descended.
 *
 * Used by :
 *   - `i18n.parity.test.ts` (fail CI on drift)
 *   - `scripts/i18n-diff.ts` (`pnpm i18n:diff` — operator-friendly)
 */

export type Bag = Record<string, unknown>;

/** Walk `bag` and return every leaf path joined with `.`. A leaf
 *  is anything that's NOT a plain object (strings, numbers,
 *  booleans, null, arrays). The order is the natural property-
 *  enumeration order of the bag. */
export function flattenKeys(bag: Bag, prefix = ''): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(bag)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      out.push(...flattenKeys(value as Bag, path));
    } else {
      out.push(path);
    }
  }
  return out;
}

export interface ParityReport {
  /** Keys present in `a` but not in `b`. */
  onlyInA: string[];
  /** Keys present in `b` but not in `a`. */
  onlyInB: string[];
}

/** Compute the set difference of leaf-key paths between two
 *  namespaces. Returns `{ onlyInA, onlyInB }` ; both arrays are
 *  empty when the two sides match. Caller chooses what to do
 *  with the report — fail a test, print a CLI diff, etc. */
export function compareNamespaces(a: Bag, b: Bag): ParityReport {
  const aKeys = new Set(flattenKeys(a));
  const bKeys = new Set(flattenKeys(b));
  const onlyInA: string[] = [];
  const onlyInB: string[] = [];
  for (const k of aKeys) if (!bKeys.has(k)) onlyInA.push(k);
  for (const k of bKeys) if (!aKeys.has(k)) onlyInB.push(k);
  onlyInA.sort();
  onlyInB.sort();
  return { onlyInA, onlyInB };
}
