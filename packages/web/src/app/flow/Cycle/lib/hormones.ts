/**
 * Standard hormone curves per reference PROFILE — indicative textbook
 * patterns to situate oneself, NOT the user's measured levels (that would
 * be lab data → HRT). Values are ABSOLUTE relative levels 0..1 (so the
 * heights compare across hormones), one point per cycle day.
 *
 *  - `natal`  : the cyclic estrogen / progesterone / LH pattern of a
 *               natal menstrual cycle.
 *  - `masc`   : masculinising HRT (testosterone) — T high & steady,
 *               estrogen suppressed ; no cyclic LH surge (typical
 *               amenorrhea).
 *
 * No feminising profile : a transfeminine body has no menstrual cycle, so
 * it has no place in a cycle-tracking module.
 *
 * Pure — feeds the SVG in `CycleHormones`.
 */
export type HormoneProfile = 'natal' | 'masc';
export type HormoneId = 'estrogen' | 'progesterone' | 'lh' | 'testosterone';

export interface HormoneSeries {
  id: HormoneId;
  /** Level per cycle day (index 0 = day 1), absolute 0..1. */
  y: number[];
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
function gauss(x: number, mu: number, sigma: number): number {
  return Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma));
}

export function sampleHormones(
  length: number,
  profile: HormoneProfile,
): { series: HormoneSeries[]; ovulation: number | null } {
  const days = Array.from({ length }, (_, i) => i + 1);

  if (profile === 'natal') {
    const ov = Math.max(2, length - 14); // ovulation ≈ next period − 14
    const estrogen = days.map((d) =>
      clamp01(0.15 + 0.72 * gauss(d, ov - 1, 3) + 0.28 * gauss(d, ov + 7, 5)),
    );
    const progesterone = days.map((d) => clamp01(0.05 + 0.72 * gauss(d, ov + 7, 4.5)));
    const lh = days.map((d) => clamp01(0.1 + 0.85 * gauss(d, ov, 1.1)));
    return {
      series: [
        { id: 'estrogen', y: estrogen },
        { id: 'progesterone', y: progesterone },
        { id: 'lh', y: lh },
      ],
      ovulation: ov,
    };
  }

  // masc
  return {
    series: [
      { id: 'testosterone', y: days.map(() => 0.82) },
      { id: 'estrogen', y: days.map(() => 0.12) },
    ],
    ovulation: null,
  };
}
