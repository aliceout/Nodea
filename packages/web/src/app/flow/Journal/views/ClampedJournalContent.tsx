import { useMemo } from 'react';

import { LiteMarkdown } from '@/lib/lite-markdown';

/** Hand LiteMarkdown a bounded prefix rather than the whole entry —
 *  600 chars is far more than 4 lines, so the visible (clamped)
 *  result is identical while we skip building thousands of nodes for
 *  a multi-thousand-word entry (audit 2026-06 passe 2). */
const PREVIEW_MAX_CHARS = 600;

interface ClampedJournalContentProps {
  text: string;
}

/**
 * Inline preview of a journal entry's body — `LiteMarkdown` capped at
 * 4 *full* lines via `line-clamp` (CSS adds the ellipsis), so the last
 * visible line is never sliced in half and there's no fade. The whole
 * row is clickable to open the entry in the reader.
 */
export default function ClampedJournalContent({
  text,
}: ClampedJournalContentProps) {
  const preview = useMemo(() => {
    if (text.length <= PREVIEW_MAX_CHARS) return text;
    const cut = text.lastIndexOf(' ', PREVIEW_MAX_CHARS);
    return text.slice(0, cut > 0 ? cut : PREVIEW_MAX_CHARS);
  }, [text]);

  return <LiteMarkdown text={preview} className="line-clamp-4" />;
}
