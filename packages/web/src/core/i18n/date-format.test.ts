import { describe, expect, it } from 'vitest';

import {
  formatEntryLabel,
  formatLongDate,
  formatMonthLabel,
  formatNumber,
  formatPartialDate,
  intlLocale,
  parseLocalDate,
  toIsoDate,
  type EntryLabelOptions,
} from './date-format';

const TODAY = new Date(2026, 2, 15); // 15 mars 2026, midi local

const FR_LABELS: EntryLabelOptions = {
  language: 'fr',
  todayLabel: 'Aujourd’hui',
  yesterdayLabel: 'Hier',
};

const EN_LABELS: EntryLabelOptions = {
  language: 'en',
  todayLabel: 'Today',
  yesterdayLabel: 'Yesterday',
};

describe('parseLocalDate', () => {
  it('reads YYYY-MM-DD as local midnight', () => {
    const d = parseLocalDate('2026-03-15');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(0);
  });

  it('tolerates trailing time / timezone suffixes', () => {
    const d = parseLocalDate('2026-03-15T08:42:00Z');
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(0);
  });

  it('returns Invalid Date on a malformed input', () => {
    expect(Number.isNaN(parseLocalDate('garbage').getTime())).toBe(true);
    expect(Number.isNaN(parseLocalDate('').getTime())).toBe(true);
    expect(Number.isNaN(parseLocalDate('15/03/2026').getTime())).toBe(true);
  });
});

