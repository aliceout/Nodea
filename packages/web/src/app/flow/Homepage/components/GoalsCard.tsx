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
 * Goals card on the Homepage. Two stacked sections under one
 * card header :
 *   - « En cours » — picks `wip` and recently-touched `open`
 *     goals via `pickHomeGoals` (same logic as the legacy
 *     `IntentionsBlock`). Capped at `HOME_GOAL_LIMIT`.
 *   - « Réalisés ces 12 mois » — count + the most recent 3 by
 *     `completedAt`. Drops `null` completedAt rows (the field is
 *     populated by the Goals page when a goal crosses into
 *     `done` ; older done goals from before that change won't
 *     surface here, by design).
 *
 * The card trails its header with the « en cours / 12 mois »
 * count pair so the user reads the state in two seconds.
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
      title="Goals"
      trailing={
        <span className="text-[11px] tabular-nums text-muted">
          {inProgress.length} en cours · {completedCount} sur 12 mois
        </span>
      }
      cta={
        <button
          type="button"
          onClick={goToGoals}
          className="cursor-pointer text-[11px] text-muted underline-offset-2 transition-colors hover:text-accent hover:underline"
        >
          tout voir →
        </button>
      }
    >
      <div className="space-y-5">
        <Subsection label="En cours">
          {inProgress.length === 0 ? (
            <p className="text-[12px] italic text-muted">Aucun goal en cours.</p>
          ) : (
            <ul className="space-y-1.5">
              {inProgress.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={goToGoals}
                    className="group flex w-full cursor-pointer items-baseline gap-2 text-left text-[12.5px] text-ink transition-colors hover:text-accent"
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
                      <span className="shrink-0 text-[10px] uppercase tracking-[0.04em] text-muted">
                        {firstThread(g.thread)}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Subsection>

        <Subsection label="Réalisés ces 12 mois">
          {completedCount === 0 ? (
            <p className="text-[12px] italic text-muted">
              Rien terminé sur les 12 derniers mois pour l’instant.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {completedRecent.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={goToGoals}
                    className="group flex w-full cursor-pointer items-baseline gap-2 text-left text-[12.5px] text-muted transition-colors hover:text-accent"
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
          )}
        </Subsection>
      </div>
    </HomeCard>
  );
}

function Subsection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-muted">
        {label}
      </p>
      {children}
    </div>
  );
}

// `HOME_GOAL_LIMIT` lives in constants — re-export here for
// callers that need to disable the cap on a richer page. Not
// used today; the card relies on the constant directly.
export { HOME_GOAL_LIMIT };
