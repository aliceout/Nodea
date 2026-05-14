import { useLayoutEffect, useRef, useState } from 'react';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import { LiteMarkdown } from '@/lib/lite-markdown';

const CLAMP_LINES = 4;

interface ClampedJournalContentProps {
  text: string;
  /** Called when the user clicks the « lire la suite » affordance.
   *  Wired by the row to its `onRead` so the expansion route is
   *  the same as the « Lire » hover action — the focus reader. */
  onExpand: () => void;
}

/**
 * Inline-list wrapper around `LiteMarkdown` that caps the preview
 * at ~4 lines so the list stays scannable when entries grow long.
 * Detects whether the content overflows post-render via a
 * `scrollHeight` check ; conditionally paints a fade gradient at
 * the bottom + a discreet « lire la suite » trigger that opens
 * the focus reader.
 *
 * No clamp = no extra DOM (the fade and the link are rendered
 * only when `overflowing`), so short entries stay visually pure.
 */
export default function ClampedJournalContent({
  text,
  onExpand,
}: ClampedJournalContentProps) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // +1 absorbs sub-pixel rounding so an entry that fits exactly
    // doesn't toggle to « overflowing » due to a 0.5 px diff.
    setOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [text]);

  return (
    <div>
      <div className="relative">
        <div
          ref={ref}
          className="overflow-hidden"
          style={{ maxHeight: `${CLAMP_LINES}lh` }}
        >
          <LiteMarkdown text={text} />
        </div>
        {overflowing ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[1.5lh] bg-gradient-to-t from-bg to-transparent"
          />
        ) : null}
      </div>
      {overflowing ? (
        <button
          type="button"
          onClick={onExpand}
          className="mt-1 cursor-pointer text-[12px] text-accent underline-offset-2 transition-colors hover:underline"
        >
          {t('journal.clamped.readMore')}
        </button>
      ) : null}
    </div>
  );
}
