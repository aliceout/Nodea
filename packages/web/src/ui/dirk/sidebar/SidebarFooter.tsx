import { Cog6ToothIcon } from '@heroicons/react/24/outline';

import { useBackgroundShade } from '@/core/theme/useBackgroundShade';
import { cn } from '@/lib/utils';
import LanguageToggle from '@/ui/dirk/preferences/LanguageToggle';
import ThemeToggle from '@/ui/dirk/preferences/ThemeToggle';

import AccountActions from './SidebarAccount';

interface SidebarFooterProps {
  /** Closes the mobile drawer after a click (no-op on desktop). Used by
   *  the rail's account column. */
  onNavigate: () => void;
  /** Desktop shell only: the user's persisted collapse choice. */
  collapsed?: boolean;
  /** True inside the mobile drawer — always the full footer. */
  drawer?: boolean;
}

/**
 * Bottom of the sidebar.
 *
 * Full sidebar / drawer: a single row pairing the language picker (left)
 * and theme picker (right), each its own hover-fill button.
 *
 * Icon rail (collapsed / `md`–`lg`): the typographic prefs don't fit 68 px,
 * so the footer instead carries the account actions (settings / admin /
 * sign out) as a centered icon column — they live in the header in the full
 * sidebar and drop here in the rail (the user's chosen placement). Theme /
 * language stay reachable via settings.
 *
 * Side-effect: mounts `useBackgroundShade` so the user's chosen surface tint
 * is applied to `<html>` as soon as the sidebar renders post-auth.
 */
export default function SidebarFooter({
  onNavigate,
  collapsed = false,
  drawer = false,
}: SidebarFooterProps) {
  useBackgroundShade();

  // Shown in the rail (forced when collapsed, automatic on `md`–`lg`),
  // hidden in the full sidebar and the drawer.
  const railOnly = drawer ? 'hidden' : collapsed ? 'flex' : 'flex lg:hidden';
  // The mirror image — the full footer.
  const fullOnly = drawer ? 'flex' : collapsed ? 'hidden' : 'hidden lg:flex';

  return (
    <div className="flex flex-col gap-0.5 text-[12px] text-muted">
      {/* Rail — account actions as a centered icon column. */}
      <div className={cn('flex-col items-center gap-0.5 pb-1', railOnly)}>
        <AccountActions onNavigate={onNavigate} orientation="col" />
      </div>

      {/* Full sidebar / drawer — language·theme prefs. Same row shape as the
          collapse toggle above (px-2.5, h-4 icon, gap-2.5) so the whole
          bottom cluster reads as one aligned list. Each label is its own
          button: click cycles to the next value; hover surfaces
          « current → next » as a tooltip and its own hover-fill pill (same
          fill as the collapse toggle), so language and theme highlight
          independently. */}
      <div className={cn('flex-col gap-0.5', fullOnly)}>
        <div className="flex items-center gap-2.5 px-2.5 py-1.5">
          <Cog6ToothIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-muted" />
          <span className="-mx-1.5 flex items-center">
            <LanguageToggle />
            <span aria-hidden="true" className="px-0.5">·</span>
            <ThemeToggle />
          </span>
        </div>
      </div>
    </div>
  );
}
