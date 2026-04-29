import HabitsBlock from '../components/HabitsBlock';
import IntentionsBlock from '../components/IntentionsBlock';
import MoodBlock from '../components/MoodBlock';

/** Sticky aside on the Home page : Mood frise + Habits frise +
 *  Goals to-do list. All blocks read from the Homepage data
 *  context themselves — no prop drilling. */
export default function SideColumn() {
  return (
    <aside className="sticky top-20 flex min-w-0 flex-col gap-6 self-start">
      <MoodBlock />
      <HabitsBlock />
      <IntentionsBlock />
    </aside>
  );
}
