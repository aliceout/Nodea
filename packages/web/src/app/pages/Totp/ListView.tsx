import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { isApiError } from '@/core/api/client';
import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';

interface ListViewProps {
  totpEnabled: boolean;
  backupCodesRemaining: number;
  /** Called with the typed password when the user clicks
   *  « Activer TOTP » on the disabled-state form. The parent
   *  handles `startTotpEnrollment` + the stage transition ;
   *  we surface errors inline. Throws on bad password (401)
   *  or other failures. */
  onActivate: (password: string) => Promise<void>;
  onRegen: () => void;
  onDisable: () => void;
}

/**
 * Landing screen of `/totp`. Branches on `totpEnabled` :
 *
 *   - `true` — show backup-codes-remaining count + two
 *     actions (« Régénérer » / « Désactiver »).
 *   - `false` — show the activation form (explanation +
 *     password input + CTA on a single screen so the user
 *     doesn't traverse a bare « tape ton mot de passe »
 *     intermediate panel between the marketing intro and the
 *     QR code).
 *
 * `← Retour` always sits at the bottom regardless of state.
 */
export default function ListView({
  totpEnabled,
  backupCodesRemaining,
  onActivate,
  onRegen,
  onDisable,
}: ListViewProps) {
  return (
    <>
      <AuthPanelHeader
        eyebrow="Sécurité"
        title="Authentification à deux facteurs"
      />

      {totpEnabled ? (
        <EnabledView
          backupCodesRemaining={backupCodesRemaining}
          onRegen={onRegen}
          onDisable={onDisable}
        />
      ) : (
        <DisabledActivateView onActivate={onActivate} />
      )}

      <div className="mt-4.5 text-center text-[12.5px] text-muted">
        <Link to="/flow" className="cursor-pointer transition-colors hover:text-ink">
          ← Retour
        </Link>
      </div>
    </>
  );
}

interface EnabledViewProps {
  backupCodesRemaining: number;
  onRegen: () => void;
  onDisable: () => void;
}

function EnabledView({ backupCodesRemaining, onRegen, onDisable }: EnabledViewProps) {
  return (
    <>
      <p className="mb-4 text-[13.5px] leading-[1.5] text-ink-soft">
        TOTP activé. Tu auras besoin d’un code à 6 chiffres généré par ton
        appli d’authentification à chaque connexion.
      </p>

      <div className="mb-5 rounded-md border border-hair bg-bg-2 px-3 py-2.5 text-[12.5px]">
        <p className="text-ink-soft">
          <strong className="font-semibold text-ink">
            {backupCodesRemaining}
          </strong>{' '}
          code{backupCodesRemaining > 1 ? 's' : ''} de secours restant
          {backupCodesRemaining > 1 ? 's' : ''}.
          {backupCodesRemaining === 0 ? (
            <span className="block mt-1 text-danger">
              Plus aucun code disponible. Régénère-les maintenant.
            </span>
          ) : null}
        </p>
      </div>

      <Button
        type="button"
        variant="neutral"
        size="lg"
        onClick={onRegen}
        className="mb-2 w-full"
      >
        Régénérer les codes de secours
      </Button>
      <Button
        type="button"
        variant="danger-outline"
        size="lg"
        onClick={onDisable}
        className="w-full"
      >
        Désactiver TOTP
      </Button>
    </>
  );
}

interface DisabledActivateViewProps {
  onActivate: (password: string) => Promise<void>;
}

function DisabledActivateView({ onActivate }: DisabledActivateViewProps) {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!password) {
      setError('Mot de passe requis.');
      return;
    }
    setSubmitting(true);
    try {
      await onActivate(password);
      setPassword('');
    } catch (err) {
      if (isApiError(err) && err.status === 401) {
        setError('Mot de passe incorrect.');
      } else if (
        typeof err === 'object' &&
        err !== null &&
        (err as { status?: number }).status === 401
      ) {
        setError('Mot de passe incorrect.');
      } else {
        setError('Erreur. Réessaie.');
        if (import.meta.env.DEV) console.warn('totp activate failed', err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <p className="mb-6 text-[13.5px] leading-[1.5] text-ink-soft">
        Aucun TOTP configuré. Tape ton mot de passe pour générer la clé et
        commencer l’activation.
      </p>

      <form onSubmit={onSubmit} noValidate>
        <Field
          label="Mot de passe actuel"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error ? <InlineAlert className="mb-3">{error}</InlineAlert> : null}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={submitting || !password}
          className="mt-2 w-full"
        >
          {submitting ? '…' : 'Activer TOTP'}
        </Button>
      </form>
    </>
  );
}
