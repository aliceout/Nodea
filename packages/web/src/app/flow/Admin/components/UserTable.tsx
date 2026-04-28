import { TrashIcon } from '@heroicons/react/24/outline';
import type { AdminUserRow } from '@/core/api/client';
import Button from '@/ui/atoms/dirk/Button';
import EmptyHint from '@/ui/dirk/EmptyHint';

export interface UserTableProps {
  users: AdminUserRow[];
  currentUserId: string;
  onDelete(id: string): void;
}

/**
 * User list — Direction K · Sauge.
 *
 * Borderless flex rows separated by `border-hair`, mirroring the
 * Mood entries list and the K Modules list. Email + role read as
 * muted metadata; the trash button only renders for rows that are
 * not the current admin (the API also refuses self-deletion).
 */
export default function UserTable({ users, currentUserId, onDelete }: UserTableProps) {
  function confirmDelete(user: AdminUserRow): void {
    const label = user.username ?? user.email;
    const ok = window.confirm(
      `Supprimer le compte « ${label} » ?\n\n` +
        'Le compte, ses sessions et toutes ses données chiffrées seront supprimés (cascade FK).',
    );
    if (ok) onDelete(user.id);
  }

  if (users.length === 0) {
    return <EmptyHint>Aucun compte enregistré.</EmptyHint>;
  }

  return (
    <ul className="flex flex-col">
      {users.map((user) => {
        const isSelf = user.id === currentUserId;
        return (
          <li
            key={user.id}
            className="flex items-center gap-4 border-b border-hair py-3 last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium text-ink">
                {user.username ?? (
                  <span className="italic text-muted">— sans nom —</span>
                )}
              </p>
              <p className="mt-0.5 truncate text-[12px] text-muted">{user.email}</p>
            </div>

            <span className="hidden text-[11px] uppercase tracking-[0.04em] text-muted sm:inline">
              {user.role}
            </span>

            {isSelf ? (
              <span className="text-[11px] italic text-muted">(toi)</span>
            ) : (
              <Button
                variant="danger-ghost"
                size="sm"
                iconOnly
                onClick={() => confirmDelete(user)}
                aria-label="Supprimer l’utilisateur·ice"
                title="Supprimer l’utilisateur·ice"
              >
                <TrashIcon className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
