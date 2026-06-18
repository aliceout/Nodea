import { useState, type FormEvent } from 'react';
import type { PasskeyListItem } from '@nodea/shared';

import { useSession } from '@/core/auth/use-session';
import { useI18n } from '@/i18n/I18nProvider.jsx';
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
  const { t } = useI18n();
  const [label, setLabel] = useState(passkey.label ?? '');
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
      await session.renamePasskey(passkey.id, password, label.trim());
      setPassword('');
      await onSuccess();
    } catch (err) {
      if (isPasswordError(err)) {
        setError(t('auth.passkeys.errors.wrongPassword'));
      } else {
        setError(t('auth.passkeys.errors.renameFailed'));
        if (import.meta.env.DEV) console.warn('passkey rename failed', err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <AuthPanelHeader
        eyebrow={t('auth.passkeys.rename.eyebrow')}
        title={t('auth.passkeys.rename.title')}
      />

      <form onSubmit={onSubmit} noValidate>
        <Field
          label={t('auth.passkeys.rename.labelField')}
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
            ? t('auth.passkeys.rename.renaming')
            : t('auth.passkeys.rename.submit')}
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
