import useAuth from "../../hooks/useAuth";

export default function SettingsIndex() {
  const { user } = useAuth();
  
  return (
    <div className="py-6 flex flex-col gap-4 ">
      <SettingsCard title="Changer l’email">
        <ChangeEmail user={user} />
      </SettingsCard>

      <SettingsCard title="Changer le nom d'utilisateur.ice">
        <ChageUsername />
      </SettingsCard>

      <SettingsCard title="Changer le mot de passe">
        <PasswordReset />
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

import ChangeEmail from "./Account/ChangeEmail";
import ChageUsername from "./Account/ChangeUsername";
import PasswordReset from "./Account/PasswordReset";
import ImportData from "./Account/ImportData";
import ExportData from "./Account/ExportData";
import DeleteAccount from "./Account/DeleteAccount";
import SettingsCard from "./components/SettingsCard";