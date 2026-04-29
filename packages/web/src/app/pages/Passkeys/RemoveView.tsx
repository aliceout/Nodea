import { useState, type FormEvent } from 'react';
import type { PasskeyListItem } from '@nodea/shared';

import { useSession } from '@/core/auth/use-session';
import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import AuthPanelHeader from '@/ui/dirk/AuthPanelHeader';

import { isPasswordError } from './lib/error-helpers';

interface RemoveViewProps {
  passkey: PasskeyListItem;
  session: ReturnType<typeof useSession>;
  onCancel: () => void;
  onSuccess: () => void | Promise<void>;
}

/**
 * Confirm-and-remove panel. Collects a fresh password proof
 * before the destructive call ; the §6.1 mode-max downgrade
 * (when removing the last passkey of a passkey-required mode)
 * runs automatically server-side.
 *
 * No `onWebAuthnCancel` branch needed — there's no WebAuthn
 * prompt in the remove flow, only the password reauth.
 */
export default function RemoveView({
  passkey,
  session,
  onCancel,
  onSuccess,
}: RemoveViewProps) {
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
      await session.removePasskey(passkey.id, password);
      setPassword('');
      await onSuccess();
    } catch (err) {
      if (isPasswordError(err)) {
        setError('Mot de passe incorrect.');
      } else {
        setError('Impossible de retirer cette passkey.');
        if (import.meta.env.DEV) console.warn('passkey remove failed', err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <AuthPanelHeader
        eyebrow="Retrait"
        title="Retirer une passkey"
        subtitle={
          <>
            Tu vas retirer{' '}
            <strong className="font-semibold text-ink">
              {passkey.label ?? 'Sans nom'}
            </strong>
            . Cette passkey ne pourra plus être utilisée pour se connecter à ton
            compte.
          </>
        }
      />

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
          variant="danger-outline"
          size="lg"
          disabled={submitting}
          className="mt-2 w-full"
        >
          {submitting ? 'Retrait…' : 'Retirer'}
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
