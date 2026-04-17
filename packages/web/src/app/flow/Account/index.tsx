import Subheader from '@/ui/layout/headers/Subheader';
import { useNodeaStore, selectUser } from '@/core/store/nodea-store';
import ChangeEmail from './components/ChangeEmail';
import PasswordReset from './components/PasswordReset';
import DeleteAccount from './components/DeleteAccount';
// Import/Export are still JSX during the transition; import with
// `.jsx` extension so the `*.jsx` ambient declaration kicks in.
import ImportData from './components/ImportData.jsx';
import ExportData from './components/ExportData.jsx';

/**
 * Account page.
 *
 * Three sections:
 *   - Identité (email, password)
 *   - Données (import / export)
 *   - Danger (suppression du compte)
 *
 * ChangeUsername was removed: the new users table has no username
 * column (email is the canonical identifier).
 * Import/Export are still the legacy JSX components pending their own
 * port to the new back in a follow-up commit.
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
          <h2 className="mb-3 text-lg font-semibold text-gray-800 dark:text-slate-100">Données</h2>
          <div className="flex flex-col gap-2 md:flex-row">
            <ImportData user={user} />
            <ExportData user={user} />
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
