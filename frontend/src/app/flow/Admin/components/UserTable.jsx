import TableShell from "@/ui/atoms/data/TableShell.jsx";
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
    <TableShell tone="base" border="default" padding="none">
      <table className="w-full table-auto">
        <thead>
          <tr>
            <th className="px-3 py-3 text-left text-[var(--text-muted)]">Username</th>
            <th className="hidden px-3 py-3 text-left text-[var(--text-muted)] md:table-cell">Rôle</th>
            <th className="px-3 py-3 text-center text-[var(--text-muted)]">Action</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td className="px-3 py-3 text-sm font-medium text-[var(--text-primary)]">
                {user.username}
              </td>
              <td className="hidden px-3 py-3 text-sm text-[var(--text-secondary)] md:table-cell">
                {user.role}
              </td>
              <td className="px-3 py-3">
                <div className="flex items-center justify-center gap-2">
                  {typeof onResetPassword === "function" ? (
                    <button
                      className="inline-flex cursor-pointer items-center justify-center rounded-full p-1.5 text-[var(--accent-info)] transition-colors hover:text-[var(--accent-info)]/80"
                      type="button"
                      onClick={() => onResetPassword(user)}
                      aria-label="Réinitialiser le mot de passe"
                      title="Réinitialiser le mot de passe"
                    >
                      <ArrowPathIcon className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : null}
                  <button
                    className="inline-flex cursor-pointer items-center justify-center rounded-full p-1.5 text-[var(--accent-danger)] transition-colors hover:text-[var(--accent-danger)]/80"
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
    </TableShell>
  );
}
