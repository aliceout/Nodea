import { describe, it, expect } from 'vitest';

import { normaliseForSearch } from './search';

describe('normaliseForSearch', () => {
  it('lowercases', () => {
    expect(normaliseForSearch('Ernaux')).toBe('ernaux');
    expect(normaliseForSearch('ÉRNAUX')).toBe('ernaux');
  });

  it('strips diacritics from FR / ES / EN combining marks', () => {
    expect(normaliseForSearch('Hôtel')).toBe('hotel');
    expect(normaliseForSearch('Café crème')).toBe('cafe creme');
    expect(normaliseForSearch('Mañana')).toBe('manana');
  });

  it('is idempotent — running it twice yields the same string', () => {
    const out = normaliseForSearch('Hôtel');
    expect(normaliseForSearch(out)).toBe(out);
  });

  it('preserves spaces and non-letter characters', () => {
    expect(normaliseForSearch('À deux pas — vol. 3')).toBe(
      'a deux pas — vol. 3',
    );
  });
});
