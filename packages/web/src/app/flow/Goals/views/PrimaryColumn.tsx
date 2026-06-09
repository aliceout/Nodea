import GoalForm from '../components/GoalForm';
import { useGoalsActions, useGoalsFilters } from '../context';
import GoalCardGrid from './GoalCardGrid';
import GoalsList from './GoalsList';

/**
 * Top-level Goals rendering surface. Picks between the grouped row
 * list (« Liste ») and the responsive card grid (« Cartes ») based
 * on the persisted `viewMode` exposed by the filters context. Both
 * surfaces read from the same `data` + `filters` contexts ; the
 * switch here is just a presentation choice.
 *
 * Inline composer : when `formOpen` is true (the topbar
 * « + Nouvel objectif » CTA or a row's edit affordance flipped
 * it), `GoalForm` renders at the top of the surface, above the
 * list / cards. Cancel + post-save both call `closeForm` which
 * clears `editingEntry` and hides the form. Keyed on
 * `editingEntry?.id` so switching from edit-A to edit-B remounts
 * with the right initial values.
 */
export default function PrimaryColumn() {
  const { viewMode } = useGoalsFilters();
  const { formOpen, editingEntry, closeForm } = useGoalsActions();

  return (
    <div className="min-w-0">
      {formOpen ? (
        <GoalForm
          key={editingEntry?.id ?? 'create'}
          {...(editingEntry ? { initial: editingEntry } : {})}
          onClose={closeForm}
        />
      ) : null}
      {viewMode === 'cards' ? <GoalCardGrid /> : <GoalsList />}
    </div>
  );
}
