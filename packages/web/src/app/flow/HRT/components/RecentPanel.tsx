/**
 * HRT · RecentPanel — a Summary dashboard panel showing a short list of
 * recent entries (latest doses / latest lab results).
 *
 * Presentational shell : a bordered, **fill-less** frame (the charter
 * uses the page tone — never a white card) with a header (title + a link
 * to the matching detail view) and the caller's list as children. Fills
 * its grid cell's height (`h-full`) ; the list scrolls within so the
 * dashboard stays inside the viewport. The panel is read-only — the link
 * navigates to Administration / Analyses where rows are added / edited.
 */
import type { ReactNode } from 'react';

interface RecentPanelProps {
  title: string;
  /** Label for the detail-view link, e.g. « Voir les prises ». */
  linkLabel: string;
  onOpen: () => void;
  empty: boolean;
  emptyText: string;
  children: ReactNode;
}

export default function RecentPanel({
  title,
  linkLabel,
  onOpen,
  empty,
  emptyText,
  children,
}: RecentPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-hair p-4">
      <div className="mb-1 flex shrink-0 items-center justify-between gap-2">
        <h2 className="text-[13px] font-medium text-ink">{title}</h2>
        <button
          type="button"
          onClick={onOpen}
          className="shrink-0 text-[12px] text-muted hover:text-ink focus-visible:outline-accent focus-visible:outline-2"
        >
          {linkLabel} →
        </button>
      </div>
      {empty ? (
        <p className="py-6 text-center text-[12px] text-muted">{emptyText}</p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      )}
    </div>
  );
}
