import { describe, it, expect } from 'vitest';

import { rangeFor } from './date-format';

const TODAY = new Date(2026, 2, 15); // 15 mars 2026 (Sunday)

describe('rangeFor', () => {
  it('rolling 52 weeks ending today when year is null', () => {
    const { start, end, dataEnd } = rangeFor(null, TODAY);
    expect(end).toEqual(TODAY);
    expect(dataEnd).toEqual(TODAY);
    // 52 weeks × 7 days = 364 days back, plus 1 (the +1 in the
    // implementation puts `start` on day -363 from today).
    const dayMs = 24 * 3600 * 1000;
    const diff = Math.round((TODAY.getTime() - start.getTime()) / dayMs);
    expect(diff).toBe(363);
  });

  it('current year : Jan 1 → Dec 31, dataEnd at today', () => {
    const { start, end, dataEnd } = rangeFor(2026, TODAY);
    expect(start).toEqual(new Date(2026, 0, 1));
    expect(end).toEqual(new Date(2026, 11, 31));
    expect(dataEnd).toEqual(TODAY);
  });

  it('past year : Jan 1 → Dec 31, dataEnd matches end', () => {
    const { start, end, dataEnd } = rangeFor(2024, TODAY);
    expect(start).toEqual(new Date(2024, 0, 1));
    expect(end).toEqual(new Date(2024, 11, 31));
    expect(dataEnd).toEqual(new Date(2024, 11, 31));
  });

  it('future year : Jan 1 → Dec 31, dataEnd matches end (no truncation)', () => {
    // Slightly weird semantically — a future year selection will
    // show empty cells throughout — but the function should still
    // behave deterministically.
    const { start, end, dataEnd } = rangeFor(2030, TODAY);
    expect(start).toEqual(new Date(2030, 0, 1));
    expect(end).toEqual(new Date(2030, 11, 31));
    expect(dataEnd).toEqual(new Date(2030, 11, 31));
  });
});

// `formatEntryLabel` and `toIsoDate` moved to
// `core/i18n/date-fr.ts` and are tested there alongside the
// other shared FR formatters (`formatMonthLabel`,
// `formatLongDate`, `parseLocalDate`).
