import { cn } from '@/lib/utils';
import NodeaSymbol from '@/ui/branding/NodeaSymbol';

import AccountActions from './SidebarAccount';

interface SidebarHeaderProps {
  /** Closes the mobile drawer after a navigation click. Wired through
   *  from `Sidebar` (no-op on desktop). */
  onNavigate: () => void;
  /** Desktop shell only: the user's persisted collapse choice. */
  collapsed?: boolean;
  /** True inside the mobile drawer — always rendered full, never a rail. */
  drawer?: boolean;
}

/**
 * Top of the sidebar: brand mark + wordmark + the account quick-action
 * strip (settings, admin, sign out — see `SidebarAccount`).
 *
 * In the icon rail (collapsed, or the `md`–`lg` auto-rail) only the brand
 * symbol stays, centered; the wordmark hides and the account strip drops
 * to a vertical column at the bottom of the rail (`SidebarFooter`), since
 * the 68 px width can't hold the header strip.
 */
export default function SidebarHeader({
  onNavigate,
  collapsed = false,
  drawer = false,
}: SidebarHeaderProps) {
  // The rail is forced when `collapsed`, automatic on `md`–`lg` (hence the
  // `lg:` variants when not collapsed), and never in the drawer.
  const wordmarkHidden = drawer ? '' : collapsed ? 'hidden' : 'hidden lg:inline';

  return (
    <div
      className={cn(
        'flex h-[52px] shrink-0 items-center gap-2 px-3',
        drawer ? '' : collapsed ? 'justify-center' : 'justify-center lg:justify-start',
      )}
    >
      <NodeaSymbol
        className={cn(
          // Indented to line up with the nav icons in the full sidebar
          // (header `px-3` + this `ml-2.5` = nav `px-3` + button `px-2.5`);
          // no indent in the rail where it's centered.
          'h-7 w-7 text-accent lg:h-6 lg:w-6',
          drawer ? 'ml-2.5' : collapsed ? '' : 'lg:ml-2.5',
        )}
      />
      <span
        className={cn(
          'text-[16px] font-semibold tracking-[-0.01em] text-ink lg:text-[14px]',
          wordmarkHidden,
        )}
      >
        Nodea
      </span>
      <div
        className={cn(
          'ml-auto',
          drawer ? 'flex' : collapsed ? 'hidden' : 'hidden lg:flex',
        )}
      >
        <AccountActions onNavigate={onNavigate} orientation="row" />
      </div>
    </div>
  );
}
