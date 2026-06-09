import { useGoalsFilters } from '../context';
import GoalCardGrid from './GoalCardGrid';
import GoalsList from './GoalsList';

/**
 * Top-level Goals rendering surface. Picks between the grouped row
 * list (« Liste ») and the responsive card grid (« Cartes ») based
 * on the persisted `viewMode` exposed by the filters context. Both
 * surfaces read from the same `data` + `filters` contexts ; the
 * switch here is just a presentation choice.
 */
export default function PrimaryColumn() {
  const { viewMode } = useGoalsFilters();
  if (viewMode === 'cards') return <GoalCardGrid />;
  return <GoalsList />;
}
