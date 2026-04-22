import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiRequestPasswordReset, isApiError } from '@/core/api/client';

/**
 * Start a password-reset flow.
 *
 * The server always returns 200 to avoid enumeration (see `request-reset`
 * handler), so the success message is identical whether or not the
 * email is in the database. The response itself is our only confirmation
 * the request went through.
 */
export default function RequestResetPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      await apiRequestPasswordReset({ email: email.trim().toLowerCase() });
      setSent(true);
    } catch (err) {
      if (isApiError(err) && err.status === 429) {
        setError('Trop de demandes récentes. Réessaie dans une heure.');
      } else {
        setError("Une erreur est survenue. Réessaie plus tard.");
        if (import.meta.env.DEV) console.warn('request-reset failed', err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
        <div className="flex w-full max-w-md flex-col gap-4 rounded-lg bg-white p-8 shadow-sm dark:bg-slate-900 dark:shadow-none">
          <h1 className="text-center text-lg font-semibold">Vérifie ta boîte mail</h1>
          <p className="text-sm">
            Si un compte Nodea est associé à <strong>{email}</strong>, un email avec un lien
            de réinitialisation vient d'être envoyé. Le lien est valable 1 heure.
          </p>
          <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">⚠ Attention — perte de données</p>
            <p className="mt-1">
              Tes entrées sont chiffrées avec une clé dérivée de ton mot de passe. Réinitialiser
              le mot de passe implique la suppression définitive de toutes tes données
              existantes. Le lien dans l'email te redemandera de confirmer avant d'agir.
            </p>
          </div>
          <p className="text-center">
            <Link to="/login" className="text-sm underline">
              ← Retour à la connexion
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <form
        onSubmit={onSubmit}
        noValidate
        className="flex w-full max-w-md flex-col gap-4 rounded-lg bg-white p-8 shadow-sm dark:bg-slate-900 dark:shadow-none"
      >
      <h1 className="text-xl font-semibold">Mot de passe oublié</h1>
      <p className="text-sm opacity-80">
        Indique ton email : on t'enverra un lien pour définir un nouveau mot de passe.
      </p>

      <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
        <p className="font-semibold">⚠ Avant d'aller plus loin</p>
        <p className="mt-1">
          Nodea chiffre tes entrées avec une clé dérivée de ton mot de passe. Si tu l'oublies,
          nous ne pouvons pas le récupérer — réinitialiser le mot de passe effacera toutes tes
          données existantes.
        </p>
      </div>

      <label className="block">
        <span className="text-sm">E-mail</span>
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mt-1 block w-full rounded border border-slate-300 p-2 text-sm"
        />
      </label>

      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}

      <div className="flex items-center justify-between gap-3">
        <Link to="/login" className="text-sm underline">
          ← Retour à la connexion
        </Link>
        <button
          type="submit"
          disabled={submitting || !email.trim()}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
        >
          {submitting ? 'Envoi…' : "M'envoyer le lien"}
        </button>
      </div>
      </form>
    </div>
  );
}
