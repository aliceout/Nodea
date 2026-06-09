/**
 * Tests for the HRT import model — the pure parse / validate / coerce /
 * suggest / build / dedupe layer that turns « Analyses » spreadsheet rows
 * back into encrypted lab-result payloads. Covers the locale-tolerant date
 * & number parsing, the French draw-context labels, the fuzzy marker
 * matching, the mapping-driven payload build (incl. the empty-unit
 * resolution) and the exact-match dedupe. No spreadsheet / xlsx library
 * involved.
 *
 * The row-error reasons resolve through the caller's `t` since the i18n
 * pass — the tests feed one resolved over the real FR `hrt.json`, so the
 * expected reasons stay the French copy the module always shipped.
 */
import { describe, expect, it } from 'vitest';

import type { HrtLabResultPayload } from '@nodea/shared';

import frHrt from '@/i18n/locales/fr/hrt.json';
import { translate } from '@/i18n/translate';

import {
  buildLabResultPayloads,
  dedupeLabResults,
  distinctMarkerNames,
  parseAnalyseRows,
  suggestMarkerMatch,
  type AnalyseCandidate,
} from './import-model';
import type { HrtTranslate } from './labels';

/** `t` resolved over the bundled FR namespace — pure, no React. */
const t: HrtTranslate = (key, options) =>
  translate({ fr: { hrt: frHrt } }, 'fr', key, options);

describe('parseAnalyseRows', () => {
  it('parses a clean row, numbering from the row below the header', () => {
    const { candidates, errors } = parseAnalyseRows([
      {
        Date: '2026-06-04', Marqueur: 'Œstradiol', Valeur: 165,
        Unité: 'pg/mL', Contexte: 'Creux', Laboratoire: 'Cerba', Notes: '',
      },
    ], t);
    expect(errors).toEqual([]);
    expect(candidates[0]).toEqual({
      row: 2, date: '2026-06-04', marker: 'Œstradiol', value: 165,
      unit: 'pg/mL', context: 'trough', lab: 'Cerba', notes: '',
    });
  });

  it('accepts a French date (JJ.MM.AAAA) and a comma decimal value', () => {
    const { candidates } = parseAnalyseRows([
      { Date: '04.06.2026', Marqueur: 'estradiol', Valeur: '1,5' },
    ], t);
    expect(candidates[0]?.date).toBe('2026-06-04');
    expect(candidates[0]?.value).toBe(1.5);
  });

  it('tolerates lower-case / accent-free headers', () => {
    const { candidates } = parseAnalyseRows([
      { date: '2026-06-04', marqueur: 'LH', valeur: 4, unite: 'IU/L' },
    ], t);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.unit).toBe('IU/L');
  });

  it('maps French draw-context labels (and falls back to unknown)', () => {
    const ctx = (label: string): string | undefined =>
      parseAnalyseRows([{ Date: '2026-06-04', Marqueur: 'X', Valeur: 1, Contexte: label }], t)
        .candidates[0]?.context;
    expect(ctx('Creux')).toBe('trough');
    expect(ctx('Pic')).toBe('peak');
    expect(ctx('Aléatoire')).toBe('random');
    expect(ctx('')).toBe('unknown');
    expect(ctx('n’importe quoi')).toBe('unknown');
  });

  it('allows an empty unit at parse time (resolved later)', () => {
    const { candidates, errors } = parseAnalyseRows([
      { Date: '2026-06-04', Marqueur: 'estradiol', Valeur: 165, Unité: '' },
    ], t);
    expect(errors).toEqual([]);
    expect(candidates[0]?.unit).toBe('');
  });

  it('flags a missing marker, a non-numeric value and an impossible date', () => {
    const { candidates, errors } = parseAnalyseRows([
      { Date: '2026-06-04', Marqueur: '', Valeur: 1 },
      { Date: '2026-06-04', Marqueur: 'X', Valeur: 'NA' },
      { Date: '32.13.2026', Marqueur: 'X', Valeur: 1 },
    ], t);
    expect(candidates).toEqual([]);
    expect(errors).toEqual([
      { row: 2, reason: 'marqueur manquant' },
      { row: 3, reason: 'valeur non numérique' },
      { row: 4, reason: 'date invalide' },
    ]);
  });

  it('skips a fully-blank row silently (no candidate, no error)', () => {
    const { candidates, errors } = parseAnalyseRows([
      { Date: '', Marqueur: '', Valeur: '' },
      { Date: '2026-06-04', Marqueur: 'X', Valeur: 1, Unité: 'mg' },
    ], t);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.row).toBe(3);
    expect(errors).toEqual([]);
  });
});

