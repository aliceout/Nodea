/**
 * Unit-conversion canaries for the HRT marker presets. The factors are
 * standard molar conversions (estradiol 272.38 g/mol, testosterone
 * 288.42 g/mol) — pin them so an accidental edit surfaces here rather
 * than as a silently-wrong chart axis.
 */
import { describe, expect, it } from 'vitest';

import {
  HRT_MARKERS,
  convertFromCanonical,
  convertMarkerValue,
  findMarker,
  findMedication,
  toCanonical,
} from './hrt-presets.ts';

describe('HRT presets', () => {
  it('converts estradiol pg/mL → pmol/L with the molar factor', () => {
    const e2 = findMarker('estradiol')!;
    const pmol = convertFromCanonical(e2, 100, 'pmol/L');
    expect(pmol).toBeCloseTo(367.13, 1);
  });

  it('converts total testosterone ng/dL → nmol/L', () => {
    const t = findMarker('testosterone_total')!;
    const nmol = convertFromCanonical(t, 600, 'nmol/L');
    expect(nmol).toBeCloseTo(20.8, 1);
  });

  it('returns the same value for the canonical unit and null for unknown units', () => {
    const e2 = findMarker('estradiol')!;
    expect(convertFromCanonical(e2, 120, 'pg/mL')).toBe(120);
    expect(convertFromCanonical(e2, 120, 'ng/dL')).toBeNull();
  });

  it('every marker lists its canonical unit among its units', () => {
    for (const m of HRT_MARKERS) {
      expect(m.units).toContain(m.canonicalUnit);
    }
  });

  it('round-trips a value canonical → alt → canonical', () => {
    const e2 = findMarker('estradiol')!;
    const pmol = convertFromCanonical(e2, 100, 'pmol/L')!;
    expect(toCanonical(e2, pmol, 'pmol/L')).toBeCloseTo(100, 6);
  });

  it('converts between two alt/canonical units via the pivot', () => {
    const t = findMarker('testosterone_total')!;
    // 20 nmol/L → ng/dL (nmol/L is the alt unit here)
    const ngdl = convertMarkerValue(t, 20, 'nmol/L', 'ng/dL');
    expect(ngdl).toBeCloseTo(576.8, 0);
    // identity + unknown-unit cases
    expect(convertMarkerValue(t, 50, 'ng/dL', 'ng/dL')).toBe(50);
    expect(convertMarkerValue(t, 50, 'pg/mL', 'ng/dL')).toBeNull();
  });

  it('looks medications up by id', () => {
    expect(findMedication('spironolactone')?.category).toBe('antiandrogen');
    expect(findMedication('does_not_exist')).toBeUndefined();
  });
});
