/**
 * Textbook cycle hormone curves — estrogen, progesterone, LH — sampled
 * across a cycle of `length` days. These are INDICATIVE average shapes
 * (to situate oneself on the standard pattern), NOT the user's measured
 * levels. Values are normalised 0..1 per hormone for display only. Pure
 * — feeds the SVG band in `CycleHormones`.
 */
export interface HormonePoint {
  d: number;
  /** estrogen */ e: number;
  /** progesterone */ p: number;
  /** luteinising hormone */ l: number;
}

function gauss(x: number, mu: number, sigma: number): number {
  return Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma));
}

export function sampleHormones(length: number): {
  points: HormonePoint[];
  ovulation: number;
} {
  const ov = Math.max(2, length - 14); // ovulation ≈ next period − 14
  const raw: HormonePoint[] = [];
  for (let d = 1; d <= length; d += 1) {
    // Estrogen : follicular rise peaking just before ovulation + a
    // smaller luteal bump.
    const e = 0.15 + gauss(d, ov - 1, 3) + 0.35 * gauss(d, ov + 7, 5);
    // Progesterone : ~flat in the follicular phase, luteal peak ~7 days
    // after ovulation.
    const p = 0.05 + 0.95 * gauss(d, ov + 7, 4.5);
    // LH : flat low with a sharp surge at ovulation.
    const l = 0.08 + gauss(d, ov, 1.1);
    raw.push({ d, e, p, l });
  }
  const maxE = Math.max(...raw.map((r) => r.e));
  const maxP = Math.max(...raw.map((r) => r.p));
  const maxL = Math.max(...raw.map((r) => r.l));
  const points = raw.map((r) => ({
    d: r.d,
    e: r.e / maxE,
    p: r.p / maxP,
    l: r.l / maxL,
  }));
  return { points, ovulation: ov };
}
