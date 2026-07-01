import { describe, it, expect } from 'vitest';
import { sampleHormones, type HormonePoint } from './hormones';

const argmax = (points: HormonePoint[], key: 'e' | 'p' | 'l'): number =>
  points.reduce((best, p) => (p[key] > best.v ? { d: p.d, v: p[key] } : best), {
    d: 0,
    v: -1,
  }).d;

describe('sampleHormones', () => {
  it('samples one point per cycle day, ovulation at length − 14', () => {
    const { points, ovulation } = sampleHormones(28);
    expect(points).toHaveLength(28);
    expect(ovulation).toBe(14);
    expect(points.every((p) => p.e <= 1 && p.p <= 1 && p.l <= 1)).toBe(true);
  });

  it('peaks each hormone around its expected phase (28-day cycle)', () => {
    const { points } = sampleHormones(28);
    expect(Math.abs(argmax(points, 'l') - 14)).toBeLessThanOrEqual(1); // LH surge at ovulation
    expect(Math.abs(argmax(points, 'p') - 21)).toBeLessThanOrEqual(2); // luteal progesterone
    const eStar = argmax(points, 'e');
    expect(eStar).toBeGreaterThanOrEqual(11); // estrogen peaks just pre-ovulation
    expect(eStar).toBeLessThanOrEqual(14);
  });
});
