import { useMemo } from 'react';
import { firstThread } from '@nodea/shared';

import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';

import { useHomepageData } from '../context';
import { HOME_GOAL_LIMIT, STATUS_TONE } from '../lib/constants';
import { pickHomeGoals } from '../lib/intentions';
import HomeCard from './HomeCard';

/**
 * Goals section on the Homepage — a single « EN COURS » list of
 * `wip` and recently-touched `open` goals picked by
 * `pickHomeGoals`. Capped at `HOME_GOAL_LIMIT`.
 *
 * The « RÉALISÉS · 12 MOIS » subsection was removed so the card's
 * height matches the Mood heatmap card on the same row (Goals was
 * stretching the bottom row taller than the top, breaking the
 * 2×2 visual symmetry between the four cards).
 *
 * The card's eyebrow folds the count in (« GOALS · 5 EN COURS »)
 * so the header reads in a single beat instead of two.
 */
export default function GoalsCard() {
  const { t } = useI18n();
  const { goals } = useHomepageData();
  const setModule = useNodeaStore((s) => s.setModule);
  const goToGoals = () => setModule('goals');

  const inProgress = useMemo(() => pickHomeGoals(goals), [goals]);

  return (
    <HomeCard
      title={t('home.goals.eyebrow', { values: { count: inProgress.length } })}
      cta={
        <button
          type="button"
          onClick={goToGoals}
          className="cursor-pointer underline-offset-2 transition-colors hover:text-accent hover:underline"
        >
          {t('home.viewAll')} →
        </button>
      }
    >
      {inProgress.length === 0 ? (
        <p className="text-[12.5px] italic text-muted">{t('home.goals.empty')}</p>
      ) : (
        <ul className="space-y-1.5">
          {inProgress.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                onClick={goToGoals}
                className="group flex w-full cursor-pointer items-baseline gap-2 text-left text-[13px] text-ink transition-colors hover:text-accent"
                title={t(`home.goals.status.${g.status}`)}
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

    </HomeCard>
  );
}

export { HOME_GOAL_LIMIT };
