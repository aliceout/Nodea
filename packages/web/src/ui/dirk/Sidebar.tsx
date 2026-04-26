import { Fragment, useState } from 'react';
import { Dialog, DialogPanel, Transition } from '@headlessui/react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRightOnRectangleIcon,
  BookOpenIcon,
  CalendarIcon,
  CheckCircleIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  FireIcon,
  HeartIcon,
  HomeIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

import { useSession } from '@/core/auth/use-session';
import {
  useNodeaStore,
  selectMobileMenuOpen,
  selectModules,
  selectUser,
} from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';
import ThemeToggle from '@/ui/dirk/ThemeToggle';

/**
 * Direction K · Sauge sidebar — replicates the handoff prototype
 * (`Design/design_handoff_nodea/source/dir-k.jsx → K_Sidebar`)
 * pixel-precise: 240px column on `bg-bg-2`, no chrome other than
 * the right hairline. Three sections (main / Library / Review)
 * separated by uppercase eyebrows; pulsing sync dot footer.
 *
 * Doubles as the mobile drawer (Headless UI Dialog) below `lg`.
 *
 * The username slot at the top opens a popover anchored to the
 * trigger — Profile / Settings / Admin (conditional) / Sign out.
 */

interface NavItem {
  id: string;
  label: string;
  /** Override the URL — defaults to `/flow/${id}` when omitted. */
  href?: string;
  /** Heroicon to render before the label. Main items only — sub-items
   * (Library / Review categories) sit under their group eyebrow and
   * stay icon-less for visual hierarchy. */
  icon?: typeof HomeIcon;
}

const MAIN_ITEMS: NavItem[] = [
  { id: 'home', label: 'Aujourd’hui', icon: HomeIcon },
  { id: 'mood', label: 'Mood', icon: HeartIcon },
  { id: 'journal', label: 'Journal', icon: DocumentTextIcon },
  { id: 'goals', label: 'Goals', icon: CheckCircleIcon },
  { id: 'habits', label: 'Habits', icon: FireIcon },
  { id: 'library', label: 'Library', icon: BookOpenIcon },
  { id: 'review', label: 'Review', icon: CalendarIcon },
];

interface SidebarShellProps {
  children: React.ReactNode;
}

/** Renders the sidebar twice: once as a static aside on `lg+`,
 *  once as a slide-in drawer on smaller screens. */
export default function Sidebar() {
  const open = useNodeaStore(selectMobileMenuOpen);
  const setOpen = useNodeaStore((s) => s.setMobileMenuOpen);

  return (
    <>
      <SidebarShell>
        <SidebarBody onNavigate={() => undefined} />
      </SidebarShell>

      <Transition show={open} as={Fragment}>
        <Dialog className="relative z-50 lg:hidden" onClose={() => setOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-in-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-in-out duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-ink/30" aria-hidden="true" />
          </Transition.Child>
          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-200 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <DialogPanel className="relative flex w-[240px] flex-1 bg-bg-2 border-r border-hair">
                <SidebarBody onNavigate={() => setOpen(false)} />
              </DialogPanel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}

function SidebarShell({ children }: SidebarShellProps) {
  return (
    <aside className="hidden w-[240px] shrink-0 border-r border-hair bg-bg-2 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
      {children}
    </aside>
  );
}

interface SidebarBodyProps {
  onNavigate: () => void;
}

function SidebarBody({ onNavigate }: SidebarBodyProps) {
  const { moduleId } = useParams();
  const current = moduleId ?? 'home';
  const modulesRuntime = useNodeaStore(selectModules);

  // Filter by toggle state, but keep the home item always visible.
  const enabledIds = new Set(
    Object.entries(modulesRuntime)
      .filter(([, entry]) => entry?.enabled)
      .map(([id]) => id),
  );

  const mainVisible = MAIN_ITEMS.filter(
    (item) => item.id === 'home' || enabledIds.has(item.id),
  );

  return (
    <nav className="flex h-full min-h-0 w-full flex-col gap-0.5 px-3 py-5">
      <SidebarHeader />

      <div className="flex flex-col gap-0.5">
        {mainVisible.map((item) => (
          <SidebarItem
            key={item.id}
            item={item}
            active={current === item.id}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      <div className="flex-1" />
      <SidebarFooter />
    </nav>
  );
}

function SidebarHeader() {
  return (
    <div className="flex items-center gap-2 px-2.5 pb-4 pt-1">
      <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-accent" />
      <span className="text-[14px] font-semibold tracking-[-0.01em] text-ink">Nodea</span>
      <UserMenu />
    </div>
  );
}

interface SidebarItemProps {
  item: NavItem;
  active: boolean;
  onNavigate: () => void;
}

function SidebarItem({ item, active, onNavigate }: SidebarItemProps) {
  const navigate = useNavigate();
  const href = item.href ?? `/flow/${item.id}`;
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={() => {
        navigate(href);
        onNavigate();
      }}
      data-active={active}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex w-full items-center rounded-md px-2.5 py-1.5 text-left transition-[background-color,color,transform] duration-200',
        'text-[13.5px] text-ink-soft',
        active
          ? 'bg-accent text-white'
          : 'hover:translate-x-0.5 hover:bg-bg hover:text-ink',
      )}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
        <span className="truncate">{item.label}</span>
      </span>
    </button>
  );
}

function SidebarFooter() {
  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-hair px-2.5 pt-2.5">
      <div className="flex items-center justify-between gap-2 text-[12px] text-muted">
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-[7px] w-[7px] animate-sync-pulse rounded-full bg-sync"
          />
          Synchronisé · à l’instant
        </span>
        <ThemeToggle />
      </div>
    </div>
  );
}

/**
 * Direct icon strip — settings (→ `Mon compte` with all its
 * Préférences / Modules / Identité tabs), an admin-only shield
 * shortcut, and a logout. The earlier dropdown indirection was
 * dropped: theme switch lives in the sidebar footer, the rest of
 * Mon compte is one click away via the cog.
 */
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
