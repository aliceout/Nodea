/**
 * Tests for the HRT export builders — the pure shaping that turns
 * decrypted entries into the doctor-report rows + CSV matrices. Covers the
 * mg-equivalent join, the « ongoing » regimen filter, range filtering /
 * sort order on the dose history, and the marker grouping + chart series.
 *
 * The builders take the caller's `t` since the i18n pass — the tests
 * feed one resolved over the real FR `hrt.json`, so the expected
 * strings stay the French copy the module always shipped.
 */
import { describe, expect, it } from 'vitest';

import type {
  HrtAdminLogPayload,
  HrtLabResultPayload,
  HrtProductPayload,
  HrtSchedulePayload,
} from '@nodea/shared';

import frHrt from '@/i18n/locales/fr/hrt.json';
import { translate } from '@/i18n/translate';

import type { AdminLogEntry } from '../hooks/use-admin-logs';
import type { LabResultEntry } from '../hooks/use-lab-results';
import type { ScheduleEntry } from '../hooks/use-schedules';
import {
  buildDoseCharts,
  buildDoseHistory,
  buildLabGroups,
  buildRegimen,
  doseMatrix,
  doseUnitOf,
  flattenLabReadings,
  formatDose,
  groupDosesByMolecule,
  labMatrix,
  mgEquivalent,
} from './export-model';
import { EMPTY_RANGE } from './date-range';
import type { HrtTranslate } from './labels';

/** `t` resolved over the bundled FR namespace — pure, no React. */
const t: HrtTranslate = (key, options) =>
  translate({ fr: { hrt: frHrt } }, 'fr', key, options);

function product(over: Partial<HrtProductPayload> & { name: string }): HrtProductPayload {
  return {
    medication: '',
    category: 'other',
    route: 'oral',
    unit: 'mg',
    archived: false,
    notes: '',
    updatedAt: '',
    ...over,
  };
}

const EV = product({
  name: 'EV',
  medication: 'Estradiol valérate',
  category: 'estrogen',
  route: 'injection_im',
  unit: 'mL',
  concentration: 10,
});
const SPIRO = product({
  name: 'Aldactone',
  medication: 'Spironolactone',
  category: 'antiandrogen',
});
// Legacy-ish product : stored `unit: 'mg'` but a concentration is set, so
// the dose is really a volume (mL) — the concentration must drive it.
const ASTROVIAL = product({
  name: 'Astrovial',
  medication: 'Estradiol valérate',
  category: 'estrogen',
  route: 'injection_im',
  unit: 'mg',
  concentration: 40,
});
const products = new Map([
  [EV.name, EV],
  [SPIRO.name, SPIRO],
]);

function admin(payload: Partial<HrtAdminLogPayload> & { date: string; product: string }): AdminLogEntry {
  return {
    id: payload.date + payload.product,
    payload: { time: '', dose: 0, notes: '', updatedAt: '', ...payload },
  };
}

function schedule(
  payload: Partial<HrtSchedulePayload> & { product: string; startDate: string },
): ScheduleEntry {
  return {
    id: payload.product + payload.startDate,
    payload: {
      dose: 0,
      frequency: 'daily',
      time: '',
      endDate: null,
      materializedThrough: '',
      notes: '',
      updatedAt: '',
      ...payload,
    },
  };
}

function lab(payload: Partial<HrtLabResultPayload> & { date: string; marker: string }): LabResultEntry {
  return {
    id: payload.date + payload.marker,
    payload: { value: 0, unit: '', context: 'unknown', lab: '', notes: '', updatedAt: '', ...payload },
  };
}

