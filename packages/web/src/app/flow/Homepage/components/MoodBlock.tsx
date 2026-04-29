import { useMemo } from 'react';

import { cn } from '@/lib/utils';

import { useHomepageData } from '../context';
import { MOOD_BLOCK_FILL, MOOD_FRISE_DAYS } from '../lib/constants';
import { formatMoodAvg } from '../lib/format';
import { buildMoodFrise, summariseMoodFrise } from '../lib/frise';
import SectionLabel from './SectionLabel';

/**
 * 14-day mood strip on the Home aside. Reads from the lifted
 * Homepage context — the same fetch powers `ToSeeList`'s dynamic
 * Mood task. Days without an entry render as a faint outline so
 * gaps stay visible without faking a zero.
 *
 * Smaller-by-design than the Mood page's 52-week frise — this is
 * a glance, not a chart. Click-through could land on
 * `/flow/mood` later if we want a navigable version.
 */
export default function MoodBlock() {
  const { mood } = useHomepageData();
  const cells = useMemo(() => buildMoodFrise(mood), [mood]);
  const stats = useMemo(() => summariseMoodFrise(cells), [cells]);

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <SectionLabel>Mood</SectionLabel>
        {stats.avg !== null ? (
          <span className="text-[12px] font-semibold tabular-nums text-accent">
            {formatMoodAvg(stats.avg)}
          </span>
        ) : null}
      </div>
      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${MOOD_FRISE_DAYS}, minmax(0, 1fr))` }}
        aria-hidden="true"
      >
        {cells.map((c) =>
          c.score ? (
            <span
              key={c.dateIso}
              title={`${c.dateIso} · ${c.score}`}
              className={cn(
                'aspect-square rounded-[2px]',
                MOOD_BLOCK_FILL[c.score],
                c.isToday && 'ring-2 ring-accent ring-offset-1 ring-offset-bg',
              )}
            />
          ) : (
            <span
              key={c.dateIso}
              className={cn(
                'aspect-square rounded-[2px] border border-hair/70',
                c.isToday && 'ring-2 ring-accent ring-offset-1 ring-offset-bg',
              )}
            />
          ),
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted">
        <span>
          {stats.count} {stats.count === 1 ? 'entrée' : 'entrées'} · {MOOD_FRISE_DAYS} j
        </span>
        {stats.avg !== null ? <span>moyenne {formatMoodAvg(stats.avg)}</span> : null}
      </div>
    </section>
  );
}
