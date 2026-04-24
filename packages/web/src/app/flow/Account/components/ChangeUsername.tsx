import { useState, type FormEvent } from 'react';
import AccountSettingsCard from '@/ui/atoms/specifics/AccountSettingsCard';
import Button from '@/ui/atoms/base/Button';
import StatusBanner from '@/ui/atoms/feedback/StatusBanner';
import { apiChangeUsername, apiMe, isApiError } from '@/core/api/client';
import { useNodeaStore, selectUser } from '@/core/store/nodea-store';

export default function ChangeUsernameSection() {
  const user = useNodeaStore(selectUser);
  const setAuth = useNodeaStore((s) => s.setAuth);
  const [username, setUsername] = useState(user?.username ?? '');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmed = username.trim();
    const next: string | null = trimmed.length === 0 ? null : trimmed;

    setSubmitting(true);
    try {
      await apiChangeUsername({ username: next });
      const me = await apiMe();
      if (me) setAuth(me);
      setSuccess(next === null ? "Nom d'utilisateur·ice retiré." : "Nom d'utilisateur·ice mis à jour.");
    } catch (err) {
      if (isApiError(err) && err.status === 409) {
        setError("Ce nom d'utilisateur·ice est déjà pris.");
      } else if (isApiError(err) && err.status === 400) {
        setError('Nom invalide (2 à 32 caractères : lettres, chiffres, . _ -).');
      } else {
        setError('Erreur lors de la modification.');
        if (import.meta.env.DEV) console.warn('change-username failed', err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AccountSettingsCard
      title="Changer le nom d'utilisateur·ice"
      description="Ton identifiant public dans l'appli. Laisser vide pour le retirer."
    >
      <form onSubmit={onSubmit} className="flex flex-col items-stretch gap-6">
        <div className="flex w-full flex-col items-stretch justify-between gap-8 md:flex-row">
          <Button type="submit" variant="primarySoft" disabled={submitting}>
            {submitting ? 'Modification…' : 'Modifier'}
          </Button>
          <input
            type="text"
            placeholder="Nouveau nom d'utilisateur·ice"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="block w-full border-0 border-b-2 border-slate-300 bg-transparent text-sm placeholder:text-sm transition-colors focus:border-slate-500 focus:outline-none focus:ring-0"
          />
        </div>
        {success ? <StatusBanner tone="success">{success}</StatusBanner> : null}
        {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}
      </form>
    </AccountSettingsCard>
  );
}
