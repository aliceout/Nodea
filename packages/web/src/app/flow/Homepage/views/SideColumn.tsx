import IntentionsBlock from '../components/IntentionsBlock';
import MoodBlock from '../components/MoodBlock';

/** Sticky aside on the Home page : Mood frise + Goals to-do list.
 *  All blocks read from the Homepage data context themselves —
 *  no prop drilling.
 *
 *  `HabitsBlock` was here too until the Habits module was put back
 *  in « dormant » mode (issue #98) — masking it in the sidebar
 *  while still showing its mock heatmap on the home aside would
 *  read as broken. Re-add the import + the render when the module
 *  ships for real. */
export default function SideColumn() {
  return (
    <aside className="sticky top-20 flex min-w-0 flex-col gap-6 self-start">
      <MoodBlock />
      <IntentionsBlock />
    </aside>
  );
}
