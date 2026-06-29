import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { apiErrorMessage, isApiError } from '@/core/api/client';
import { useSession } from '@/core/auth/use-session';
import { normaliseMnemonic } from '@/core/crypto/bip39';
import { selectUser, useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { useDocumentTitle } from '@/lib/use-document-title';
import Button from '@/ui/atoms/dirk/Button';
import Textarea from '@/ui/atoms/dirk/Textarea';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import AuthLayout from '@/ui/dirk/auth/AuthLayout';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';

/**
 * `/recovery-reverify` — periodic re-verification of the recovery phrase
 * (Auth-Roadmap Phase 3B, Auth-Spec §7.7).
 *
 * Reached from the non-dismissable sidebar tip when `recoveryReverifyDue`
 * flips true (server backoff ladder 6 wk → 3 mo → 6 mo → 1 yr). The
 * authenticated user re-types their EXISTING 12-word phrase; the client
 * validates the BIP39 checksum, derives `SHA-256(entropy)` and POSTs only
 * the hash. A match bumps the streak + stamps the anchor server-side, the
 * tip clears, and we drop the user back on `/flow`.
 *
 * Distinct from `/recovery-code` (which GENERATES a phrase, needs the
 * password + a KEK unwrap) and `/recover` (logged-out password recovery).
 * This one touches no crypto material — just proves possession of the
 * phrase. Failure is a calm escalation, never a lockout: we offer
 * « regenerate » (→ `/recovery-code`) for a genuinely-lost phrase, and a
 * « later » exit so it never hard-blocks the app.
 */
export default function RecoveryReverifyPage() {
  const { t } = useI18n();
  useDocumentTitle(t('auth.recoveryReverify.docTitle'));
  const navigate = useNavigate();
  const session = useSession();
  const user = useNodeaStore(selectUser);

  const [mnemonic, setMnemonic] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedOnce, setFailedOnce] = useState(false);

  // No code on file → nothing to re-verify ; route them to set one up
  // (the red data-loss banner drives the same destination).
  useEffect(() => {
    if (user && user.recoveryCodeSet === false) {
      navigate('/recovery-code', { replace: true });
    }
  }, [user, navigate]);

  // Count via the shared normaliser so the gate accepts the same
  // separators the hash derivation does — spaces OR hyphens.
  const wordCount = normaliseMnemonic(mnemonic).split(' ').filter(Boolean).length;
  const canSubmit = !submitting && wordCount === 12;

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      await session.reverifyRecoveryCode(mnemonic);
      setMnemonic('');
      navigate('/flow', { replace: true });
    } catch (err) {
      // Bad shape (client checksum) and server hash mismatch both surface
      // as one « code invalide » — no oracle on which leg missed.
      const isWrongCode =
        (err instanceof Error && err.message === 'invalid_recovery_code') ||
        (isApiError(err) && err.error === 'invalid_credentials');
      if (isWrongCode) {
        setError(
          t('errors.recovery.invalidCode', {
            defaultValue: 'Code de récupération invalide.',
          }),
        );
        // Surface the calm regenerate escalation after the first miss.
        setFailedOnce(true);
      } else {
        setError(apiErrorMessage(err, t));
        if (import.meta.env.DEV) console.warn('recovery-reverify failed', err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      headline={t('auth.recoveryReverify.headline')}
      maxWidth="420"
      marketing={
        <>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            {t('auth.recoveryReverify.marketing.p1')}
          </p>
          <p className="text-[18px] leading-[1.5] text-ink-soft">
            {t('auth.recoveryReverify.marketing.p2')}
          </p>
        </>
      }
    >
      <AuthPanelHeader
        eyebrow={t('auth.recoveryReverify.eyebrow')}
        title={t('auth.recoveryReverify.title')}
        subtitle={t('auth.recoveryReverify.subtitle')}
      />

      <form onSubmit={onSubmit} noValidate>
        <div className="mb-3.5">
          <label
            htmlFor="reverify-mnemonic"
            className="mb-1.25 block text-[12px] font-medium text-muted"
          >
            {t('auth.recoveryReverify.mnemonicLabel')}
          </label>
          <Textarea
            id="reverify-mnemonic"
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
            ? t('auth.recoveryReverify.submitting')
            : t('auth.recoveryReverify.submit')}
        </Button>

        {failedOnce ? (
          <p className="mt-4 text-center text-[12.5px] text-muted">
            {t('auth.recoveryReverify.regenerate.prompt')}{' '}
            <Link
              to="/recovery-code"
              className="cursor-pointer font-medium transition-colors hover:text-ink"
            >
              {t('auth.recoveryReverify.regenerate.cta')}
            </Link>
          </p>
        ) : null}

        <div className="mt-4.5 text-center text-[12.5px] text-muted">
          <Link to="/flow" className="cursor-pointer transition-colors hover:text-ink">
            {t('auth.recoveryReverify.later')}
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
