/**
 * Standard hormone view (3rd graph) — a full-width linear chart of the
 * TEXTBOOK hormone curves for the chosen reference profile (natal cycle /
 * masculinising HRT / feminising HRT), with a « you are here » marker at
 * today's cycle day. INDICATIVE average shapes, NOT the user's measured
 * levels (that would be lab data → HRT). Profile + on/off live in the
 * module settings. Hand-rolled SVG — no chart lib.
 */
import { useMemo } from 'react';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import {
  sampleHormones,
  type HormoneId,
  type HormoneProfile,
  type HormoneSeries,
} from '../lib/hormones';

interface Props {
  length: number;
  day: number | null;
  profile: HormoneProfile;
}

const W = 340;
const H = 100;
const PAD = 6;

const HORMONE_COLOR: Record<HormoneId, string> = {
  estrogen: 'stroke-accent',
  progesterone: 'stroke-ink-soft',
  lh: 'stroke-low',
  testosterone: 'stroke-low-deep',
};

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

export default function CycleHormones({ length, day, profile }: Props) {
  const { t } = useI18n();
  const { series, ovulation } = useMemo(
    () => sampleHormones(length, profile),
    [length, profile],
  );

  const x = (dayNum: number) => ((dayNum - 1) / Math.max(1, length - 1)) * W;
  const y = (v: number) => H - PAD - v * (H - 2 * PAD);
  const curve = (s: HormoneSeries) =>
    smooth(s.y.map((v, i) => ({ x: x(i + 1), y: y(v) })));

  return (
    <div className="flex h-full flex-col px-1 py-1">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-[13px] font-semibold text-ink">{t('cycle.hormones.title')}</h3>
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
          {series.map((s) => (
            <li key={s.id} className="flex items-center gap-1.5">
              <svg width="14" height="6" aria-hidden="true">
                <line x1="0" y1="3" x2="14" y2="3" className={HORMONE_COLOR[s.id]} strokeWidth={2} />
              </svg>
              {t(`cycle.hormones.${s.id}`)}
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
          {ovulation !== null ? (
            <line x1={x(ovulation)} y1={0} x2={x(ovulation)} y2={H} className="stroke-accent-soft" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ) : null}
          {series.map((s) => (
            <path
              key={s.id}
              d={curve(s)}
              fill="none"
              className={HORMONE_COLOR[s.id]}
              strokeWidth={1.25}
              vectorEffect="non-scaling-stroke"
            />
          ))}
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
