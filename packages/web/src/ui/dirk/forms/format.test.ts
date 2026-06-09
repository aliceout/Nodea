import { describe, expect, it } from 'vitest';

import { countBy, normaliseAuthorName, shortLang } from './format';

describe('normaliseAuthorName', () => {
  it('returns empty on empty / whitespace input', () => {
    expect(normaliseAuthorName('')).toBe('');
    expect(normaliseAuthorName('   ')).toBe('');
  });

  it('uppercases mononyms', () => {
    expect(normaliseAuthorName('hugo')).toBe('HUGO');
    expect(normaliseAuthorName('  beyoncé  ')).toBe('BEYONCÉ');
  });

  it('uppercases the last token (default Firstname LASTNAME shape)', () => {
    expect(normaliseAuthorName('Victor Hugo')).toBe('Victor HUGO');
    expect(normaliseAuthorName('Cal Newport')).toBe('Cal NEWPORT');
  });

  it('flips when the first token is already in MAJUSCULES', () => {
    // « HUGO Victor » → « Victor HUGO »
    expect(normaliseAuthorName('HUGO Victor')).toBe('Victor HUGO');
    expect(normaliseAuthorName('NEWPORT Cal')).toBe('Cal NEWPORT');
  });

  it('handles multi-word firstnames + lastname', () => {
    expect(normaliseAuthorName('Jean Marie Le Pen')).toBe('Jean Marie Le PEN');
  });

  it('collapses internal whitespace runs', () => {
    expect(normaliseAuthorName('Victor    Hugo')).toBe('Victor HUGO');
    expect(normaliseAuthorName('Victor\tHugo')).toBe('Victor HUGO');
  });
});

describe('countBy', () => {
  it('counts each value, sorts descending', () => {
    const items = [
      { lang: 'fr' },
      { lang: 'en' },
      { lang: 'fr' },
      { lang: 'fr' },
      { lang: 'en' },
    ];
    const out = countBy(items, (i) => i.lang);
    expect(out).toEqual([
      { value: 'fr', count: 3 },
      { value: 'en', count: 2 },
    ]);
  });

  it('drops null / undefined extractions', () => {
    const items = [{ x: 'a' }, { x: null }, { x: undefined }, { x: 'a' }];
    const out = countBy(items, (i) => i.x);
    expect(out).toEqual([{ value: 'a', count: 2 }]);
  });

  it('returns [] on empty input', () => {
    expect(countBy([], (i) => i)).toEqual([]);
  });
});

describe('shortLang', () => {
  it('passes 2-letter BCP-47 codes through', () => {
    expect(shortLang('fr')).toBe('fr');
    expect(shortLang('en')).toBe('en');
  });

  it('strips region tags (fr-FR → fr)', () => {
    expect(shortLang('fr-FR')).toBe('fr');
    expect(shortLang('en_US')).toBe('en');
  });

  it('maps 3-letter MARC codes onto 2-letter BCP-47', () => {
    expect(shortLang('fre')).toBe('fr');
    expect(shortLang('eng')).toBe('en');
    expect(shortLang('spa')).toBe('es');
    expect(shortLang('jpn')).toBe('ja');
  });

  it('is case-insensitive', () => {
    expect(shortLang('FR')).toBe('fr');
    expect(shortLang('FRE')).toBe('fr');
  });

  it('returns null on garbage / empty input', () => {
    expect(shortLang(null)).toBe(null);
    expect(shortLang(undefined)).toBe(null);
    expect(shortLang('')).toBe(null);
    expect(shortLang('zzz')).toBe(null);
    expect(shortLang('123')).toBe(null);
  });
});
