import { useMemo } from 'react';
import { firstThread } from '@nodea/shared';

import { useNodeaStore } from '@/core/store/nodea-store';
import { cn } from '@/lib/utils';

import { useHomepageData } from '../context';
import { STATUS_LABEL, STATUS_TONE } from '../lib/constants';
import { pickHomeGoals } from '../lib/intentions';
import SectionLabel from './SectionLabel';

/**
 * Real-data block on the Home aside : surfaces the goals the
 * user is actively working on (`wip`) plus the most recently
 * touched `open` goals as a short to-do list. Done goals are
 * filtered out — the block is for « what's on my plate », not
 * « what I've achieved » (the Goals page archives section
 * covers the latter).
 *
 * Selection logic lives in `lib/intentions.ts` (`pickHomeGoals`) :
 * `wip` first (most recently updated), then `open` (most recently
 * updated), capped at `HOME_GOAL_LIMIT`. Each row is a button
 * that takes the user to the Goals page — no individual focus
 * reader yet (#64 tracks that).
 */
export default function IntentionsBlock() {
  const { goals } = useHomepageData();
  const setModule = useNodeaStore((s) => s.setModule);
  const goToGoals = () => setModule('goals');
  const visible = useMemo(() => pickHomeGoals(goals), [goals]);

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <SectionLabel>Goals</SectionLabel>
        <button
          type="button"
          onClick={goToGoals}
          className="cursor-pointer text-[11px] text-muted underline-offset-2 transition-colors hover:text-accent hover:underline"
        >
          tout voir →
        </button>
      </div>
      {visible.length === 0 ? (
        <p className="text-[12px] italic text-muted">
          Aucun goal en cours.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {visible.map((g) => (
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
    </section>
  );
}
