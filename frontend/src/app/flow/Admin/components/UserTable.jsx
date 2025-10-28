import SurfaceCard from "@/ui/atoms/specifics/SurfaceCard.jsx";
import { ArrowPathIcon, TrashIcon } from "@heroicons/react/24/outline";

export default function UserTable({ users, onDelete, onResetPassword }) {
  const confirmDelete = (user) => {
    const ok = window.confirm(
      `Supprimer le compte « ${user.username} » ?\n\n` +
        "Seul le compte sera supprimé.\n" +
        "Les données chiffrées liées resteront orphelines et inaccessibles."
    );
    if (ok) onDelete(user.id);
  };

  return (
    <SurfaceCard className="border-gray-200 bg-white hover:border-gray-300 dark:border-slate-700 dark:bg-slate-900">
      <table className="w-full table-auto">
        <thead>
          <tr>
            <th className="px-3 py-3 text-left text-slate-600 dark:text-slate-300">
              Username
            </th>
            <th className="hidden px-3 py-3 text-left text-slate-600 dark:text-slate-300 md:table-cell">
              Rôle
            </th>
            <th className="px-3 py-3 text-slate-600 dark:text-slate-300">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, index) => (
            <tr
              key={user.id}
              className={`${
                index % 2 === 1
                  ? "bg-gray-50 dark:bg-slate-800/60"
                  : "bg-white dark:bg-slate-900"
              } hover:bg-sky-50 dark:hover:bg-slate-700/80`}
            >
              <td className="px-3 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">
                {user.username}
              </td>
              <td className="hidden px-3 py-3 text-sm text-slate-600 dark:text-slate-300 md:table-cell">
                {user.role}
              </td>
              <td className="px-3 py-3 text-center">
                <div className="flex items-center justify-center gap-2">
                  {typeof onResetPassword === "function" ? (
                    <button
                      className="inline-flex cursor-pointer items-center justify-center rounded-full p-1.5 text-sky-700 transition-colors hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-200"
                      type="button"
                      onClick={() => onResetPassword(user)}
                      aria-label="Réinitialiser le mot de passe"
                      title="Réinitialiser le mot de passe"
                    >
                      <ArrowPathIcon className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : null}
                  <button
                    className="inline-flex cursor-pointer items-center justify-center rounded-full p-1.5 text-red-600 transition-colors hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
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
    </SurfaceCard>
  );
}
