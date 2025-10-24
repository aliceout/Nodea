import SettingsCard from "@/ui/atoms/specifics/SettingsCard";

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
    <SettingsCard className=" border-gray-200 hover:border-gray-300 ">
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
                <div className="flex flex-col items-center gap-1">
                  {typeof onResetPassword === "function" ? (
                    <button
                      className="text-sky-700 hover:text-sky-900 text-sm"
                      type="button"
                      onClick={() => onResetPassword(user)}
                    >
                      Réinitialiser le mot de passe
                    </button>
                  ) : null}
                  <button
                    className="cursor-pointer text-red-600 hover:text-red-700 px-3 py-1 text-sm"
                    title="Supprime uniquement le compte. Les entrées chiffrées restent orphelines."
                    type="button"
                    onClick={() => confirmDelete(user)}
                  >
                    Supprimer
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
