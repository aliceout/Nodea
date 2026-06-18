import { useState, type FormEvent } from 'react';

import { isApiError } from '@/core/api/client';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';

interface PasswordPanelProps {
  title: string;
  body: string;
  cta: string;
  destructive?: boolean;
  onSubmit: (password: string) => Promise<void>;
  onCancel: () => void;
}

/**
 * Reusable « tape ton mot de passe » panel — used by the regen
 * flow (« Régénérer les codes de secours ») and the disable
 * view (« Désactiver TOTP »). The orchestrator picks the
 * `title` / `body` / `cta` strings and swaps the button variant
 * via `destructive` for the disable case.
 *
 * Maps a 401 to « Mot de passe incorrect » and a generic
 * « Erreur. Réessaie. » for everything else, with the dev
 * console getting the raw error.
 */
export default function PasswordPanel({
  title,
  body,
  cta,
  destructive = false,
  onSubmit,
  onCancel,
}: PasswordPanelProps) {
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!password) {
      setError(t('auth.totp.errors.passwordRequired'));
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(password);
      setPassword('');
    } catch (err) {
      if (isApiError(err) && err.status === 401) {
        setError(t('auth.totp.errors.wrongPassword'));
      } else if (
        typeof err === 'object' &&
        err !== null &&
        (err as { status?: number }).status === 401
      ) {
        setError(t('auth.totp.errors.wrongPassword'));
      } else {
        setError(t('auth.totp.errors.generic'));
        if (import.meta.env.DEV) console.warn('totp password panel failed', err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <AuthPanelHeader eyebrow={t('auth.totp.list.eyebrow')} title={title} subtitle={body} />

      <form onSubmit={handle} noValidate>
        <Field
          label={t('auth.totp.passwordLabel')}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error ? <InlineAlert className="mb-3">{error}</InlineAlert> : null}

        <Button
          type="submit"
          variant={destructive ? 'danger' : 'primary'}
          size="lg"
          disabled={submitting}
          className="mt-2 w-full"
        >
          {submitting ? '…' : cta}
        </Button>

        <div className="mt-4.5 text-center text-[12.5px] text-muted">
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer transition-colors hover:text-ink"
          >
            {t('auth.totp.cancel')}
          </button>
        </div>
      </form>
    </>
  );
}
