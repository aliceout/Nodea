import { Bars3Icon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';

import { useSession } from '@/core/auth/use-session';
import { useNodeaStore, selectUser } from '@/core/store/nodea-store';

import HeaderNav from '../components/HeaderNav.jsx';
import Logo from '@/ui/branding/LogoLong.jsx';
import UserMenu from '../components/UserMenu.jsx';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import ThemeSelector from '@/ui/atoms/specifics/ThemeSelector';

/**
 * Top header.
 *
 * - Display name preference: `users.username` if set, else the email
 *   local-part. Users can pick a public username from Account.
 * - Mobile-menu drawer open/close now lives in the Zustand store
 *   (`mobileMenuOpen` + `setMobileMenuOpen`). Sidebar reads the same
 *   slice.
 * - Logout goes through `useSession.logout()` which wipes the store
 *   and calls `/auth/logout` on the new back.
 */
export default function Header() {
  const navigate = useNavigate();
  const user = useNodeaStore(selectUser);
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const session = useSession();
  const { t } = useI18n();

  const username =
    user?.username ||
    user?.email?.split('@')[0] ||
    t('layout.header.defaultUsername', { defaultValue: 'moi' });

  const handleMenuClick = () => setMobileMenuOpen(true);
  const handleGoAccount = () => navigate('/flow/account');
  const handleGoSettings = () => navigate('/flow/settings');
  const handleSignOut = async () => {
    await session.logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 w-screen items-center border-b border-gray-200 bg-white px-4 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:shadow-none sm:px-6 lg:px-8">
      <div className="mx-auto w-full">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-end gap-4">
            <button
              type="button"
              className="-m-2.5 p-2.5 text-gray-700 lg:hidden dark:text-slate-200"
              onClick={handleMenuClick}
              aria-label={t('layout.header.openMenu', { defaultValue: 'Ouvrir le menu' })}
            >
              <Bars3Icon aria-hidden="true" className="h-6 w-6" />
            </button>
            <div className="hidden h-8 items-center md:flex">
              <Logo className="max-h-full w-auto" />
            </div>
            <HeaderNav />
          </div>
          <div className="flex h-8 items-center md:hidden">
            <Logo className="max-h-full w-auto" />
          </div>
          <div className="flex items-center justify-end gap-x-3 sm:gap-x-4 lg:gap-x-6">
            <ThemeSelector variant="compact" className="flex-shrink-0" />
            <UserMenu
              username={username}
              onGoAccount={handleGoAccount}
              onGoSettings={handleGoSettings}
              onSignOut={handleSignOut}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
