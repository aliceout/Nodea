/**
 * Tests for the HRT export CSV serialiser — RFC 4180 quoting, CRLF line
 * endings, and the UTF-8 BOM that lets Excel read accented names.
 * `downloadTextFile` is a thin DOM side-effect (Blob + anchor) and isn't
 * unit-tested here.
 */
import { describe, expect, it } from 'vitest';

import { toCsv } from './csv';

const BOM = '﻿';

describe('toCsv', () => {
  it('prefixes a UTF-8 BOM and joins rows with CRLF', () => {
    const out = toCsv([
      ['Date', 'Valeur'],
      ['2026-06-01', 100],
    ]);
    expect(out.startsWith(BOM)).toBe(true);
    expect(out).toBe(`${BOM}Date,Valeur\r\n2026-06-01,100`);
  });

  it('quotes fields containing a comma, quote or newline and doubles quotes', () => {
    const out = toCsv([['a,b', 'he said "hi"', 'line1\nline2', 'plain']]);
    expect(out).toBe(`${BOM}"a,b","he said ""hi""","line1\nline2",plain`);
  });

  it('leaves simple fields and numbers unquoted', () => {
    expect(toCsv([['Estradiol', 0.4]])).toBe(`${BOM}Estradiol,0.4`);
  });

  it('preserves accented characters verbatim (the BOM handles the encoding)', () => {
    expect(toCsv([['Œstradiol', 'µg/L']])).toBe(`${BOM}Œstradiol,µg/L`);
  });
});
