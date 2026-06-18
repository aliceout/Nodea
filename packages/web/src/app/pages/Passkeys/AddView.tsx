import { useState, type FormEvent } from 'react';

import { useSession } from '@/core/auth/use-session';
import { useI18n } from '@/i18n/I18nProvider.jsx';
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
  const { t } = useI18n();
  const [label, setLabel] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!label.trim()) {
      setError(t('auth.passkeys.errors.labelRequired'));
      return;
    }
    if (!password) {
      setError(t('auth.passkeys.errors.passwordRequired'));
      return;
    }
    setSubmitting(true);
    try {
      await session.enrollPasskey(password, label.trim());
      setPassword('');
      await onSuccess();
    } catch (err) {
      if (isPasswordError(err)) {
        setError(t('auth.passkeys.errors.wrongPassword'));
      } else if (isWebAuthnCancel(err)) {
        setError(t('auth.passkeys.errors.enrollCancelled'));
      } else {
        setError(t('auth.passkeys.errors.enrollFailed'));
        if (import.meta.env.DEV) console.warn('passkey enroll failed', err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <AuthPanelHeader
        eyebrow={t('auth.passkeys.add.eyebrow')}
        title={t('auth.passkeys.add.title')}
        subtitle={t('auth.passkeys.add.subtitle')}
      />

      <form onSubmit={onSubmit} noValidate>
        <Field
          label={t('auth.passkeys.add.labelField')}
          placeholder={t('auth.passkeys.add.labelPlaceholder')}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          required
        />
        <Field
          label={t('auth.passkeys.fields.currentPassword')}
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
          {submitting
            ? t('common.states.saving')
            : t('auth.passkeys.add.submit')}
        </Button>

        <div className="mt-4.5 text-center text-[12.5px] text-muted">
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer transition-colors hover:text-ink"
          >
            {t('auth.passkeys.cancelBack')}
          </button>
        </div>
      </form>
    </>
  );
}
