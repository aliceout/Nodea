import { useState, type FormEvent } from 'react';
import type { SecurityMode } from '@nodea/shared';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';

/**
 * Inline « confirm with your password » form (REFACTO-12 split)
 * shown after the user picks a target mode in `ModeSelector`. The
 * matrice de re-auth (§6) requires a fresh password proof for
 * every mode change, so we collect it here before calling
 * `session.changeSecurityMode`.
 *
 * Single-field form → kept on `useState` (CLAUDE.md § Forms :
 * « 1 seul champ → useState OK, RHF est overkill »). The parent
 * owns the submit handler so it can resolve the page-specific
 * error messages (`totp_required`, `passkey_required`) inline.
 */
export default function PasswordProofForm({
  targetMode,
  targetLabel,
  submitting,
  onConfirm,
  onCancel,
}: {
  targetMode: SecurityMode;
  targetLabel: string;
  submitting: boolean;
  onConfirm: (password: string) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [password, setPassword] = useState('');

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!password) return;
    await onConfirm(password);
    setPassword('');
  }

  // `targetMode` is unused at runtime — the label string carries
  // the user-visible text — but keeping it in the props makes the
  // parent's intent explicit and lets a future i18n pass key off
  // the discriminated union if needed.
  void targetMode;

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-3">
      <p className="mb-2 text-[12.5px] text-ink-soft">
        {t('auth.securityMode.passwordProof.instructionBefore')}
        <strong className="font-semibold text-ink">{targetLabel}</strong>
        {t('auth.securityMode.passwordProof.instructionAfter')}
      </p>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        placeholder={t('auth.securityMode.passwordProof.passwordPlaceholder')}
        autoFocus
        className="mb-2 w-full rounded-md border border-hair bg-bg px-3 py-2 text-[13px] text-ink outline-none transition-[border-color,box-shadow] focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--color-k-accent-soft)]"
      />
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={submitting || !password}
          className="flex-1"
        >
          {submitting ? '…' : t('common.actions.confirm')}
        </Button>
        <Button
          type="button"
          variant="neutral"
          size="md"
          onClick={onCancel}
          disabled={submitting}
        >
          {t('common.actions.cancel')}
        </Button>
      </div>
    </form>
  );
}
