/**
 * Standard hormone band (spec §, option A) — a full-width linear chart
 * of the TEXTBOOK estrogen / progesterone / LH curves across the cycle,
 * with a « you are here » marker at today's cycle day, so one can situate
 * oneself on the typical pattern. These are INDICATIVE average shapes,
 * NOT the user's measured levels (that would be lab data → HRT). Hidden
 * via the module settings toggle. Hand-rolled SVG — no chart lib.
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
const H = 84;
const PAD = 6;

export default function CycleHormones({ length, day }: Props) {
  const { t } = useI18n();
  const { points, ovulation } = useMemo(() => sampleHormones(length), [length]);

  const x = (d: number) => ((d - 1) / Math.max(1, length - 1)) * W;
  const y = (v: number) => H - PAD - v * (H - 2 * PAD);
  const path = (key: 'e' | 'p' | 'l') =>
    points.map((p) => `${x(p.d).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');

  const legend: ReadonlyArray<[string, string]> = [
    ['stroke-accent', t('cycle.hormones.estrogen')],
    ['stroke-ink-soft', t('cycle.hormones.progesterone')],
    ['stroke-low', t('cycle.hormones.lh')],
  ];

  return (
    <section className="rounded-[var(--radius-md)] border border-hair bg-bg p-3">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h3 className="text-[12px] font-semibold text-ink">{t('cycle.hormones.title')}</h3>
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

      <svg viewBox={`0 0 ${W} ${H}`} className="h-20 w-full" preserveAspectRatio="none">
        {/* ovulation guide */}
        <line
          x1={x(ovulation)}
          y1={0}
          x2={x(ovulation)}
          y2={H}
          className="stroke-accent-soft"
          strokeWidth={1}
        />
        <polyline points={path('e')} fill="none" className="stroke-accent" strokeWidth={2} strokeLinejoin="round" />
        <polyline points={path('p')} fill="none" className="stroke-ink-soft" strokeWidth={2} strokeLinejoin="round" />
        <polyline points={path('l')} fill="none" className="stroke-low" strokeWidth={2} strokeLinejoin="round" />
        {/* today marker */}
        {day !== null && day >= 1 && day <= length ? (
          <line
            x1={x(day)}
            y1={0}
            x2={x(day)}
            y2={H}
            className="stroke-ink"
            strokeWidth={1.5}
            strokeDasharray="3 2"
          />
        ) : null}
      </svg>

      <p className="mt-1 text-[10px] leading-snug text-muted-soft">
        {t('cycle.hormones.disclaimer')}
      </p>
    </section>
  );
}
