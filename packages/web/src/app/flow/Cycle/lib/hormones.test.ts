import { describe, it, expect } from 'vitest';
import { sampleHormones, type HormoneSeries } from './hormones';

const argmax = (s: HormoneSeries): number =>
  s.y.reduce((best, v, i) => (v > s.y[best]! ? i : best), 0) + 1; // 1-based day

describe('sampleHormones', () => {
  it('natal: cyclic estrogen / progesterone / LH, ovulation at length − 14', () => {
    const { series, ovulation } = sampleHormones(28, 'natal');
    expect(ovulation).toBe(14);
    expect(series.map((s) => s.id)).toEqual(['estrogen', 'progesterone', 'lh']);
    expect(series.every((s) => s.y.length === 28)).toBe(true);
    const lh = series.find((s) => s.id === 'lh')!;
    const prog = series.find((s) => s.id === 'progesterone')!;
    expect(Math.abs(argmax(lh) - 14)).toBeLessThanOrEqual(1); // LH surge at ovulation
    expect(Math.abs(argmax(prog) - 21)).toBeLessThanOrEqual(2); // luteal progesterone
  });

  it('masc: testosterone high & flat, estrogen suppressed, no ovulation', () => {
    const { series, ovulation } = sampleHormones(28, 'masc');
    expect(ovulation).toBeNull();
    const t = series.find((s) => s.id === 'testosterone')!;
    const e = series.find((s) => s.id === 'estrogen')!;
    expect(t.y[0]).toBeGreaterThan(e.y[0]!);
    expect(new Set(t.y).size).toBe(1); // flat
  });

  it('fem: estrogen raised, testosterone suppressed, no ovulation', () => {
    const { series, ovulation } = sampleHormones(28, 'fem');
    expect(ovulation).toBeNull();
    const e = series.find((s) => s.id === 'estrogen')!;
    const t = series.find((s) => s.id === 'testosterone')!;
    expect(e.y[0]).toBeGreaterThan(t.y[0]!);
  });
});
