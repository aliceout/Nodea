import useAuth from "@/core/auth/useAuth";
import Subheader from "@/ui/layout/headers/Subheader";
import ChangeEmail from "./components/ChangeEmail";
import ChangeUsername from "./components/ChangeUsername";
import ChangePassword from "./components/PasswordReset";
import DeleteAccount from "./components/DeleteAccount";
import ImportData from "./components/ImportData";
import ExportData from "./components/ExportData";

export default function AccountIndex() {
  const { user } = useAuth();
  if (!user) return <div className="py-6">Chargement du compte…</div>;

  return (
    <div className="h-full bg-slate-50 transition-colors dark:bg-slate-900">
      <Subheader />
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
        <div>
          <h2 className="mb-3 text-lg font-semibold text-gray-800 dark:text-slate-100">
            Informations personnelles
          </h2>
          <div className="flex flex-col gap-2">
            <ChangeEmail user={user} />
            <ChangeUsername user={user} />
            <ChangePassword user={user} />
          </div>
        </div>
        <div>
          <h2 className="mb-3 text-lg font-semibold text-gray-800 dark:text-slate-100">
            Données
          </h2>
          <div className="flex flex-col gap-2 md:flex-row">
            <ImportData user={user} />
            <ExportData user={user} />
          </div>
        </div>
        <div>
          <h2 className="mb-3 text-lg font-semibold text-rose-700 dark:text-rose-300">
            Danger
          </h2>
          <DeleteAccount user={user} />
        </div>
      </div>
    </div>
  );
}
