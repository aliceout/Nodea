/**
 * Standard hormone view (spec §, 3rd graph) — a full-width linear chart
 * of the TEXTBOOK estrogen / progesterone / LH curves across the cycle,
 * with a « you are here » marker at today's cycle day, so one can situate
 * oneself on the typical pattern. These are INDICATIVE average shapes,
 * NOT the user's measured levels (that would be lab data → HRT). The tab
 * is toggled off via the module settings. Hand-rolled SVG — no chart lib.
 */
import { useMemo } from 'react';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { sampleHormones } from '../lib/hormones';

interface Props {
  /** Reference cycle length (estimate) — the curves stretch to it. */
  length: number;
  /** Today's cycle day, for the marker ; null when not in a cycle. */
  day: number | null;
}

const W = 340;
const H = 100;
const PAD = 6;

/** Smooth path through points via Catmull-Rom → cubic béziers. */
function smooth(pts: ReadonlyArray<{ x: number; y: number }>): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0]!.x.toFixed(1)} ${pts[0]!.y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export default function CycleHormones({ length, day }: Props) {
  const { t } = useI18n();
  const { points, ovulation } = useMemo(() => sampleHormones(length), [length]);

  const x = (d: number) => ((d - 1) / Math.max(1, length - 1)) * W;
  const y = (v: number) => H - PAD - v * (H - 2 * PAD);
  const curve = (key: 'e' | 'p' | 'l') =>
    smooth(points.map((p) => ({ x: x(p.d), y: y(p[key]) })));

  const legend: ReadonlyArray<[string, string]> = [
    ['stroke-accent', t('cycle.hormones.estrogen')],
    ['stroke-ink-soft', t('cycle.hormones.progesterone')],
    ['stroke-low', t('cycle.hormones.lh')],
  ];

  return (
    <div className="flex h-full flex-col px-1 py-1">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-[13px] font-semibold text-ink">{t('cycle.hormones.title')}</h3>
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
          {legend.map(([stroke, label]) => (
            <li key={label} className="flex items-center gap-1.5">
              <svg width="14" height="6" aria-hidden="true">
                <line x1="0" y1="3" x2="14" y2="3" className={stroke} strokeWidth={2} />
              </svg>
              {label}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative flex-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
        >
          <line x1={x(ovulation)} y1={0} x2={x(ovulation)} y2={H} className="stroke-accent-soft" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <path d={curve('e')} fill="none" className="stroke-accent" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
          <path d={curve('p')} fill="none" className="stroke-ink-soft" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
          <path d={curve('l')} fill="none" className="stroke-low" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
          {day !== null && day >= 1 && day <= length ? (
            <line
              x1={x(day)}
              y1={0}
              x2={x(day)}
              y2={H}
              className="stroke-ink"
              strokeWidth={1}
              strokeDasharray="3 2"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
        </svg>
      </div>

      <p className="mt-2 text-[11px] leading-snug text-muted-soft">
        {t('cycle.hormones.disclaimer')}
      </p>
    </div>
  );
}
