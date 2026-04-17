import Subheader from '@/ui/layout/headers/Subheader';
import { useNodeaStore, selectUser } from '@/core/store/nodea-store';
import ChangeEmail from './components/ChangeEmail';
import PasswordReset from './components/PasswordReset';
import DeleteAccount from './components/DeleteAccount';

/**
 * Account page.
 *
 * Two sections on the new stack:
 *   - Identité (email, password)
 *   - Danger (suppression du compte)
 *
 * ChangeUsername was removed: the new users table has no username
 * column (email is the canonical identifier).
 * Import / Export were legacy JSX that depended on the PB record APIs
 * + the old crypto chain; both have been removed pending a proper TSX
 * rewrite on top of the generic collection client.
 */
export default function AccountPage() {
  const user = useNodeaStore(selectUser);
  if (!user) return <div className="py-6">Chargement du compte…</div>;

  return (
    <div className="h-full bg-slate-50 transition-colors dark:bg-slate-900">
      <Subheader />
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-800 dark:text-slate-100">
            Informations personnelles
          </h2>
          <div className="flex flex-col gap-2">
            <ChangeEmail />
            <PasswordReset />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-rose-700 dark:text-rose-300">Danger</h2>
          <DeleteAccount />
        </section>
      </div>
    </div>
  );
}
