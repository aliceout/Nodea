import { describe, expect, it } from 'vitest';

import { translate, translatePlural, type Resources } from './translate.ts';

const RESOURCES: Resources = {
  fr: {
    mood: {
      passkey: {
        countOne: '{count} passkey enregistrée.',
        countOther: '{count} passkeys enregistrées.',
      },
      entries: {
        one: '{count} entrée',
        other: '{count} entrées',
      },
      plain: '{count} chose',
    },
    common: {
      hi: 'Bonjour {name}',
    },
  },
  en: {
    mood: {
      passkey: {
        countOne: '{count} passkey registered.',
        countOther: '{count} passkeys registered.',
      },
      entries: {
        one: '{count} entry',
        other: '{count} entries',
      },
    },
    common: {
      // intentionally missing `hi` to assert FR fallback
    },
  },
  ru: {
    items: {
      // 4-form Russian plural set (one / few / many / other)
      one: '{count} item',
      few: '{count} items (few)',
      many: '{count} items (many)',
      other: '{count} items',
    },
  },
};

describe('translate', () => {
  it('looks up a dotted path', () => {
    expect(translate(RESOURCES, 'fr', 'common.hi', { values: { name: 'Alice' } }))
      .toBe('Bonjour Alice');
  });

  it('falls back to the default language when missing', () => {
    expect(translate(RESOURCES, 'en', 'common.hi', { values: { name: 'Alice' } }))
      .toBe('Bonjour Alice');
  });

  it('returns defaultValue when both sides miss', () => {
    expect(
      translate(RESOURCES, 'fr', 'mood.nope', { defaultValue: 'fallback' }),
    ).toBe('fallback');
  });

  it('returns the key when no defaultValue and no entry', () => {
    expect(translate(RESOURCES, 'fr', 'mood.unknown')).toBe('mood.unknown');
  });

  it('interpolates {tokens}', () => {
    expect(
      translate(RESOURCES, 'fr', 'mood.entries.one', { values: { count: 1 } }),
    ).toBe('1 entrée');
  });

  it('leaves placeholders intact when no values are provided', () => {
    // No `values` argument → interpolation skipped entirely. This
    // is on purpose : without values, treating `{name}` as missing
    // would silently lose the surface for callers that just want
    // the raw template.
    expect(translate(RESOURCES, 'fr', 'common.hi')).toBe('Bonjour {name}');
  });

  it('replaces a missing token with empty string when values are provided', () => {
    expect(translate(RESOURCES, 'fr', 'common.hi', { values: {} })).toBe(
      'Bonjour ',
    );
  });
});

describe('translatePlural', () => {
  it('picks .one for FR count 1', () => {
    expect(translatePlural(RESOURCES, 'fr', 'mood.entries', 1)).toBe('1 entrée');
  });

  it('picks .other for FR count 0', () => {
    // FR rule: 0 → "one" (zéro entrée, not zéro entrées). Spec choice.
    expect(translatePlural(RESOURCES, 'fr', 'mood.entries', 0)).toBe('0 entrée');
  });

  it('picks .other for FR count 5', () => {
    expect(translatePlural(RESOURCES, 'fr', 'mood.entries', 5)).toBe('5 entrées');
  });

  it('picks .one for EN count 1', () => {
    expect(translatePlural(RESOURCES, 'en', 'mood.entries', 1)).toBe('1 entry');
  });

  it('picks .other for EN count 0', () => {
    // EN rule: 0 → "other".
    expect(translatePlural(RESOURCES, 'en', 'mood.entries', 0)).toBe('0 entries');
  });

  it('picks .other for EN count 5', () => {
    expect(translatePlural(RESOURCES, 'en', 'mood.entries', 5)).toBe('5 entries');
  });

  it('hands non-1/non-other custom suffix keys (countOne/countOther) is NOT auto-resolved', () => {
    // The helper expects `.one` / `.other` exactly. The legacy
    // `countOne` / `countOther` keys (used by the i18n migration
    // before tn() landed) DO NOT match the rule names. Caller-side
    // migration is required.
    expect(translatePlural(RESOURCES, 'fr', 'mood.passkey.count', 1))
      .toBe('mood.passkey.count');
  });

  it('falls back to .other when the exact rule sub-key is missing', () => {
    // FR has no `.few` ; rule "other" is the fallback in our
    // resolution chain (3rd parameter).
    const limited: Resources = {
      fr: { test: { items: { other: '{count} items (default)' } } },
    };
    expect(translatePlural(limited, 'fr', 'test.items', 5))
      .toBe('5 items (default)');
  });

  it('falls back to a flat string when no .one/.other split exists', () => {
    expect(translatePlural(RESOURCES, 'fr', 'mood.plain', 7)).toBe('7 chose');
  });

  it('uses Intl.PluralRules : RU "few" form for count 22', () => {
    // 22 → "few" in Russian (22 % 10 === 2 and not 12).
    expect(translatePlural(RESOURCES, 'ru', 'items', 22)).toBe('22 items (few)');
  });

  it('uses Intl.PluralRules : RU "many" form for count 5', () => {
    expect(translatePlural(RESOURCES, 'ru', 'items', 5)).toBe('5 items (many)');
  });

  it('lets values override the auto-injected count', () => {
    expect(
      translatePlural(RESOURCES, 'fr', 'mood.entries', 5, {
        values: { count: 'cinq' },
      }),
    ).toBe('cinq entrées');
  });
});
