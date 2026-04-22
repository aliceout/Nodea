import { useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as zxcvbnCommon from '@zxcvbn-ts/language-common';
import { apiResetPassword, isApiError } from '@/core/api/client';
import { randomBytes } from '@/core/crypto/base64';
import { wrapMainKey } from '@/core/crypto/envelope';

zxcvbnOptions.setOptions({
  dictionary: zxcvbnCommon.dictionary,
  graphs: zxcvbnCommon.adjacencyGraphs,
});

/**
 * Consume a reset token.
 *
 * We generate a fresh main key client-side (32 random bytes), wrap it
 * under the user's new password (argon2id → AES-GCM), and ship the
 * envelope alongside the token + new password. The server purges all
 * old encrypted data in a single transaction before rotating the
 * credentials.
 *
 * A confirmation checkbox forces the user to acknowledge the data loss
 * before the destructive request goes out. The main key bytes are
 * zeroed in memory as soon as the wrap is done.
 */
export default function ResetPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const strength = useMemo(() => {
    if (!password) return null;
    const { score, feedback } = zxcvbn(password);
    return { score, warning: feedback.warning ?? null };
  }, [password]);

  const passwordsMatch = password.length > 0 && password === confirm;
  const canSubmit =
    token.length > 0 &&
    password.length >= 12 &&
    passwordsMatch &&
    acknowledged &&
    (strength?.score ?? 0) >= 3 &&
    !submitting;

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!canSubmit) return;

    setSubmitting(true);
    const rawMainKey = randomBytes(32);
    try {
      const { encryptionSalt, encryptedKey } = await wrapMainKey(password, rawMainKey);
      await apiResetPassword({
        token,
        newPassword: password,
        encryptionSalt,
        encryptedKey,
      });
      setDone(true);
    } catch (err) {
      if (isApiError(err) && err.status === 400) {
        if (err.error === 'invalid_token') {
          setError("Ce lien est invalide ou a expiré. Redemande un email de réinitialisation.");
        } else if (err.error === 'weak_password') {
          setError("Mot de passe trop faible : " + (err.reason ?? 'choisis-en un plus complexe.'));
        } else {
          setError('Requête refusée.');
        }
      } else if (isApiError(err) && err.status === 429) {
        setError('Trop de tentatives récentes. Réessaie plus tard.');
      } else {
        setError("Une erreur est survenue. Réessaie plus tard.");
        if (import.meta.env.DEV) console.warn('reset failed', err);
      }
    } finally {
      rawMainKey.fill(0);
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
        <div className="flex w-full max-w-md flex-col gap-4 rounded-lg bg-white p-8 shadow-sm dark:bg-slate-900 dark:shadow-none">
          <h1 className="text-center text-lg font-semibold">Lien invalide</h1>
          <p className="text-sm">
            Ce lien de réinitialisation est incomplet. Redemande un email depuis la page
            « mot de passe oublié ».
          </p>
          <p className="text-center">
            <Link to="/request-reset" className="text-sm underline">
              ← Redemander un lien
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
        <div className="flex w-full max-w-md flex-col gap-4 rounded-lg bg-white p-8 shadow-sm dark:bg-slate-900 dark:shadow-none">
          <h1 className="text-center text-lg font-semibold">Mot de passe réinitialisé</h1>
          <p className="text-sm">
            Tu peux te reconnecter avec ton nouveau mot de passe. Ton compte a été remis à
            zéro — les entrées précédentes ont été supprimées.
          </p>
          <Link
            to="/login"
            className="mx-auto inline-block rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900"
          >
            Se connecter
          </Link>
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
      <h1 className="text-xl font-semibold">Nouveau mot de passe</h1>

      <div className="rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
        <p className="font-semibold">⚠ Perte définitive de données</p>
        <p className="mt-1">
          Nodea chiffre tes entrées avec une clé dérivée de ton mot de passe. Comme cette
          clé a été perdue avec l'ancien mot de passe, <strong>toutes tes entrées existantes
          seront supprimées</strong> lors de la validation.
        </p>
      </div>

      <label className="block">
        <span className="text-sm">Nouveau mot de passe (≥ 12 caractères)</span>
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={12}
          required
          className="mt-1 block w-full rounded border border-slate-300 p-2 text-sm"
        />
        {strength ? (
          <p className={`mt-1 text-xs ${strength.score >= 3 ? 'text-emerald-700' : 'text-amber-700'}`}>
            Force : {strength.score} / 4
            {strength.warning ? ` — ${strength.warning}` : ''}
          </p>
        ) : null}
      </label>

      <label className="block">
        <span className="text-sm">Confirmation</span>
        <input
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          className="mt-1 block w-full rounded border border-slate-300 p-2 text-sm"
        />
        {confirm && !passwordsMatch ? (
          <p className="mt-1 text-xs text-red-600">Les deux mots de passe ne correspondent pas.</p>
        ) : null}
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-1"
        />
        <span>
          Je comprends que toutes mes données existantes seront supprimées lors de cette
          réinitialisation.
        </span>
      </label>

      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}

      <div className="flex items-center justify-between gap-3">
        <Link to="/login" className="text-sm underline">
          ← Annuler
        </Link>
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitting ? 'Réinitialisation…' : 'Réinitialiser et effacer mes données'}
        </button>
      </div>
      </form>
    </div>
  );
}
