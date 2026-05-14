import { useMemo } from 'react';
import { firstThread } from '@nodea/shared';

import { useNodeaStore } from '@/core/store/nodea-store';
import { cn } from '@/lib/utils';

import { useHomepageData } from '../context';
import { HOME_GOAL_LIMIT, STATUS_LABEL, STATUS_TONE } from '../lib/constants';
import { pickHomeGoals } from '../lib/intentions';
import HomeCard from './HomeCard';

const MONTHS_WINDOW = 12;

/**
 * Goals section on the Homepage. Two stacked subsections under
 * a single hairline-ruled header :
 *   - `EN COURS` — picks `wip` and recently-touched `open` goals
 *     via `pickHomeGoals` (same logic as the legacy
 *     `IntentionsBlock`). Capped at `HOME_GOAL_LIMIT`.
 *   - `RÉALISÉS · 12 MOIS` — most recent 3 by `completedAt`,
 *     rendered struck-through. Drops `null` completedAt rows
 *     (the field is only populated when a goal crosses into
 *     `done` ; older done goals from before that field landed
 *     won't surface here, by design).
 *
 * The card's eyebrow now folds the count in (« GOALS · 5 EN
 * COURS ») so the header reads in a single beat instead of two.
 */
export default function GoalsCard() {
  const { goals } = useHomepageData();
  const setModule = useNodeaStore((s) => s.setModule);
  const goToGoals = () => setModule('goals');

  const inProgress = useMemo(() => pickHomeGoals(goals), [goals]);

  const { completedRecent, completedCount } = useMemo(() => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - MONTHS_WINDOW);
    cutoff.setHours(0, 0, 0, 0);
    const cutoffTime = cutoff.getTime();
    const done = goals
      .filter((g) => g.status === 'done' && g.completedAt !== null)
      .filter((g) => {
        const t = Date.parse(g.completedAt as string);
        return Number.isFinite(t) && t >= cutoffTime;
      })
      .sort((a, b) =>
        (b.completedAt as string).localeCompare(a.completedAt as string),
      );
    return { completedRecent: done.slice(0, 3), completedCount: done.length };
  }, [goals]);

  return (
    <HomeCard
      title={`GOALS · ${inProgress.length} EN COURS`}
      cta={
        <button
          type="button"
          onClick={goToGoals}
          className="cursor-pointer underline-offset-2 transition-colors hover:text-accent hover:underline"
        >
          tout voir →
        </button>
      }
    >
      {inProgress.length === 0 ? (
        <p className="text-[12.5px] italic text-muted">Aucun goal en cours.</p>
      ) : (
        <ul className="space-y-1.5">
          {inProgress.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                onClick={goToGoals}
                className="group flex w-full cursor-pointer items-baseline gap-2 text-left text-[13px] text-ink transition-colors hover:text-accent"
                title={STATUS_LABEL[g.status]}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full border',
                    STATUS_TONE[g.status],
                  )}
                />
                <span className="min-w-0 flex-1 truncate">{g.title}</span>
                {g.thread ? (
                  <span className="shrink-0 text-[10px] uppercase tracking-[0.05em] text-muted">
                    {firstThread(g.thread)}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      {completedCount > 0 ? (
        <div className="mt-5">
          <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted">
            Réalisés · 12 mois · {completedCount}
          </p>
          <ul className="space-y-1.5">
            {completedRecent.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={goToGoals}
                  className="group flex w-full cursor-pointer items-baseline gap-2 text-left text-[13px] text-muted transition-colors hover:text-accent"
                >
                  <span
                    aria-hidden="true"
                    className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full border border-accent bg-accent"
                  />
                  <span className="min-w-0 flex-1 truncate line-through">
                    {g.title}
                  </span>
                </button>
              </li>
            ))}
            {completedCount > completedRecent.length ? (
              <li className="pl-[18px] text-[11px] text-muted">
                + {completedCount - completedRecent.length} de plus
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </HomeCard>
  );
}

export { HOME_GOAL_LIMIT };
