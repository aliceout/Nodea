import { useState, type FormEvent } from 'react';
import type { PasskeyListItem } from '@nodea/shared';

import { useSession } from '@/core/auth/use-session';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';

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
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!password) {
      setError(t('auth.passkeys.errors.passwordRequired'));
      return;
    }
    setSubmitting(true);
    try {
      await session.removePasskey(passkey.id, password);
      setPassword('');
      await onSuccess();
    } catch (err) {
      if (isPasswordError(err)) {
        setError(t('auth.passkeys.errors.wrongPassword'));
      } else {
        setError(t('auth.passkeys.errors.removeFailed'));
        if (import.meta.env.DEV) console.warn('passkey remove failed', err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <AuthPanelHeader
        eyebrow={t('auth.passkeys.remove.eyebrow')}
        title={t('auth.passkeys.remove.title')}
        subtitle={
          <>
            {t('auth.passkeys.remove.subtitleBefore')}{' '}
            <strong className="font-semibold text-ink">
              {passkey.label ?? t('auth.passkeys.row.unnamed')}
            </strong>
            {t('auth.passkeys.remove.subtitleAfter')}
          </>
        }
      />

      <form onSubmit={onSubmit} noValidate>
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
          variant="danger-outline"
          size="lg"
          disabled={submitting}
          className="mt-2 w-full"
        >
          {submitting
            ? t('auth.passkeys.remove.removing')
            : t('auth.passkeys.remove.submit')}
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
