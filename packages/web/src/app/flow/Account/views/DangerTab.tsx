import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiDeleteMe, isApiError } from '@/core/api/client';
import { freshenPasswordReauth } from '@/core/auth/opaque';
import { useSession } from '@/core/auth/use-session';
import { useNodeaStore, selectUser } from '@/core/store/nodea-store';
import Button from '@/ui/atoms/dirk/Button';

import Feedback from '../components/Feedback';
import Field from '../components/Field';

/** « Suppression du compte » tab — irreversible delete with two
 *  confirmations : the user must retype their email and supply
 *  their current password. The password reauth has to be fresh
 *  (`freshenPasswordReauth`) so the server sees a recent proof
 *  before honouring `apiDeleteMe`. A `window.confirm` adds a
 *  third gate to soften double-click accidents. */
export default function DangerTab() {
  const session = useSession();
  const navigate = useNavigate();
  const user = useNodeaStore(selectUser);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete =
    confirmEmail.trim().toLowerCase() === (user?.email ?? '').toLowerCase() &&
    currentPassword.length > 0;

  async function handleDelete(): Promise<void> {
    setError(null);
    if (!canDelete) {
      setError('Confirme ton e-mail et ton mot de passe pour continuer.');
      return;
    }
    if (
      !window.confirm(
        'Cette action est irréversible. Toutes tes entrées chiffrées seront supprimées. Continuer ?',
      )
    ) {
      return;
    }
    setSubmitting(true);
    try {
      await freshenPasswordReauth(currentPassword);
      await apiDeleteMe({});
      await session.logout().catch(() => undefined);
      navigate('/login', { replace: true });
    } catch (err) {
      if (isApiError(err) && err.status === 401) {
        setError('Mot de passe actuel incorrect.');
      } else {
        setError('Erreur lors de la suppression.');
        if (import.meta.env.DEV) console.warn('delete-account failed', err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid max-w-[1100px] grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
      <div className="max-w-90">
        <div className="mb-2 text-[12px] font-semibold tracking-[0.02em] text-danger">
          Suppression du compte
        </div>
        <Field
          label="Tape ton e-mail pour confirmer"
          value={confirmEmail}
          onChange={(e) => setConfirmEmail(e.target.value)}
          type="email"
        />
        <Field
          label="Mot de passe actuel"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          type="password"
        />
        <Button
          variant="danger"
          size="sm"
          onClick={handleDelete}
          disabled={submitting || !canDelete}
        >
          {submitting ? 'Suppression…' : 'Supprimer définitivement'}
        </Button>
        {error ? <Feedback tone="error">{error}</Feedback> : null}
      </div>
      <p className="text-[13px] leading-[1.55] text-muted">
        La suppression efface toutes tes entrées chiffrées, sessions et
        invitations. Aucune récupération possible — pense à exporter avant.
      </p>
    </div>
  );
}
