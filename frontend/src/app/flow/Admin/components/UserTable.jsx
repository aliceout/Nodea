import SettingsCard from "@/ui/atoms/specifics/SettingsCard";
import { ArrowPathIcon, TrashIcon } from "@heroicons/react/24/outline";

export default function UserTable({ users, onDelete, onResetPassword }) {
  const confirmDelete = (user) => {
    const ok = window.confirm(
      `Supprimer le compte “${user.username}” ?\n\n` +
        `⚠️ Seul le compte sera supprimé.\n` +
        `Les données chiffrées liées resteront orphelines et inaccessibles.`
    );
    if (ok) onDelete(user.id);
  };

  return (
    <SettingsCard className="border-gray-200 hover:border-gray-300 bg-white">
      <table className="w-full table-auto">
        <thead>
          <tr>
            <th className="px-3 py-3 text-left">Username</th>
            <th className="px-3 py-3 text-left hidden md:table-cell">Rôle</th>
            <th className="px-3 py-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, i) => (
            <tr
              key={user.id}
              className={`${
                i % 2 === 1 ? "bg-gray-50" : "bg-white"
              } hover:bg-sky-50`}
            >
              <td className="px-3 py-3 text-sm font-medium">{user.username}</td>
              <td className="px-3 py-3 text-sm hidden md:table-cell">
                {user.role}
              </td>
              <td className="px-3 py-3 text-center">
                <div className="flex items-center justify-center gap-2">
                  {typeof onResetPassword === "function" ? (
                    <button
                      className="text-sky-700 hover:text-sky-900 inline-flex items-center justify-center rounded-full p-1.5 cursor-pointer"
                      type="button"
                      onClick={() => onResetPassword(user)}
                      aria-label="Réinitialiser le mot de passe"
                      title="Réinitialiser le mot de passe"
                    >
                      <ArrowPathIcon className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : null}
                  <button
                    className="text-red-600 hover:text-red-700 inline-flex items-center justify-center rounded-full p-1.5 cursor-pointer"
                    type="button"
                    onClick={() => confirmDelete(user)}
                    aria-label="Supprimer l'utilisateur"
                    title="Supprimer l'utilisateur"
                  >
                    <TrashIcon className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </SettingsCard>
  );
}
