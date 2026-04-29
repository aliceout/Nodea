import type { MoodScore } from '@nodea/shared';

import { cn } from '@/lib/utils';

import { SCORE_TONE } from '../lib/constants';

/** Pill-shaped score chip used in the entry list and at the
 *  centre of the donut on hover. Positive scores get a `+`
 *  prefix so the sign is unambiguous (the negative ones already
 *  carry one). */
export default function NoteBadge({ score }: { score: MoodScore }) {
  const numeric = Number(score);
  const display = numeric > 0 ? `+${score}` : score;
  return (
    <span
      className={cn(
        'inline-flex h-[26px] min-w-[36px] items-center justify-center rounded-md px-1.5 text-[12px] font-semibold tabular-nums',
        SCORE_TONE[score],
      )}
    >
      {display}
    </span>
  );
}
