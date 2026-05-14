import { useState, type FormEvent } from 'react';
import type { PasskeyListItem } from '@nodea/shared';

import { useSession } from '@/core/auth/use-session';
import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';

import { isPasswordError } from './lib/error-helpers';

interface RenameViewProps {
  passkey: PasskeyListItem;
  session: ReturnType<typeof useSession>;
  onCancel: () => void;
  onSuccess: () => void | Promise<void>;
}

/**
 * Rename a passkey — updates the user-facing label only ; the
 * underlying credential ID stays put. Same fresh-password
 * reauth as the rest of the page (the label rides inside the
 * encrypted envelope, so the rotation needs the export key
 * just like an enroll). */
export default function RenameView({
  passkey,
  session,
  onCancel,
  onSuccess,
}: RenameViewProps) {
  const [label, setLabel] = useState(passkey.label ?? '');
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
      await session.renamePasskey(passkey.id, password, label.trim());
      setPassword('');
      await onSuccess();
    } catch (err) {
      if (isPasswordError(err)) {
        setError('Mot de passe incorrect.');
      } else {
        setError('Impossible de renommer cette passkey.');
        if (import.meta.env.DEV) console.warn('passkey rename failed', err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <AuthPanelHeader eyebrow="Renommer" title="Renommer une passkey" />

      <form onSubmit={onSubmit} noValidate>
        <Field
          label="Nouveau nom"
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
          {submitting ? 'Renommage…' : 'Renommer'}
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
