import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import Textarea from '@/ui/atoms/dirk/Textarea';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';

interface VerifyPanelProps {
  email: string;
  setEmail: (next: string) => void;
  mnemonic: string;
  setMnemonic: (next: string) => void;
  wordCount: number;
  emailLooksValid: boolean;
  error: string | null;
  submitting: boolean;
  canSubmit: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

/**
 * Step 1 of the split recovery flow (issue #48) : confirm the
 * `(email, mnemonic)` pair before the user commits a new password.
 * The user gets immediate feedback if the code is wrong, instead of
 * wasting a second pass on a password field that ends up flushed.
 *
 * Mirrors the structure of the previous monolithic FormPanel for
 * email + mnemonic — same word-count hint, same anti-enum surface
 * (« code invalide » is the only failure message regardless of
 * which leg actually missed).
 */
export default function VerifyPanel(props: VerifyPanelProps) {
  const {
    email,
    setEmail,
    mnemonic,
    setMnemonic,
    wordCount,
    emailLooksValid,
    error,
    submitting,
    canSubmit,
    onSubmit,
  } = props;
  const { t } = useI18n();

  return (
    <>
      <AuthPanelHeader
        eyebrow={t('auth.recover.verify.eyebrow', { defaultValue: 'Récupération' })}
        title={t('auth.recover.verify.title', { defaultValue: 'Vérifie ton code' })}
        subtitle={
          <>
            {t('auth.recover.verify.subtitle', {
              defaultValue:
                'On confirme d’abord que ton code est valide. Tu choisiras ton nouveau mot de passe à l’étape suivante.',
            })}
          </>
        }
      />

      <form onSubmit={onSubmit} noValidate>
        <Field
          label={t('auth.recover.form.emailLabel')}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          error={
            email && !emailLooksValid
              ? t('auth.recover.form.emailInvalid')
              : undefined
          }
        />

        <div className="mb-3.5">
          <label
            htmlFor="recover-mnemonic"
            className="mb-1.25 block text-[12px] font-medium text-muted"
          >
            {t('auth.recover.form.mnemonicLabel')}
          </label>
          <Textarea
            id="recover-mnemonic"
            value={mnemonic}
            onChange={(e) => setMnemonic(e.target.value)}
            placeholder={t('auth.recover.form.mnemonicPlaceholder')}
            rows={3}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            className="font-mono"
          />
          <p className="mt-1 text-[11px] text-muted">
            {t('auth.recover.form.wordCount', { values: { count: wordCount } })}
            {wordCount > 0 && wordCount !== 12
              ? t('auth.recover.form.wordCountNeed12')
              : null}
          </p>
        </div>

        {error ? <InlineAlert className="mb-3">{error}</InlineAlert> : null}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={!canSubmit}
          className="mt-2 w-full"
        >
          {submitting
            ? t('auth.recover.verify.submitting', { defaultValue: 'Vérification…' })
            : t('auth.recover.verify.submit', { defaultValue: 'Vérifier le code' })}
        </Button>

        <div className="mt-4.5 text-center text-[12.5px] text-muted">
          <Link to="/login" className="cursor-pointer transition-colors hover:text-ink">
            {t('auth.recover.form.backToLogin')}
          </Link>
        </div>
      </form>
    </>
  );
}
