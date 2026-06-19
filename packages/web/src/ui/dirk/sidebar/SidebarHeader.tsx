import { useNavigate } from 'react-router-dom';
import {
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

import { useSession } from '@/core/auth/use-session';
import { useNodeaStore, selectUser } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';
import Button from '@/ui/atoms/dirk/Button';
import NodeaSymbol from '@/ui/branding/NodeaSymbol';

interface SidebarHeaderProps {
  /** Closes the mobile drawer after a navigation click. Wired
   *  through from `Sidebar` (no-op on desktop, `setOpen(false)`
   *  on the mobile drawer) — without this hop the gear / shield
   *  icons changed the module but left the drawer pinned open.
   *  Required so callers can't accidentally drop the wiring. */
  onNavigate: () => void;
}

/**
 * Top of the sidebar: brand mark + small user-menu icon strip
 * (settings, admin shortcut, sign out). Direct icon strip rather
 * than a popover — the Settings page owns the bulk of « Mon
 * compte », so the strip just gives one-click shortcuts to it.
 */
export default function SidebarHeader({ onNavigate }: SidebarHeaderProps) {
  return (
    <div className="flex h-[52px] shrink-0 items-center gap-2 px-3">
      {/* Brand mark + wordmark are larger on mobile (the drawer is
          finger-driven) ; `lg:` restores the compact desktop sizes. */}
      <NodeaSymbol className="h-6 w-6 text-accent lg:h-4 lg:w-4" />
      <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink lg:text-[14px]">
        Nodea
      </span>
      <UserMenu onNavigate={onNavigate} />
    </div>
  );
}

interface UserMenuProps {
  onNavigate: () => void;
}

function UserMenu({ onNavigate }: UserMenuProps) {
  const user = useNodeaStore(selectUser);
  const setModule = useNodeaStore((s) => s.setModule);
  const session = useSession();
  const navigate = useNavigate();
  const { t } = useI18n();
  const isAdmin = user?.role === 'admin';

  async function handleSignOut(): Promise<void> {
    onNavigate();
    await session.logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="ml-auto flex items-center gap-1 lg:gap-0.5">
      <UserMenuIcon
        icon={Cog6ToothIcon}
        label={t('layout.userMenu.profile', { defaultValue: 'Mon compte' })}
        onClick={() => {
          setModule('account');
          onNavigate();
        }}
      />
      {isAdmin ? (
        <UserMenuIcon
          icon={ShieldCheckIcon}
          label={t('layout.userMenu.admin', { defaultValue: 'Administration' })}
          onClick={() => {
            setModule('admin');
            onNavigate();
          }}
        />
      ) : null}
      <UserMenuIcon
        icon={ArrowRightOnRectangleIcon}
        label={t('layout.userMenu.signOut', { defaultValue: 'Se déconnecter' })}
        tone="danger"
        onClick={handleSignOut}
      />
    </div>
  );
}

interface UserMenuIconProps {
  icon: typeof Cog6ToothIcon;
  label: string;
  tone?: 'default' | 'danger';
  onClick: () => void;
}

function UserMenuIcon({ icon: Icon, label, tone = 'default', onClick }: UserMenuIconProps) {
  return (
    <Button
      variant={tone === 'danger' ? 'danger-ghost' : 'ghost'}
      size="xs"
      iconOnly
      onClick={onClick}
      aria-label={label}
      title={label}
      // Larger tap target on mobile (40px) ; compact (h-6) on desktop
      // where it's pointer-driven. Danger tone (sign out) shows red at
      // rest — not just on hover — so it's easy to spot.
      className={cn('h-10 w-10 lg:h-6 lg:w-6', tone === 'danger' && 'text-danger')}
    >
      <Icon className="h-5 w-5 lg:h-4 lg:w-4" aria-hidden="true" />
    </Button>
  );
}
