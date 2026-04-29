import SectionLabel from './SectionLabel';

/** Static mock block on the Home primary column — surfaces a
 *  recent journal passage as a teaser. The quote / source / page
 *  are hard-coded for the design hand-off ; once the journal
 *  search lands we'll plug in the real passage of the day. */
export default function RecentPassage() {
  return (
    <div className="mt-7">
      <SectionLabel>Passage récent</SectionLabel>
      <div className="py-1.5">
        <p className="font-serif text-[16px] leading-[1.5] text-ink">
          «&nbsp;Le jour où j&rsquo;ai compris que la lenteur n&rsquo;était pas un défaut.&nbsp;»
        </p>
        <p className="mt-1.5 text-[12px] text-muted">
          Slow Productivity, Cal Newport · p. 64 ·{' '}
          <button
            type="button"
            className="cursor-pointer text-accent transition-colors hover:text-accent-deep hover:underline"
          >
            voir tous les passages
          </button>
        </p>
      </div>
    </div>
  );
}
