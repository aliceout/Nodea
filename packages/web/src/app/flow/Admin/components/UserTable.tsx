import { TrashIcon } from '@heroicons/react/24/outline';
import TableShell from '@/ui/atoms/data/TableShell.jsx';
import type { AdminUserRow } from '@/core/api/client';

export interface UserTableProps {
  users: AdminUserRow[];
  currentUserId: string;
  onDelete(id: string): void;
}

/**
 * Minimalist user list for the Admin page — email + role, with a
 * delete button per row. The admin cannot delete themselves (the API
 * refuses it too; the UI hides the button to avoid the 400 roundtrip).
 *
 * Reset-password was a PB-specific email flow; the new back has no
 * SMTP yet, so the column is gone. Re-introduce when email lands.
 */
export default function UserTable({ users, currentUserId, onDelete }: UserTableProps) {
  const confirmDelete = (user: AdminUserRow): void => {
    const label = user.username ?? user.email;
    const ok = window.confirm(
      `Supprimer le compte « ${label} » ?\n\n` +
        'Le compte, ses sessions et toutes ses données chiffrées seront supprimés (cascade FK).',
    );
    if (ok) onDelete(user.id);
  };

  return (
    <TableShell tone="base" border="default" padding="none">
      <table className="w-full table-auto">
        <thead className="bg-[var(--surface-muted)] text-[var(--text-secondary)]">
          <tr>
            <th className="border-b border-[var(--border-default)] px-3 py-3 text-left">
              Utilisateur·ice
            </th>
            <th className="hidden border-b border-[var(--border-default)] px-3 py-3 text-left md:table-cell">
              E-mail
            </th>
            <th className="hidden border-b border-[var(--border-default)] px-3 py-3 text-left md:table-cell">
              Rôle
            </th>
            <th className="border-b border-[var(--border-default)] px-3 py-3 text-center">Action</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr
              key={user.id}
              className="transition-colors even:bg-[var(--surface-subtle)] hover:bg-[var(--surface-muted)]"
            >
              <td className="border-b border-[var(--border-default)] px-3 py-3 text-sm font-medium text-[var(--text-primary)]">
                {user.username ?? <span className="italic opacity-60">—</span>}
              </td>
              <td className="hidden border-b border-[var(--border-default)] px-3 py-3 text-sm text-[var(--text-secondary)] md:table-cell">
                {user.email}
              </td>
              <td className="hidden border-b border-[var(--border-default)] px-3 py-3 text-sm text-[var(--text-secondary)] md:table-cell">
                {user.role}
              </td>
              <td className="border-b border-[var(--border-default)] px-3 py-3">
                <div className="flex items-center justify-center gap-2">
                  {user.id !== currentUserId ? (
                    <button
                      type="button"
                      onClick={() => confirmDelete(user)}
                      aria-label="Supprimer l'utilisateur"
                      title="Supprimer l'utilisateur"
                      className="inline-flex cursor-pointer items-center justify-center rounded-full p-1.5 text-[var(--accent-danger)] transition-colors hover:text-[var(--accent-danger)]/80"
                    >
                      <TrashIcon className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : (
                    <span className="text-xs opacity-60">(toi)</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  );
}