describe('doseUnitOf / mgEquivalent / formatDose', () => {
  it('a product with a concentration is dosed in mL, whatever its stored unit', () => {
    expect(doseUnitOf(EV)).toBe('mL');
    expect(doseUnitOf(ASTROVIAL)).toBe('mL'); // stored unit mg, but has a concentration
    expect(doseUnitOf(SPIRO)).toBe('mg'); // no concentration → its own unit
    expect(doseUnitOf(undefined)).toBe('');
  });
  it('converts a mL dose via the concentration, rounding to 0.1 mg', () => {
    expect(mgEquivalent(0.4, EV)).toBe(4);
    expect(mgEquivalent(0.43, EV)).toBe(4.3);
    expect(mgEquivalent(1.5, ASTROVIAL)).toBe(60); // mg-unit product, concentration drives it
  });
  it('returns null when the product has no concentration', () => {
    expect(mgEquivalent(100, SPIRO)).toBeNull();
    expect(mgEquivalent(1, undefined)).toBeNull();
  });
  it('formats the human dose string', () => {
    expect(formatDose(0.4, 'mL', 4)).toBe('0.4 mL ≈ 4 mg');
    expect(formatDose(100, 'mg', null)).toBe('100 mg');
    expect(formatDose(2, '', null)).toBe('2');
  });
});

describe('buildRegimen', () => {
  const schedules = [
    schedule({ product: 'Aldactone', startDate: '2026-01-01', dose: 100 }),
    schedule({ product: 'EV', startDate: '2026-02-01', dose: 0.4, frequency: 'every_n_days', everyNDays: 5 }),
    schedule({ product: 'EV', startDate: '2025-01-01', dose: 0.4, endDate: '2025-06-01' }), // stopped
  ];

  it('keeps only ongoing series (endDate == null), sorted by category then molecule', () => {
    const rows = buildRegimen(schedules, products, t);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.molecule).toBe('Spironolactone'); // Anti-androgène before Œstrogène
    expect(rows[1]?.molecule).toBe('Estradiol valérate');
  });

  it('derives dose text + cadence from the product join', () => {
    const rows = buildRegimen(schedules, products, t);
    expect(rows[1]?.doseText).toBe('0.4 mL ≈ 4 mg');
    expect(rows[1]?.cadence).toBe('Tous les 5 jours');
    expect(rows[1]?.routeLabel).toBe('Injection IM');
  });
});

describe('buildDoseHistory', () => {
  const entries = [
    admin({ date: '2026-06-01', time: '08:00', product: 'EV', dose: 0.4, scheduleId: 'sid' }),
    admin({ date: '2026-06-03', time: '09:00', product: 'Aldactone', dose: 100, notes: 'x' }),
    admin({ date: '2026-05-01', product: 'EV', dose: 0.4 }),
  ];

  it('filters to the range and sorts newest-first', () => {
    const rows = buildDoseHistory(entries, products, { from: '2026-06-01', to: '' }, t);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.date).toBe('2026-06-03');
    expect(rows[1]?.date).toBe('2026-06-01');
  });

  it('flags schedule-generated occurrences and joins the mg-equivalent', () => {
    const rows = buildDoseHistory(entries, products, EMPTY_RANGE, t);
    const ev = rows.find((r) => r.product === 'EV' && r.date === '2026-06-01');
    expect(ev?.auto).toBe(true);
    expect(ev?.mgEq).toBe(4);
    expect(rows.find((r) => r.product === 'Aldactone')?.auto).toBe(false);
  });
});

describe('buildDoseCharts', () => {
  const entries = [
    admin({ date: '2026-06-01', product: 'EV', dose: 0.4 }),
    admin({ date: '2026-06-06', product: 'EV', dose: 0.4 }),
    admin({ date: '2026-06-02', product: 'Aldactone', dose: 100 }),
  ];

  it('builds one mg-equivalent series per molecule administered in range', () => {
    const charts = buildDoseCharts(entries, products, EMPTY_RANGE);
    expect(charts.find((c) => c.molecule === 'Estradiol valérate')?.points.map((p) => p.value)).toEqual([4, 4]);
    expect(charts.find((c) => c.molecule === 'Spironolactone')?.points).toHaveLength(1);
  });

  it('honours the date range (a molecule with no dose in range drops out)', () => {
    const charts = buildDoseCharts(entries, products, { from: '2026-06-03', to: '' });
    expect(charts.find((c) => c.molecule === 'Estradiol valérate')?.points).toHaveLength(1);
    expect(charts.find((c) => c.molecule === 'Spironolactone')).toBeUndefined();
  });
});

