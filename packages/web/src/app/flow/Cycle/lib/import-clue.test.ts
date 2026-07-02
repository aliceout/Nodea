import { describe, it, expect } from 'vitest';
import { parseClueExport } from './import-clue';

describe('parseClueExport — modern measurements.json', () => {
  const modern = JSON.stringify([
    { date: '2023-05-14T00:00:00.000Z', type: 'period', value: { option: 'heavy' } },
    {
      date: '2023-05-14T00:00:00.000Z',
      type: 'pain',
      value: [{ option: 'period_cramps' }, { option: 'lower_back' }],
    },
    { date: '2023-05-15T00:00:00.000Z', type: 'period', value: { option: 'medium' } },
    { date: '2023-05-16T00:00:00.000Z', type: 'spotting', value: { option: 'red' } },
    { date: '2023-05-18T00:00:00.000Z', type: 'energy', value: [{ option: 'tired' }] },
    { date: '2023-05-18T00:00:00.000Z', type: 'bbt', value: { celsius: 36.72 } },
    { date: '2023-05-18T00:00:00.000Z', type: 'discharge', value: { option: 'egg_white' } },
    // A meta category on a day with nothing else → that day is dropped.
    { date: '2023-05-20T00:00:00.000Z', type: 'birth_control', value: { option: 'pill' } },
  ]);

  it('maps flow, spotting, symptoms, bbt and mucus, grouped by day', () => {
    const r = parseClueExport(modern);
    expect(r.days).toBe(4); // 14, 15, 16, 18 — the 20th (meta only) is dropped
    expect(r.withFlow).toBe(3); // 14 heavy, 15 medium, 16 spotting
    expect(r.from).toBe('2023-05-14');
    expect(r.to).toBe('2023-05-18');

    const byDate = Object.fromEntries(r.entries.map((e) => [e.date, e]));
    expect(byDate['2023-05-14']!.flow).toBe('heavy');
    expect(byDate['2023-05-14']!.symptoms).toEqual(['crampes', 'lombaires']);
    expect(byDate['2023-05-15']!.flow).toBe('medium');
    expect(byDate['2023-05-16']!.flow).toBe('spotting'); // separate `spotting` type
    expect(byDate['2023-05-18']!.flow).toBeUndefined();
    expect(byDate['2023-05-18']!.symptoms).toEqual(['fatigue']);
    expect(byDate['2023-05-18']!.bbt).toBe(36.72);
    expect(byDate['2023-05-18']!.mucus).toBe('eggwhite');
    expect(byDate['2023-05-20']).toBeUndefined();
  });

  it('collapses very_heavy to heavy and humanises unknown options', () => {
    const r = parseClueExport(
      JSON.stringify([
        { date: '2023-06-01T00:00:00.000Z', type: 'period', value: { option: 'very_heavy' } },
        { date: '2023-06-01T00:00:00.000Z', type: 'pain', value: [{ option: 'weird_custom_tag' }] },
      ]),
    );
    expect(r.entries[0]!.flow).toBe('heavy');
    expect(r.entries[0]!.symptoms).toEqual(['weird custom tag']);
  });
});

describe('parseClueExport — legacy .cluedata', () => {
  it('reads one object per day with plain-string period + array symptoms', () => {
    const legacy = JSON.stringify({
      data: [
        { day: '2020-03-01T00:00:00.000Z', period: 'light', pain: ['headache'] },
        { day: '2020-03-02T00:00:00.000Z', period: 'spotting' },
      ],
    });
    const r = parseClueExport(legacy);
    expect(r.days).toBe(2);
    expect(r.entries[0]).toMatchObject({ date: '2020-03-01', flow: 'light', symptoms: ['maux de tête'] });
    expect(r.entries[1]).toMatchObject({ date: '2020-03-02', flow: 'spotting' });
  });
});

describe('parseClueExport — errors', () => {
  it('throws on invalid JSON', () => {
    expect(() => parseClueExport('{ not json')).toThrow('invalid_json');
  });
  it('throws on an unrecognised shape', () => {
    expect(() => parseClueExport('{"foo":"bar"}')).toThrow('unrecognized_clue_format');
  });
  it('returns an empty result for an empty array', () => {
    const r = parseClueExport('[]');
    expect(r).toMatchObject({ days: 0, withFlow: 0, from: null, to: null, entries: [] });
  });
});
