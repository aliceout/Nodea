import type { MoodScore } from '@nodea/shared';

import { cn } from '@/lib/utils';
import Tag from '@/ui/dirk/module/Tag';

import { SCORE_TONE } from '../lib/constants';

/**
 * Score chip in the entry list and at the donut centre on hover.
 * Built on the shared `Tag` pill (same shape as Journal threads /
 * Goals status) but keeps the per-score colour ramp (`SCORE_TONE`)
 * — the hue is the at-a-glance good/bad-day signal, so it overrides
 * Tag's sage default. Positive scores get a `+` so the sign is
 * unambiguous.
 */
export default function NoteBadge({ score }: { score: MoodScore }) {
  const numeric = Number(score);
  const display = numeric > 0 ? `+${score}` : score;
  return (
    <Tag className={cn('font-semibold tabular-nums', SCORE_TONE[score])}>
      {display}
    </Tag>
  );
}
