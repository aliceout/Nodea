import { Fragment, useEffect, useRef, useState } from 'react';
import { Dialog, DialogPanel, Transition } from '@headlessui/react';
import { useNavigate, useParams } from 'react-router-dom';

import { useSession } from '@/core/auth/use-session';
import {
  useNodeaStore,
  selectMobileMenuOpen,
  selectModules,
  selectUser,
} from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';

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
  count?: number | string;
  /** Override the URL — defaults to `/flow/${id}` when omitted. */
  href?: string;
}

/* Counters are placeholders until we wire real data. The handoff
 * mocks them ("116 / 42 / 5 / 4") so the sidebar reads as designed.
 * Replace with selectors over the entries slices once available. */
const MAIN_ITEMS: NavItem[] = [
  { id: 'home', label: 'Aujourd’hui', count: 3 },
  { id: 'mood', label: 'Mood', count: 116 },
  { id: 'passage', label: 'Passages', count: 42 },
  { id: 'goals', label: 'Goals', count: 5 },
  { id: 'habits', label: 'Habits', count: 4 },
];

const LIBRARY_ITEMS: NavItem[] = [
  { id: 'library', label: 'En cours', count: 3 },
  { id: 'library-toread', label: 'À lire', count: 14, href: '/flow/library' },
  { id: 'library-done', label: 'Terminés', count: 38, href: '/flow/library' },
];

const REVIEW_ITEMS: NavItem[] = [
  { id: 'review', label: 'Cette semaine' },
  { id: 'review-month', label: 'Ce mois', href: '/flow/review' },
  { id: 'review-year', label: 'L’année', href: '/flow/review' },
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
  const showLibrary = enabledIds.has('library');
  const showReview = enabledIds.has('review');

  return (
    <nav className="flex w-full flex-col gap-0.5 px-3 py-5">
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

      {showLibrary ? (
        <SidebarSection title="Library">
          {LIBRARY_ITEMS.map((item) => (
            <SidebarItem
              key={item.id}
              item={item}
              active={current === 'library' && item.id === 'library'}
              onNavigate={onNavigate}
            />
          ))}
        </SidebarSection>
      ) : null}

      {showReview ? (
        <SidebarSection title="Review">
          {REVIEW_ITEMS.map((item) => (
            <SidebarItem
              key={item.id}
              item={item}
              active={current === 'review' && item.id === 'review'}
              onNavigate={onNavigate}
            />
          ))}
        </SidebarSection>
      ) : null}

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
        'group flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left transition-[background-color,color,transform] duration-200',
        'text-[13.5px] text-ink-soft',
        active
          ? 'bg-accent text-white'
          : 'hover:translate-x-0.5 hover:bg-bg hover:text-ink',
      )}
    >
      <span>{item.label}</span>
      {item.count !== undefined ? (
        <span
          className={cn(
            'text-[12px] tabular-nums',
            active ? 'text-white/85' : 'text-muted',
          )}
        >
          {item.count}
        </span>
      ) : null}
    </button>
  );
}

interface SidebarSectionProps {
  title: string;
  children: React.ReactNode;
}

function SidebarSection({ title, children }: SidebarSectionProps) {
  return (
    <>
      <div className="px-2.5 pb-1.5 pt-5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">
        {title}
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </>
  );
}

function SidebarFooter() {
  return (
    <div className="mt-3 flex items-center gap-2 border-t border-hair px-2.5 pt-2.5 text-[12px] text-muted">
      <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-sync animate-sync-pulse" />
      Synchronisé · à l’instant
    </div>
  );
}

function UserMenu() {
  const user = useNodeaStore(selectUser);
  const session = useSession();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const displayName =
    user?.username ||
    user?.email?.split('@')[0] ||
    t('layout.header.defaultUsername', { defaultValue: 'moi' });
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!open) return undefined;
    function handleDocMouseDown(event: MouseEvent): void {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target as Node)) return;
      setOpen(false);
    }
    function handleKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleDocMouseDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDocMouseDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  function go(path: string): void {
    setOpen(false);
    navigate(path);
  }

  async function handleSignOut(): Promise<void> {
    setOpen(false);
    await session.logout();
    navigate('/login', { replace: true });
  }

  return (
    <div ref={rootRef} className="relative ml-auto">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded px-1 py-0.5 text-[11px] tabular-nums text-muted transition-colors hover:text-ink"
      >
        {displayName}
      </button>

      {open ? (
        <div
          role="menu"
          className="animate-fade-up absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-md border border-hair bg-bg shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
        >
          <button
            role="menuitem"
            type="button"
            onClick={() => go('/flow/account')}
            className="block w-full px-3 py-2 text-left text-[13px] text-ink-soft transition-colors hover:bg-bg-2 hover:text-ink"
          >
            {t('layout.userMenu.profile', { defaultValue: 'Mon compte' })}
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => go('/flow/settings')}
            className="block w-full px-3 py-2 text-left text-[13px] text-ink-soft transition-colors hover:bg-bg-2 hover:text-ink"
          >
            {t('layout.userMenu.settings', { defaultValue: 'Paramètres' })}
          </button>
          {isAdmin ? (
            <button
              role="menuitem"
              type="button"
              onClick={() => go('/flow/admin')}
              className="block w-full px-3 py-2 text-left text-[13px] text-ink-soft transition-colors hover:bg-bg-2 hover:text-ink"
            >
              {t('layout.userMenu.admin', { defaultValue: 'Administration' })}
            </button>
          ) : null}
          <button
            role="menuitem"
            type="button"
            onClick={handleSignOut}
            className="block w-full border-t border-hair px-3 py-2 text-left text-[13px] text-danger transition-colors hover:bg-danger/5"
          >
            {t('layout.userMenu.signOut', { defaultValue: 'Se déconnecter' })}
          </button>
        </div>
      ) : null}
    </div>
  );
}
