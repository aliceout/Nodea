import { describe, expect, it } from 'vitest';

import { filterByLangCompat } from './dispatcher.ts';
import type { ProviderAdapter } from './types.ts';

/** Tests for the language-restriction filter added by issue #38.
 *  Mock adapters keep the test free of real network or DB
 *  dependencies — `filterByLangCompat` only inspects
 *  `restrictsToLang`, the rest of the shape is irrelevant. */

function makeAdapter(
  name: string,
  restrictsToLang?: string,
): ProviderAdapter {
  return {
    name: name as ProviderAdapter['name'],
    label: name,
    enabled: true,
    needsKey: false,
    strictProbe: false,
    ...(restrictsToLang ? { restrictsToLang } : {}),
    byIsbn: async () => [],
    byQuery: async () => [],
  };
}

describe('filterByLangCompat', () => {
  const ol = makeAdapter('openlibrary');
  const gb = makeAdapter('googlebooks');
  const bnf = makeAdapter('bnf');
  const bne = makeAdapter('bne', 'es');
  const all = [ol, gb, bnf, bne];

  it('keeps every adapter when no language hint is supplied', () => {
    expect(filterByLangCompat(all, undefined).map((a) => a.name)).toEqual([
      'openlibrary',
      'googlebooks',
      'bnf',
      'bne',
    ]);
    expect(filterByLangCompat(all, '').map((a) => a.name)).toEqual([
      'openlibrary',
      'googlebooks',
      'bnf',
      'bne',
    ]);
  });

  it('drops a restricted adapter when its language does not match', () => {
    expect(filterByLangCompat(all, 'fr').map((a) => a.name)).toEqual([
      'openlibrary',
      'googlebooks',
      'bnf',
    ]);
    expect(filterByLangCompat(all, 'en').map((a) => a.name)).toEqual([
      'openlibrary',
      'googlebooks',
      'bnf',
    ]);
  });

  it('keeps a restricted adapter when its language matches', () => {
    expect(filterByLangCompat(all, 'es').map((a) => a.name)).toEqual([
      'openlibrary',
      'googlebooks',
      'bnf',
      'bne',
    ]);
  });

  it('matches BCP-47 regional variants by prefix', () => {
    expect(filterByLangCompat(all, 'es-MX').map((a) => a.name)).toContain(
      'bne',
    );
    expect(filterByLangCompat(all, 'es-ES').map((a) => a.name)).toContain(
      'bne',
    );
    expect(filterByLangCompat(all, 'fr-CA').map((a) => a.name)).not.toContain(
      'bne',
    );
  });

  it('is case-insensitive on the language prefix', () => {
    expect(filterByLangCompat(all, 'ES').map((a) => a.name)).toContain('bne');
    expect(filterByLangCompat(all, 'Es-mx').map((a) => a.name)).toContain(
      'bne',
    );
  });

  it('preserves adapter order from the input array', () => {
    const input = [bne, ol, bnf];
    expect(filterByLangCompat(input, 'es').map((a) => a.name)).toEqual([
      'bne',
      'openlibrary',
      'bnf',
    ]);
  });
});