describe('toIsoDate', () => {
  it('uses local-TZ year/month/day with zero padding', () => {
    expect(toIsoDate(new Date(2026, 0, 4))).toBe('2026-01-04');
    expect(toIsoDate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('round-trips with parseLocalDate', () => {
    const d = new Date(2026, 5, 7);
    const back = parseLocalDate(toIsoDate(d));
    expect(back.getTime()).toBe(d.getTime());
  });
});

describe('intlLocale', () => {
  it('maps fr → fr-FR', () => {
    expect(intlLocale('fr')).toBe('fr-FR');
  });

  it('maps en → en-US', () => {
    expect(intlLocale('en')).toBe('en-US');
  });

  it('forwards unknown languages verbatim', () => {
    expect(intlLocale('ru')).toBe('ru');
  });
});

describe('formatEntryLabel', () => {
  it('returns the today label when the entry matches today', () => {
    expect(formatEntryLabel('2026-03-15', TODAY, FR_LABELS)).toBe('Aujourd’hui');
    expect(formatEntryLabel('2026-03-15', TODAY, EN_LABELS)).toBe('Today');
  });

  it('returns the yesterday label for the previous day', () => {
    expect(formatEntryLabel('2026-03-14', TODAY, FR_LABELS)).toBe('Hier');
    expect(formatEntryLabel('2026-03-14', TODAY, EN_LABELS)).toBe('Yesterday');
  });

  it('returns capitalised same-year FR label for older days', () => {
    const out = formatEntryLabel('2026-03-12', TODAY, FR_LABELS);
    expect(out).toMatch(/^[A-ZÀÂ]/);
    expect(out).toContain('mars');
    expect(out).not.toContain('2026'); // same year — no year suffix
  });

  it('switches to cross-year FR label (with year, no weekday)', () => {
    const out = formatEntryLabel('2024-03-12', TODAY, FR_LABELS);
    expect(out).toContain('2024');
    expect(out).toContain('mars');
  });

  it('renders an EN same-year label as « Thursday, March 12 » shape', () => {
    const out = formatEntryLabel('2026-03-12', TODAY, EN_LABELS);
    // First letter capitalised, contains the English month name,
    // no year suffix (same year).
    expect(out).toMatch(/^[A-Z]/);
    expect(out).toContain('March');
    expect(out).not.toContain('2026');
  });

  it('falls back to raw input on parse failure', () => {
    expect(formatEntryLabel('garbage', TODAY, FR_LABELS)).toBe('garbage');
  });

  it('survives a UTC midnight ISO without slipping to « yesterday »', () => {
    expect(formatEntryLabel('2026-03-15T00:00:00Z', TODAY, FR_LABELS)).toBe(
      'Aujourd’hui',
    );
  });
});

describe('formatMonthLabel', () => {
  it('formats FR YYYY-MM as « Mars 2026 » (capitalised)', () => {
    const out = formatMonthLabel('2026-03', 'fr');
    expect(out).toMatch(/^[A-ZÀ]/);
    expect(out).toContain('2026');
  });

  it('formats EN YYYY-MM as « March 2026 »', () => {
    expect(formatMonthLabel('2026-03', 'en')).toBe('March 2026');
  });

  it('falls back to the raw key on malformed input', () => {
    expect(formatMonthLabel('not-a-month', 'fr')).toBe('not-a-month');
    expect(formatMonthLabel('2026-', 'fr')).toBe('2026-');
  });
});

describe('formatPartialDate', () => {
  it('formats FR YYYY-MM as « month YYYY »', () => {
    // Intl FR short months — janvier abbreviated as "janv." on
    // mainstream ICU builds, accept either with or without the
    // trailing dot for forward-compat with future ICU versions.
    expect(formatPartialDate('2025-01', 'fr')).toMatch(/^janv\.? 2025$/);
    expect(formatPartialDate('2025-08', 'fr')).toBe('août 2025');
    expect(formatPartialDate('2025-12', 'fr')).toMatch(/^déc\.? 2025$/);
  });

  it('formats FR YYYY-MM-DD as « DD month YYYY »', () => {
    expect(formatPartialDate('2025-01-08', 'fr')).toMatch(/^08 janv\.? 2025$/);
    expect(formatPartialDate('2024-03-15', 'fr')).toBe('15 mars 2024');
  });

  it('uses English short month names in EN', () => {
    expect(formatPartialDate('2025-01', 'en')).toBe('Jan 2025');
    expect(formatPartialDate('2025-08', 'en')).toBe('Aug 2025');
    expect(formatPartialDate('2025-12', 'en')).toBe('Dec 2025');
    expect(formatPartialDate('2025-01-08', 'en')).toBe('08 Jan 2025');
  });

  it('returns the raw string when the input does not match the date pattern', () => {
    expect(formatPartialDate('not-a-date', 'fr')).toBe('not-a-date');
    expect(formatPartialDate('', 'fr')).toBe('');
    expect(formatPartialDate('2025', 'fr')).toBe('2025');
  });

  it('falls back to the raw month digits when the month index is out of range', () => {
    expect(formatPartialDate('2025-13', 'fr')).toBe('13 2025');
  });
});

describe('formatLongDate', () => {
  it('formats a FR full ISO timestamp as day + month + year', () => {
    const out = formatLongDate('2025-01-08T19:42:00.000Z', 'fr');
    expect(out).toContain('janvier');
    expect(out).toContain('2025');
  });

  it('formats an EN ISO timestamp using English month names', () => {
    const out = formatLongDate('2025-01-08T19:42:00.000Z', 'en');
    expect(out).toContain('January');
    expect(out).toContain('2025');
  });

  it('returns the raw string when the ISO fails to parse', () => {
    expect(formatLongDate('not-a-date', 'fr')).toBe('not-a-date');
    expect(formatLongDate('', 'fr')).toBe('');
  });
});

describe('formatNumber', () => {
  it('uses FR thousand separator (narrow no-break space)', () => {
    // Intl FR uses U+202F (narrow no-break space) as thousand separator.
    const out = formatNumber(12345, 'fr');
    expect(out).toMatch(/12.345/);
  });

  it('uses EN thousand separator (comma)', () => {
    expect(formatNumber(12345, 'en')).toBe('12,345');
  });

  it('handles zero and small values without separators', () => {
    expect(formatNumber(0, 'fr')).toBe('0');
    expect(formatNumber(42, 'en')).toBe('42');
  });
});
