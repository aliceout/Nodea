import { useState, type FormEvent } from 'react';

import { useSession } from '@/core/auth/use-session';
import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';

import { isPasswordError, isWebAuthnCancel } from './lib/error-helpers';

interface AddViewProps {
  session: ReturnType<typeof useSession>;
  onCancel: () => void;
  onSuccess: () => void | Promise<void>;
}

/**
 * Add a new passkey — collects a label + the current password
 * (re-auth fresh per the matrice §6), then drives the WebAuthn
 * registration ceremony via `useSession.enrollPasskey`.
 *
 * Two failure paths get distinct messages : a 401 means the
 * password reauth failed (`isPasswordError`), a NotAllowedError
 * / AbortError means the user dismissed the WebAuthn prompt
 * (`isWebAuthnCancel`). Anything else surfaces a generic
 * « impossible d'enregistrer ».
 */
export default function AddView({ session, onCancel, onSuccess }: AddViewProps) {
  const [label, setLabel] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!label.trim()) {
      setError('Donne un nom à cette passkey.');
      return;
    }
    if (!password) {
      setError('Mot de passe requis.');
      return;
    }
    setSubmitting(true);
    try {
      await session.enrollPasskey(password, label.trim());
      setPassword('');
      await onSuccess();
    } catch (err) {
      if (isPasswordError(err)) {
        setError('Mot de passe incorrect.');
      } else if (isWebAuthnCancel(err)) {
        setError('Enregistrement annulé.');
      } else {
        setError('Impossible d’enregistrer cette passkey.');
        if (import.meta.env.DEV) console.warn('passkey enroll failed', err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <AuthPanelHeader
        eyebrow="Ajout"
        title="Ajouter une passkey"
        subtitle={
          <>
            Donne-lui un nom, retape ton mot de passe, puis confirme avec ton
            empreinte / Face ID / PIN.
          </>
        }
      />

      <form onSubmit={onSubmit} noValidate>
        <Field
          label="Nom"
          placeholder="iPhone perso, Yubikey bureau…"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          required
        />
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
          disabled={submitting}
          className="mt-2 w-full"
        >
          {submitting ? 'Enregistrement…' : 'Confirmer avec ma passkey'}
        </Button>

        <div className="mt-4.5 text-center text-[12.5px] text-muted">
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer transition-colors hover:text-ink"
          >
            ← Annuler
          </button>
        </div>
      </form>
    </>
  );
}
