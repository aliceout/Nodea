import Subheader from '@/ui/layout/headers/Subheader';
import { useNodeaStore, selectUser } from '@/core/store/nodea-store';
import ChangeEmail from './components/ChangeEmail';
import ChangeUsername from './components/ChangeUsername';
import PasswordReset from './components/PasswordReset';
import DeleteAccount from './components/DeleteAccount';
import ImportData from './components/ImportData.jsx';
import ExportData from './components/ExportData.jsx';

/**
 * Account page — identité / données / danger.
 *
 * Import / Export sont réactivés (R1) : ils passent désormais par les
 * nouveaux clients typés (`moodClient`, `goalsClient`, etc.) et couvrent
 * les six modules (mood, goals, passage, habits_items, habits_logs,
 * library_items, library_reviews, review).
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
            <ChangeUsername />
            <ChangeEmail />
            <PasswordReset />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-800 dark:text-slate-100">Données</h2>
          <div className="flex flex-col gap-2 md:flex-row">
            <ImportData />
            <ExportData />
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
