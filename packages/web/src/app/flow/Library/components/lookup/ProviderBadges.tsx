import type { NormalisedBook } from '@nodea/shared';

import { cn } from '@/lib/utils';

import { PROVIDER_LABEL, PROVIDER_ORDER } from '@/ui/dirk/forms/constants';

interface ProviderBadgesProps {
  /** The provider whose record won the merge (got top
   *  billing). */
  primarySource: NormalisedBook['source'];
  /** Every provider that contributed to the merged record. */
  providers: NormalisedBook['providers'];
}

/**
 * Render a small row of provider badges for a deduped result —
 * the merge in the dispatcher accumulates `providers` across
 * every contributor, so on a popular book like a Werber novel
 * a row might show `OL · GB · Amz` even though a single
 * `book.source` field only points to one of them. The primary
 * source gets the accent-coloured badge, the rest stay muted.
 *
 * Use the canonical `PROVIDER_ORDER` so the badge row is stable
 * across re-renders (`Object.keys` order varies by JS engine
 * on some edge cases).
 */
export default function ProviderBadges({
  primarySource,
  providers,
}: ProviderBadgesProps) {
  const contributing = PROVIDER_ORDER.filter(
    (p) => providers[p as keyof NormalisedBook['providers']],
  );
  const list = contributing.length > 0 ? contributing : [primarySource];
  return (
    <span className="ml-1.5 flex shrink-0 items-center gap-0.5">
      {list.map((p) => (
        <span
          key={p}
          className={cn(
            'inline-flex h-5 items-center rounded px-1.5 text-[10px] font-semibold tracking-[0.04em]',
            p === primarySource
              ? 'bg-accent-soft text-accent-deep'
              : 'bg-bg-2 text-muted',
          )}
        >
          {PROVIDER_LABEL[p]}
        </span>
      ))}
    </span>
  );
}
