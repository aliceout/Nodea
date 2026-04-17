import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SurfaceCard from '@/ui/atoms/specifics/SurfaceCard.jsx';
import Button from '@/ui/atoms/base/Button';
import { apiDeleteMe, isApiError } from '@/core/api/client';
import { useSession } from '@/core/auth/use-session';

/**
 * Self-delete the authenticated user.
 *
 * Much simpler than the legacy JSX version: the new back's
 * `DELETE /auth/me` does the whole cleanup in one shot via FK
 * `ON DELETE CASCADE` (sessions + modules_config + every *_entries).
 * No more iterating MODULES and computing guards record-by-record.
 *
 * The `window.mainKey` back-door fallback is gone (closed in an
 * earlier commit). The current password is the only credential
 * needed.
 */
export default function DeleteAccountSection() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const session = useSession();

  async function handleDelete(): Promise<void> {
    setError(null);
    const confirmed = window.confirm(
      'Attention : cette action est irréversible.\n\n' +
        'Supprimer définitivement ce compte et toutes les données associées ?',
    );
    if (!confirmed) return;
    if (!currentPassword) {
      setError('Renseigne ton mot de passe actuel pour confirmer.');
      return;
    }

    setDeleting(true);
    try {
      await apiDeleteMe({ currentPassword });
      // Cookie is cleared server-side; wipe the local state and push
      // back to /login.
      await session.logout().catch(() => undefined);
      navigate('/login', { replace: true });
    } catch (err) {
      if (isApiError(err) && err.status === 401) {
        setError('Mot de passe actuel incorrect.');
      } else {
        setError('Erreur lors de la suppression du compte.');
        if (import.meta.env.DEV) console.warn('delete-account failed', err);
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SurfaceCard className="border-rose-300 bg-rose-50">
      <div className="mb-4 w-full">
        <div className="mb-1 text-base font-semibold text-rose-700">Supprimer mon compte</div>
        <div className="text-sm text-rose-700">
          La suppression est <strong>définitive</strong>. Toutes les données associées à ce compte
          seront perdues (sessions, configuration des modules, chaque entrée chiffrée).
        </div>
      </div>

      <div className="flex w-full flex-col gap-4">
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Mot de passe actuel"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="block w-full border-0 border-b-2 border-rose-300 bg-transparent text-sm placeholder:text-sm transition-colors focus:border-rose-500 focus:outline-none focus:ring-0"
        />
        <Button type="button" onClick={handleDelete} variant="danger" disabled={deleting}>
          {deleting ? 'Suppression en cours…' : 'Supprimer mon compte'}
        </Button>
        {error ? (
          <div
            role="alert"
            aria-live="polite"
            className="w-full rounded-md border border-rose-200 bg-rose-50 p-3 text-center text-sm text-rose-700"
          >
            {error}
          </div>
        ) : null}
      </div>
    </SurfaceCard>
  );
}
