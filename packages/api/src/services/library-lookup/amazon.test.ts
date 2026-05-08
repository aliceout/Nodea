import { describe, expect, it } from 'vitest';

import { pickAmazonTld } from './amazon.ts';

/** Tests for the language-driven TLD picker added by issue #38. */
describe('pickAmazonTld', () => {
  it('falls back to .com when no language hint is supplied', () => {
    expect(pickAmazonTld(undefined)).toBe('com');
    expect(pickAmazonTld('')).toBe('com');
  });

  it('maps the major European languages to their marketplaces', () => {
    expect(pickAmazonTld('fr')).toBe('fr');
    expect(pickAmazonTld('es')).toBe('es');
    expect(pickAmazonTld('de')).toBe('de');
    expect(pickAmazonTld('it')).toBe('it');
    expect(pickAmazonTld('nl')).toBe('nl');
    expect(pickAmazonTld('pl')).toBe('pl');
  });

  it('maps Japanese to .co.jp', () => {
    expect(pickAmazonTld('ja')).toBe('co.jp');
  });

  it('maps English variants to .com (no UK/US split)', () => {
    expect(pickAmazonTld('en')).toBe('com');
    expect(pickAmazonTld('en-US')).toBe('com');
    expect(pickAmazonTld('en-GB')).toBe('com');
  });

  it('prefix-matches BCP-47 regional variants', () => {
    expect(pickAmazonTld('fr-CA')).toBe('fr');
    expect(pickAmazonTld('fr-BE')).toBe('fr');
    expect(pickAmazonTld('es-MX')).toBe('es');
    expect(pickAmazonTld('de-AT')).toBe('de');
  });

  it('is case-insensitive on the prefix', () => {
    expect(pickAmazonTld('FR')).toBe('fr');
    expect(pickAmazonTld('Es-mx')).toBe('es');
  });

  it('falls back to .com for languages without a clearly-aligned marketplace', () => {
    expect(pickAmazonTld('zh')).toBe('com'); // no amazon.cn marketplace
    expect(pickAmazonTld('ko')).toBe('com');
    expect(pickAmazonTld('ru')).toBe('com');
    expect(pickAmazonTld('ar')).toBe('com');
  });
});
