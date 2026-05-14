import PageHeading from '@/ui/dirk/module/PageHeading';

import GoalsCard from '../components/GoalsCard';
import HeroEntry from '../components/HeroEntry';
import JournalHeatmap from '../components/JournalHeatmap';
import JournalFlashback from '../components/JournalFlashback';
import MoodBlock from '../components/MoodBlock';
import ReadingBlock from '../components/ReadingBlock';
import { useHomepageData } from '../context';

/**
 * Homepage primary column — typographic, hairline-ruled layout.
 *
 *   1. Greeting (serif, page anchor).
 *   2. Two-column row : latest journal Hero (left) · Écriture
 *      26-week strip (right). Opens the page on the narrative
 *      half + the writing-density half side-by-side.
 *   3. Two-column row : Mood 26-week frise (left) · Moments
 *      d'il y a un an (right). The flashback's typographic list
 *      balances the heatmap's grid visually.
 *   4. Two-column row : Lectures (left) · Goals (right).
 *
 * The visual rhythm is carried by hairline rules above each
 * section rather than card chrome. Nodea's homepage reads more
 * like a page of a notebook than a dashboard — flat surfaces,
 * generous vertical space, an eyebrow + body per section.
 */
export default function PrimaryColumn() {
  const { displayName } = useHomepageData();

  return (
    <section className="flex min-w-0 flex-col">
      <PageHeading className="mb-6">
        {displayName ? `Bonjour, ${displayName}.` : 'Bonjour.'}
      </PageHeading>

      <div className="grid grid-cols-1 gap-x-10 gap-y-6 lg:grid-cols-2">
        <HeroEntry />
        <JournalHeatmap />
      </div>

      <div className="mt-6 flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-x-10 gap-y-6 lg:grid-cols-2">
          <MoodBlock />
          <JournalFlashback />
        </div>
        <div className="grid grid-cols-1 gap-x-10 gap-y-6 lg:grid-cols-2">
          <ReadingBlock />
          <GoalsCard />
        </div>
      </div>
    </section>
  );
}
