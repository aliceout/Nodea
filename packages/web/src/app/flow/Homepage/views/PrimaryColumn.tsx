import PageHeading from '@/ui/dirk/module/PageHeading';

import RecentPassage from '../components/RecentPassage';
import ReadingBlock from '../components/ReadingBlock';
import ToSeeList from '../components/ToSeeList';
import { useHomepageData } from '../context';

/** Primary column for the Home page : H1 « Bonjour … » + the
 *  three blocks stacked vertically (« À voir », « En cours de
 *  lecture », « Passage récent »). All blocks read from the
 *  Homepage data context themselves — no prop drilling. */
export default function PrimaryColumn() {
  const { displayName } = useHomepageData();
  return (
    <section className="flex min-h-0 min-w-0 flex-col">
      <PageHeading className="mb-0">
        {displayName ? `Bonjour, ${displayName}.` : 'Bonjour.'}
      </PageHeading>
      <p className="mt-1 mb-[22px] text-[14px] text-muted">
        Trois choses à voir aujourd&rsquo;hui.
      </p>

      <ToSeeList />
      <ReadingBlock />
      <RecentPassage />
    </section>
  );
}
