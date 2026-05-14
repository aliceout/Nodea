import { useNodeaStore } from '@/core/store/nodea-store';

import { useHomepageData } from '../context';
import HomeCard from './HomeCard';

/**
 * Lectures card on the Homepage. Reads the in-progress library
 * items from the homepage data context (`projectLibraryReadings`
 * already filters on `status === 'in_progress'`). Each row is a
 * button that opens the Library module ; opening a specific book
 * in detail is left for a follow-up.
 *
 * Hides the body — but keeps the card chrome — when there's no
 * in-progress book, with an « rien en cours » placeholder.
 */
export default function ReadingBlock() {
  const { readings } = useHomepageData();
  const setModule = useNodeaStore((s) => s.setModule);
  const goToLibrary = () => setModule('library');

  return (
    <HomeCard
      title={`EN COURS · ${readings.length}`}
      cta={
        <button
          type="button"
          onClick={goToLibrary}
          className="cursor-pointer underline-offset-2 transition-colors hover:text-accent hover:underline"
        >
          tout voir →
        </button>
      }
    >
      {readings.length === 0 ? (
        <p className="text-[12px] italic text-muted">Rien en cours pour l’instant.</p>
      ) : (
        <ul className="space-y-1.5">
          {readings.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={goToLibrary}
                className="group flex w-full cursor-pointer items-baseline gap-2 text-left transition-colors"
                title={b.author ? `${b.title} — ${b.author}` : b.title}
              >
                {b.isFavorite ? (
                  <span aria-hidden="true" className="shrink-0 text-accent">★</span>
                ) : null}
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink transition-colors group-hover:text-accent">
                  {b.title}
                </span>
                {b.author ? (
                  <span className="shrink-0 truncate text-[11px] text-muted">
                    {b.author}
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
