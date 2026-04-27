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

/**
 * Top of the sidebar: brand mark + small user-menu icon strip
 * (settings, admin shortcut, sign out). Direct icon strip rather
 * than a popover — the Settings page owns the bulk of « Mon
 * compte », so the strip just gives one-click shortcuts to it.
 */
export default function SidebarHeader() {
  return (
    <div className="flex items-center gap-2 px-2.5 pb-4 pt-1">
      <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-accent" />
      <span className="text-[14px] font-semibold tracking-[-0.01em] text-ink">Nodea</span>
      <UserMenu />
    </div>
  );
}

function UserMenu() {
  const user = useNodeaStore(selectUser);
  const session = useSession();
  const navigate = useNavigate();
  const { t } = useI18n();
  const isAdmin = user?.role === 'admin';

  async function handleSignOut(): Promise<void> {
    await session.logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="ml-auto flex items-center gap-0.5">
      <UserMenuIcon
        icon={Cog6ToothIcon}
        label={t('layout.userMenu.profile', { defaultValue: 'Mon compte' })}
        onClick={() => navigate('/flow/account')}
      />
      {isAdmin ? (
        <UserMenuIcon
          icon={ShieldCheckIcon}
          label={t('layout.userMenu.admin', { defaultValue: 'Administration' })}
          onClick={() => navigate('/flow/admin')}
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
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md transition-colors',
        tone === 'danger'
          ? 'text-muted hover:bg-danger/10 hover:text-danger'
          : 'text-muted hover:bg-bg-2 hover:text-ink',
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
