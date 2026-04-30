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
    <div className="mt-3 flex flex-col gap-2 border-t border-hair px-1.5 pt-2.5">
      {/* Top row: sync indicator alone, full-width. Status reads
          first when the eye sweeps the footer top-to-bottom. */}
      <div className="flex items-center gap-2 text-[12px] text-muted">
        <span
          aria-hidden="true"
          className="h-[7px] w-[7px] animate-sync-pulse rounded-full bg-sync"
        />
        Synchronisé · à l’instant
      </div>
      {/* Bottom row: language and theme pickers side by side. The
          theme picker gets a slightly larger share (4:5 ratio,
          ~44/56) since its labels are wider (« Système » vs short
          autonyms like « FR ») — without that, the active theme
          label hits the truncate ellipsis at the default 50/50
          split. The flex bases keep both selects stable regardless
          of the active option (no more resize-on-pick). */}
      <div className="flex items-center gap-1.5">
        <LanguageToggle className="flex-4" />
        <ThemeToggle className="flex-5" />
      </div>
    </div>
  );
}
