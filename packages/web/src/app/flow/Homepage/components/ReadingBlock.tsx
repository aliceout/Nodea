import { Link } from 'react-router-dom';

import { useHomepageData } from '../context';
import SectionLabel from './SectionLabel';

/**
 * « En cours de lecture » block on the home primary column.
 * Reads the in-progress library items from the homepage data
 * context. The block hides entirely when there's no
 * `in_progress` book — a user without an active read shouldn't
 * see an empty heading staring back.
 *
 * Each row is a `<Link>` to /flow/library ; opening a specific
 * book in detail (#?) is left for a follow-up.
 */
export default function ReadingBlock() {
  const { readings } = useHomepageData();
  if (readings.length === 0) return null;
  return (
    <section className="mt-7">
      <div className="mb-2 flex items-baseline justify-between">
        <SectionLabel>En cours de lecture</SectionLabel>
        <Link
          to="/flow/library"
          className="text-[11px] text-muted underline-offset-2 transition-colors hover:text-accent hover:underline"
        >
          tout voir →
        </Link>
      </div>
      <ul>
        {readings.map((b) => (
          <li
            key={b.id}
            className="flex items-baseline justify-between gap-3 border-b border-hair py-[5px] last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5 truncate text-[13px] font-medium text-ink">
                {b.isFavorite ? (
                  <span aria-hidden="true" className="text-accent">
                    ★
                  </span>
                ) : null}
                <span className="truncate">{b.title}</span>
              </div>
              {b.author ? (
                <div className="truncate text-[11px] text-muted">{b.author}</div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
