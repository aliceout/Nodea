import useAuth from "@/hooks/useAuth"; // si tu n'as pas d'alias "@", remplace par "../../hooks/useAuth"


export default function SettingsIndex() {
  const { user } = useAuth();
  
  // petite garde pour éviter un écran blanc si user pas encore dispo
  if (!user) {
    return <div className="py-6">Chargement du compte…</div>;
  }
  
  return (
    <div className="h-full">
      <Subheader />
      <div className="mx-auto max-w-3xl p-6 flex flex-col gap-4">


        {/* Section infos personnelles */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Informations personnelles
          </h2>
          <div className="flex flex-col gap-2">
            <ChangeEmail user={user} />
            <ChangeUsername user={user} />
            <ChangePassword user={user} />
          </div>
        </div>

        {/* Section données */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Données</h2>
          <div className="flex gap-2">
            <ImportData user={user} />
            <ExportData user={user} />
          </div>
        </div>

        {/* Section suppression */}
        <div>
          <h2 className="text-lg font-semibold text-rose-700 mb-3">Danger</h2>
          <DeleteAccount user={user} />
        </div>
      </div>
    </div>
  );
}

import Subheader from "@/components/layout/Subheader";
import ChangeEmail from "./components/ChangeEmail";
import ChangeUsername from "./components/ChangeUsername";
import ChangePassword from "./components/PasswordReset";
import DeleteAccount from "./components/DeleteAccount";
import ImportData from "./ImportExport/ImportData";
import ExportData from "./ImportExport/ExportData";