import LanguageToggle from '@/ui/dirk/LanguageToggle';
import ThemeToggle from '@/ui/dirk/ThemeToggle';

/**
 * Bottom of the sidebar: sync indicator on top, then a row that
 * pairs the language picker (left) and the theme picker (right).
 *
 * The sync line is a placeholder for the real status — once the
 * encrypted-collection sync gets a proper offline / pending /
 * conflict state machine, this is where its summary lands.
 */
export default function SidebarFooter() {
  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-hair px-2.5 pt-2.5">
      {/* Top row: sync indicator alone, full-width. Status reads
          first when the eye sweeps the footer top-to-bottom. */}
      <div className="flex items-center gap-2 text-[12px] text-muted">
        <span
          aria-hidden="true"
          className="h-[7px] w-[7px] animate-sync-pulse rounded-full bg-sync"
        />
        Synchronisé · à l’instant
      </div>
      {/* Bottom row: language select on the left, theme picker on
          the right. `justify-between` pins each to its own edge so
          the two read as peer widgets rather than huddled. */}
      <div className="flex items-center justify-between gap-1.5">
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </div>
  );
}