describe('distinctMarkerNames', () => {
  const analyse = (marker: string): AnalyseCandidate => ({
    row: 0, date: '', marker, value: 0, unit: '', context: 'unknown', lab: '', notes: '',
  });

  it('de-duplicates and sorts marker names', () => {
    expect(distinctMarkerNames([analyse('LH'), analyse('FSH'), analyse('LH')])).toEqual([
      'FSH', 'LH',
    ]);
  });
});

describe('suggestMarkerMatch', () => {
  it('matches a preset by key', () => {
    expect(suggestMarkerMatch('estradiol')?.key).toBe('estradiol');
  });

  it('matches a preset by (accent-insensitive) label', () => {
    expect(suggestMarkerMatch('Testostérone totale')?.key).toBe('testosterone_total');
    expect(suggestMarkerMatch('LH')?.key).toBe('lh');
  });

  it('matches loosely when the label contains the text', () => {
    expect(suggestMarkerMatch('E2')?.key).toBe('estradiol');
  });

  it('returns null for an unknown marker (kept custom)', () => {
    expect(suggestMarkerMatch('Vitamine D')).toBeNull();
  });
});

describe('buildLabResultPayloads', () => {
  const base: AnalyseCandidate = {
    row: 2, date: '2026-06-04', marker: 'estradiol', value: 165,
    unit: '', context: 'trough', lab: '', notes: '',
  };

  it('keeps a mapped marker key and fills an empty unit from the preset', () => {
    const { payloads, skipped } = buildLabResultPayloads(
      [base],
      new Map([['estradiol', 'estradiol']]),
      t,
    );
    expect(skipped).toEqual([]);
    expect(payloads).toEqual([
      {
        date: '2026-06-04', marker: 'estradiol', value: 165, unit: 'pg/mL',
        context: 'trough', lab: '', notes: '', updatedAt: '',
      },
    ]);
  });

  it('keeps the verbatim unit when one is given', () => {
    const { payloads } = buildLabResultPayloads(
      [{ ...base, unit: 'pmol/L' }],
      new Map([['estradiol', 'estradiol']]),
      t,
    );
    expect(payloads[0]?.unit).toBe('pmol/L');
  });

  it('keeps a custom marker verbatim and skips it when no unit can be resolved', () => {
    const custom: AnalyseCandidate = { ...base, marker: 'Ferritine', unit: '' };
    const { payloads, skipped } = buildLabResultPayloads(
      [custom],
      new Map([['Ferritine', 'Ferritine']]),
      t,
    );
    expect(payloads).toEqual([]);
    expect(skipped).toEqual([{ row: 2, reason: 'unité manquante pour « Ferritine »' }]);
  });
});

describe('dedupeLabResults', () => {
  const reading = (over: Partial<HrtLabResultPayload> = {}): HrtLabResultPayload => ({
    date: '2026-06-04', marker: 'estradiol', value: 165, unit: 'pg/mL',
    context: 'trough', lab: '', notes: '', updatedAt: '', ...over,
  });

  it('drops readings that match an existing one, ignoring updatedAt', () => {
    const { fresh, duplicates } = dedupeLabResults(
      [reading({ updatedAt: 'now' })],
      [reading({ updatedAt: 'earlier' })],
    );
    expect(fresh).toEqual([]);
    expect(duplicates).toHaveLength(1);
  });

  it('de-duplicates within the batch and keeps genuinely new readings', () => {
    const { fresh, duplicates } = dedupeLabResults(
      [reading(), reading(), reading({ value: 200 })],
      [],
    );
    expect(fresh).toHaveLength(2);
    expect(duplicates).toHaveLength(1);
  });
});
