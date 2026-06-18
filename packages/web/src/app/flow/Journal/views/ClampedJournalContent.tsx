import { useLayoutEffect, useMemo, useRef, useState } from 'react';

import { LiteMarkdown } from '@/lib/lite-markdown';

const CLAMP_LINES = 4;
/** The CSS clamp shows at most 4 lines, but the old code parsed +
 *  built the DOM for the WHOLE entry before clamping (audit 2026-06
 *  passe 2) — a several-thousand-word journal entry rendered
 *  thousands of nodes for a 4-line preview. We hand LiteMarkdown a
 *  bounded prefix instead : 600 chars is far more than 4 lines, so
 *  the visible result is identical AND the overflow check still
 *  fires (a truncated entry always exceeds 4 lines → « lire la
 *  suite » shows, opening the full content in the reader). */
const PREVIEW_MAX_CHARS = 600;

interface ClampedJournalContentProps {
  text: string;
}

/**
 * Inline-list wrapper around `LiteMarkdown` that caps the preview
 * at ~4 lines so the list stays scannable when entries grow long.
 * Detects whether the content overflows post-render via a
 * `scrollHeight` check ; conditionally paints a fade gradient at
 * the bottom to signal there's more.
 *
 * No explicit « read more » trigger : the whole entry row is
 * clickable (the row owns a stretched button to the focus reader),
 * so the fade is the only overflow cue. No clamp = no extra DOM
 * (the fade is rendered only when `overflowing`), so short entries
 * stay visually pure.
 */
export default function ClampedJournalContent({
  text,
}: ClampedJournalContentProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  // Bounded preview text — cut on a word boundary near the cap so a
  // markdown marker isn't split mid-token any more than necessary.
  const preview = useMemo(() => {
    if (text.length <= PREVIEW_MAX_CHARS) return text;
    const cut = text.lastIndexOf(' ', PREVIEW_MAX_CHARS);
    return text.slice(0, cut > 0 ? cut : PREVIEW_MAX_CHARS);
  }, [text]);
  // A truncated entry is longer than the preview, so it definitely
  // overflows the 4-line clamp even if the measured prefix somehow
  // didn't — force the « read more » affordance in that case.
  const truncated = preview.length < text.length;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // +1 absorbs sub-pixel rounding so an entry that fits exactly
    // doesn't toggle to « overflowing » due to a 0.5 px diff.
    setOverflowing(truncated || el.scrollHeight > el.clientHeight + 1);
  }, [preview, truncated]);

  return (
    <div>
      <div className="relative">
        <div
          ref={ref}
          className="overflow-hidden"
          style={{ maxHeight: `${CLAMP_LINES}lh` }}
        >
          <LiteMarkdown text={preview} />
        </div>
        {overflowing ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[1.5lh] bg-gradient-to-t from-bg to-transparent"
          />
        ) : null}
      </div>
    </div>
  );
}
