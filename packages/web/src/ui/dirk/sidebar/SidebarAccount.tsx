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

interface AccountActionsProps {
  /** Closes the mobile drawer after a click (no-op on desktop). */
  onNavigate: () => void;
  /** `row` — the horizontal strip in the full sidebar header.
   *  `col` — the vertical icon column at the bottom of the icon rail,
   *  where the 68 px width can't hold the header strip. */
  orientation: 'row' | 'col';
}

/**
 * Account quick-actions — settings, admin shortcut (admins only), sign
 * out. Extracted from `SidebarHeader` so the same three buttons can live
 * either in the header (full sidebar) or in the rail's bottom column
 * (collapsed / medium screens), always in sync. Sign-out clears the
 * session and routes to `/login`.
 */
export default function AccountActions({ onNavigate, orientation }: AccountActionsProps) {
  const user = useNodeaStore(selectUser);
  const setModule = useNodeaStore((s) => s.setModule);
  const session = useSession();
  const navigate = useNavigate();
  const { t } = useI18n();
  const isAdmin = user?.role === 'admin';
  const col = orientation === 'col';

  async function handleSignOut(): Promise<void> {
    onNavigate();
    await session.logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className={cn('flex items-center', col ? 'flex-col gap-0.5' : 'gap-1 lg:gap-0.5')}>
      <ActionIcon
        icon={Cog6ToothIcon}
        label={t('layout.userMenu.profile', { defaultValue: 'Mon compte' })}
        col={col}
        onClick={() => {
          setModule('account');
          onNavigate();
        }}
      />
      {isAdmin ? (
        <ActionIcon
          icon={ShieldCheckIcon}
          label={t('layout.userMenu.admin', { defaultValue: 'Administration' })}
          col={col}
          onClick={() => {
            setModule('admin');
            onNavigate();
          }}
        />
      ) : null}
      <ActionIcon
        icon={ArrowRightOnRectangleIcon}
        label={t('layout.userMenu.signOut', { defaultValue: 'Se déconnecter' })}
        tone="danger"
        col={col}
        onClick={handleSignOut}
      />
    </div>
  );
}

interface ActionIconProps {
  icon: typeof Cog6ToothIcon;
  label: string;
  tone?: 'default' | 'danger';
  col: boolean;
  onClick: () => void;
}

function ActionIcon({ icon: Icon, label, tone = 'default', col, onClick }: ActionIconProps) {
  return (
    <Button
      variant={tone === 'danger' ? 'danger-ghost' : 'ghost'}
      size="xs"
      iconOnly
      onClick={onClick}
      aria-label={label}
      title={label}
      // Rail column: a comfortable 40 px square with a 5 px icon. Header
      // strip: large tap target on mobile, compact on desktop where it's
      // pointer-driven. Danger tone (sign out) shows red at rest.
      className={cn(
        col ? 'h-10 w-10' : 'h-10 w-10 lg:h-6 lg:w-6',
        tone === 'danger' && 'text-danger',
      )}
    >
      <Icon
        className={cn(col ? 'h-5 w-5' : 'h-5 w-5 lg:h-4 lg:w-4')}
        aria-hidden="true"
      />
    </Button>
  );
}
