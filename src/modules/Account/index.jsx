// src/modules/Settings/SettingsIndex.jsx
import useAuth from "@/hooks/useAuth"; // si tu n'as pas d'alias "@", remplace par "../../hooks/useAuth"

import ChangeEmail from "./components/ChangeEmail";
import ChangeUsername from "./components/ChangeUsername";
import ChangePassword from "./components/PasswordReset";
import ImportData from "./components/ImportData";
import ExportData from "./components/ExportData";
import DeleteAccount from "./components/DeleteAccount";
import SettingsCard from "./components/SettingsCard";

export default function SettingsIndex() {
  const { user } = useAuth();

  // petite garde pour éviter un écran blanc si user pas encore dispo
  if (!user) {
    return <div className="py-6">Chargement du compte…</div>;
  }

  return (
    <div className="py-6 flex flex-col gap-4">
      <SettingsCard title="Changer l’email">
        <ChangeEmail user={user} />
      </SettingsCard>

      <SettingsCard title="Changer le nom d’utilisateur·ice">
        <ChangeUsername user={user} />
      </SettingsCard>

      <SettingsCard title="Changer le mot de passe">
        <ChangePassword user={user} />
      </SettingsCard>

      <SettingsCard title="Importer des données">
        <ImportData user={user} />
      </SettingsCard>

      <SettingsCard title="Exporter mes données">
        <ExportData user={user} />
      </SettingsCard>

      <SettingsCard title="Supprimer mon compte">
        <DeleteAccount user={user} />
      </SettingsCard>
    </div>
  );
}
