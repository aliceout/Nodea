import EmptyHint from '@/ui/dirk/EmptyHint';
import GroupBlock from '@/ui/dirk/GroupBlock';
import PageHeading from '@/ui/dirk/PageHeading';

import { useGoalsData, useGoalsFilters } from '../context';
import GoalRow from './GoalRow';

/**
 * Main rendering surface — page heading, error / loading / empty
 * states, and the grouped list of goals. Reads `load` / `stats`
 * from data and `groups` from filters ; no props.
 */
export default function PrimaryColumn() {
  const { load, stats } = useGoalsData();
  const { groups } = useGoalsFilters();

  return (
    <section className="flex min-w-0 flex-col">
      <PageHeading>Goals</PageHeading>

      {load.status === 'error' ? (
        <p
          role="alert"
          className="mb-4 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[12px] text-danger"
        >
          {load.message}
        </p>
      ) : null}

      <div>
        {load.status === 'loading' && stats.total === 0 ? (
          <EmptyHint>Chargement des objectifs…</EmptyHint>
        ) : groups.length === 0 ? (
          <EmptyHint>Aucun objectif pour cette sélection.</EmptyHint>
        ) : (
          groups.map(([groupLabel, items]) => (
            <GroupBlock
              key={groupLabel}
              label={groupLabel}
              count={items.length}
              countNoun="objectif"
              variant="eyebrow"
            >
              {items.map((entry) => (
                <GoalRow key={entry.id} entry={entry} />
              ))}
            </GroupBlock>
          ))
        )}
      </div>
    </section>
  );
}