describe('buildLabGroups', () => {
  const entries = [
    lab({ date: '2026-06-15', marker: 'estradiol', value: 150, unit: 'pg/mL', context: 'trough' }),
    lab({ date: '2026-06-01', marker: 'estradiol', value: 100, unit: 'pg/mL', context: 'trough' }),
    lab({ date: '2026-06-10', marker: 'testosterone_total', value: 30, unit: 'ng/dL' }),
  ];

  it('groups by marker, most-measured first, readings oldest-first', () => {
    const groups = buildLabGroups(entries, EMPTY_RANGE, t);
    expect(groups.map((g) => g.key)).toEqual(['estradiol', 'testosterone_total']);
    expect(groups[0]?.readings.map((r) => r.date)).toEqual(['2026-06-01', '2026-06-15']);
    expect(groups[0]?.points).toHaveLength(2);
    expect(groups[1]?.readings).toHaveLength(1);
  });

  it('honours the date range', () => {
    const groups = buildLabGroups(entries, { from: '2026-06-12', to: '' }, t);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.key).toBe('estradiol');
    expect(groups[0]?.readings).toHaveLength(1);
  });
});

describe('groupDosesByMolecule', () => {
  it('groups rows by molecule, ordered by name, newest-first within', () => {
    const rows = buildDoseHistory(
      [
        admin({ date: '2026-06-01', product: 'EV', dose: 0.4 }),
        admin({ date: '2026-06-05', product: 'EV', dose: 0.4 }),
        admin({ date: '2026-06-03', product: 'Aldactone', dose: 100 }),
      ],
      products,
      EMPTY_RANGE,
      t,
    );
    const groups = groupDosesByMolecule(rows);
    expect(groups.map((g) => g.molecule)).toEqual(['Estradiol valérate', 'Spironolactone']);
    expect(groups[0]?.rows.map((r) => r.date)).toEqual(['2026-06-05', '2026-06-01']);
    expect(groups[1]?.rows).toHaveLength(1);
  });
});

describe('flattenLabReadings', () => {
  it('flattens all marker groups into one newest-first list tagged by marker', () => {
    const groups = buildLabGroups(
      [
        lab({ date: '2026-06-01', marker: 'estradiol', value: 100, unit: 'pg/mL' }),
        lab({ date: '2026-06-10', marker: 'testosterone_total', value: 30, unit: 'ng/dL' }),
        lab({ date: '2026-06-05', marker: 'estradiol', value: 120, unit: 'pg/mL' }),
      ],
      EMPTY_RANGE,
      t,
    );
    const flat = flattenLabReadings(groups);
    expect(flat.map((r) => r.date)).toEqual(['2026-06-10', '2026-06-05', '2026-06-01']);
    expect(flat[0]?.markerLabel).toBe('Testostérone totale');
  });
});

describe('CSV matrices', () => {
  it('builds the dose matrix with a header + one row per dose', () => {
    const rows = buildDoseHistory(
      [admin({ date: '2026-06-01', time: '08:00', product: 'EV', dose: 0.4, scheduleId: 'sid' })],
      products,
      EMPTY_RANGE,
      t,
    );
    const matrix = doseMatrix(rows, t);
    expect(matrix[0]).toContain('Équiv. mg');
    expect(matrix).toHaveLength(2);
    expect(matrix[1]).toEqual([
      '2026-06-01', '08:00', 'EV', 'Estradiol valérate', 'Œstrogène',
      'Injection IM', 0.4, 'mL', 4, 'Récurrente', '',
    ]);
  });

  it('flattens every reading across groups into the lab matrix', () => {
    const groups = buildLabGroups(
      [
        lab({ date: '2026-06-01', marker: 'estradiol', value: 100, unit: 'pg/mL' }),
        lab({ date: '2026-06-02', marker: 'estradiol', value: 120, unit: 'pg/mL' }),
      ],
      EMPTY_RANGE,
      t,
    );
    const matrix = labMatrix(groups, t);
    expect(matrix[0]?.[1]).toBe('Marqueur');
    expect(matrix).toHaveLength(3); // header + 2 readings
  });
});
