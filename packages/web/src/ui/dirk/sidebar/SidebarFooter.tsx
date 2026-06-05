import { Cog6ToothIcon } from '@heroicons/react/24/outline';

import { useBackgroundShade } from '@/core/theme/useBackgroundShade';
import LanguageToggle from '@/ui/dirk/preferences/LanguageToggle';
import ThemeToggle from '@/ui/dirk/preferences/ThemeToggle';

/**
 * Bottom of the sidebar: sync indicator on top, then a row that
 * pairs the language picker (left) and the theme picker (right).
 *
 * The sync line is a placeholder for the real status — once the
 * encrypted-collection sync gets a proper offline / pending /
 * conflict state machine, this is where its summary lands.
 *
 * Side-effect : also mounts `useBackgroundShade` so the user's
 * chosen surface tint is applied to `<html>` as soon as the sidebar
 * renders post-auth. The picker itself lives in the settings tab —
 * here we just want the apply lifecycle to fire on every page, the
 * same way `ThemeToggle`'s `useTheme()` call applies the theme.
 */
export default function SidebarFooter() {
  useBackgroundShade();
  return (
    <div className="-mb-2.5 mt-3 flex flex-col gap-[5px] border-t border-hair px-1.5 pt-2.5 text-[12px] text-muted">
      {/* Sync status — first line, with the live dot anchored at the
          start so the eye lands on « state » first. The dot is
          centred in a fixed-width slot so its visual axis lines up
          column-perfect with the cog icon on the prefs line below
          (the cog is ~50 % wider than the dot, so without the slot
          the two indicators would drift apart horizontally). */}
      <div className="flex items-center gap-2">
        <span className="flex w-3 justify-center">
          <span
            aria-hidden="true"
            className="h-[7px] w-[7px] animate-sync-pulse rounded-full bg-sync"
          />
        </span>
        <span>Synchronisé · à l’instant</span>
      </div>
      {/* Preferences — second line, indented under the sync text so
          the two lines read as a stacked status panel à la macOS
          menu bar. Each label is a button : click cycles to the
          next value ; hover underlines + surfaces « current →
          next » as a tooltip. No icons, no chips — the footer
          stays purely typographic.
          5 px gap above this line so the prefs row reads as a
          tight follow-up to the sync line, while the footer's
          -mb-2.5 still cancels half of the nav wrapper's py-5
          below — the prefs row hugs the sync line and the bottom
          edge of the sidebar is the breathing space. */}
      <div className="flex items-center gap-2">
        <span className="flex w-3 justify-center">
          <Cog6ToothIcon
            aria-hidden="true"
            className="h-[11px] w-[11px] shrink-0 text-muted"
          />
        </span>
        <span>
          <LanguageToggle />
          <span aria-hidden="true" className="px-2">·</span>
          <ThemeToggle />
        </span>
      </div>
    </div>
  );
}
