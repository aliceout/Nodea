import { useState } from 'react';
import type { MoodScore } from '@nodea/shared';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';

import { useMoodData, useMoodFilters } from '../context';
import {
  DONUT_ORDER,
  SCORE_LABEL_FILL,
  SCORE_STROKE,
} from '../lib/constants';
import NoteBadge from './NoteBadge';

/**
 * Score distribution rendered as an empty-centre donut. Each arc
 * is a `<circle>` with a `stroke-dasharray` carving a slice ;
 * segments sit on a faint `bg-2` track so a missing score still
 * reads as « 0 of N » instead of disappearing.
 *
 * Hover a segment to fill the centre with that score's NoteBadge
 * + entry count. Other segments dim while a segment is being
 * hovered so the focus is unambiguous.
 *
 * Click a segment to push the score down to the primary column as
 * a filter — only entries with that score remain visible. Clicking
 * the same segment again clears the filter. The active segment
 * stays at full opacity while the others stay dimmed, mirroring the
 * hover affordance so the persistent state reads as « sticky
 * hover ».
 *
 * Reads the entry list from the data context — the donut counts
 * the *full* dataset (ignores year / month filters) so the user
 * sees their lifetime distribution, not the slice they're filtered
 * down to.
 */
export default function ScoreDonut() {
  const { tn } = useI18n();
  const { entries } = useMoodData();
  const { scoreFilter, setScoreFilter } = useMoodFilters();
  const [hovered, setHovered] = useState<MoodScore | null>(null);
  // Visual selection : hover wins over the persisted filter so the
  // user can preview another segment without losing the filter
  // anchor. Falls back to scoreFilter when nothing is hovered.
  const active = hovered ?? scoreFilter;
  const counts: Record<MoodScore, number> = { '2': 0, '1': 0, '0': 0, '-1': 0, '-2': 0 };
  for (const e of entries) counts[e.score] += 1;
  const total = entries.length;

  // Geometry : the SVG is 100×100 in user units. The track + arcs
  // are drawn at radius 42 with a 12-unit stroke, leaving a hollow
  // centre.
  const cx = 50;
  const cy = 50;
  const r = 42;
  const stroke = 12;
  const circumference = 2 * Math.PI * r;
  // Tiny visual gap between segments (in user units along the path).
  const gap = total > 0 ? 0.6 : 0;

  let cursor = 0;
  const arcs = DONUT_ORDER.map((score) => {
    if (total === 0) {
      return { score, length: 0, offset: 0, count: 0, midAngle: 0 };
    }
    const fraction = counts[score] / total;
    const length = Math.max(0, fraction * circumference - gap);
    // Mid-angle of the arc in the rotated frame — the donut group
    // is rotated -90° below so cell 0 starts at 12 o'clock ;
    // offsetting the angle by -π/2 here keeps the label maths in
    // sync with what the eye actually sees.
    const startRad = (cursor / circumference) * 2 * Math.PI - Math.PI / 2;
    const arcRad = fraction * 2 * Math.PI;
    const midAngle = startRad + arcRad / 2;
    const arc = { score, length, offset: cursor, count: counts[score], midAngle };
    cursor += fraction * circumference;
    return arc;
  });

  const activeCount = active !== null ? counts[active] : 0;
  // Label radius — sits just outside the donut's outer edge
  // (centerline at 42 + half-stroke 6 = 48, label at 58 leaves a
  // small gap so text doesn't hug the arc).
  const labelR = 58;

  return (
    <div className="relative mx-auto h-[180px] w-[180px]">
      <svg
        // viewBox is padded so the labels at radius 58 don't get
        // clipped on any edge.
        viewBox="-15 -15 130 130"
        className="h-full w-full"
        role="img"
        aria-label={tn('mood.donut.ariaLabel', total)}
      >
        {/* Donut group — rotated so the first arc starts at 12 o'clock. */}
        <g transform="rotate(-90 50 50)">
          {/* Track. Always drawn so the donut has shape even when
              there are no entries yet. */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            strokeWidth={stroke}
            className="stroke-bg-2"
          />
          {arcs.map((arc) =>
            arc.length > 0 ? (
              <circle
                key={arc.score}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                strokeWidth={stroke}
                strokeLinecap="butt"
                onMouseEnter={() => setHovered(arc.score)}
                onMouseLeave={() => setHovered(null)}
                onClick={() =>
                  setScoreFilter(scoreFilter === arc.score ? null : arc.score)
                }
                className={cn(
                  SCORE_STROKE[arc.score],
                  'cursor-pointer transition-opacity duration-150',
                  active !== null && active !== arc.score && 'opacity-30',
                )}
                strokeDasharray={`${arc.length} ${circumference - arc.length}`}
                strokeDashoffset={-arc.offset}
              />
            ) : null,
          )}
        </g>

        {/* Score labels outside each non-empty arc. Rendered without
            the donut's rotation so the text stays upright ; the
            angle was already pre-rotated in the arcs array. */}
        {arcs.map((arc) => {
          if (arc.length === 0) return null;
          const x = cx + labelR * Math.cos(arc.midAngle);
          const y = cy + labelR * Math.sin(arc.midAngle);
          const dimmed = active !== null && active !== arc.score;
          const display = Number(arc.score) > 0 ? `+${arc.score}` : arc.score;
          return (
            <text
              key={arc.score}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              className={cn(
                'pointer-events-none text-[9px] font-semibold tabular-nums transition-opacity duration-150',
                SCORE_LABEL_FILL[arc.score],
                dimmed && 'opacity-30',
              )}
            >
              {display}
            </text>
          );
        })}
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-150">
        {active !== null ? (
          <>
            <NoteBadge score={active} />
            <span className="mt-2 text-[12px] tabular-nums text-muted">
              {tn('mood.donut.centerCount', activeCount)}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}
