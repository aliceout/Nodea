import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  PASSWORD_MIN_LENGTH,
  type PasswordRulesCheck,
} from '@nodea/shared';

import { cn } from '@/lib/utils';
import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import PasswordRulesList from '@/ui/atoms/auth/PasswordRulesList';
import StrengthBar from '@/ui/atoms/auth/StrengthBar';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';

interface FormPanelProps {
  email: string;
  setEmail: (next: string) => void;
  mnemonic: string;
  setMnemonic: (next: string) => void;
  password: string;
  setPassword: (next: string) => void;
  confirm: string;
  setConfirm: (next: string) => void;
  rules: PasswordRulesCheck;
  rulesOk: boolean;
  strength: { score: number; warning: string | null } | null;
  confirmMismatch: boolean;
  wordCount: number;
  emailLooksValid: boolean;
  error: string | null;
  submitting: boolean;
  canSubmit: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

/**
 * « Récupérer avec un code » form — collects email, the 12-word
 * BIP39 mnemonic, and a new password (typed twice). Live
 * validation drives the submit gate via `canSubmit` from the
 * orchestrator ; the `<PasswordRulesList>` + `<StrengthBar>` row
 * mirrors what `Register.tsx` and `ChangePassword.tsx` show, so
 * the password feedback experience stays consistent across
 * every surface that asks for a password.
 *
 * The mnemonic textarea is intentionally bare (not a 12-cell
 * grid) — pasting from a password manager into 12 separate
 * inputs is friction the user doesn't need, and we already
 * count words on the live `wordCount` line below the field.
 */
export default function FormPanel(props: FormPanelProps) {
  const {
    email,
    setEmail,
    mnemonic,
    setMnemonic,
    password,
    setPassword,
    confirm,
    setConfirm,
    rules,
    rulesOk,
    strength,
    confirmMismatch,
    wordCount,
    emailLooksValid,
    error,
    submitting,
    canSubmit,
    onSubmit,
  } = props;

  return (
    <>
      <AuthPanelHeader
        eyebrow="Récupération"
        title="Récupérer avec un code"
        subtitle={
          <>
            Tape ton e-mail, tes 12 mots de récupération, et un nouveau mot de passe.
            Tes données restent intactes.
          </>
        }
      />

      <form onSubmit={onSubmit} noValidate>
        <Field
          label="E-mail"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          error={
            email && !emailLooksValid ? 'Format e-mail invalide.' : undefined
          }
        />

        <div className="mb-3.5">
          <label
            htmlFor="recover-mnemonic"
            className="mb-1.25 block text-[12px] font-medium text-muted"
          >
            12 mots de récupération
          </label>
          <textarea
            id="recover-mnemonic"
            value={mnemonic}
            onChange={(e) => setMnemonic(e.target.value)}
            placeholder="Sépare les mots par des espaces — la casse n’a pas d’importance."
            rows={3}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            className={cn(
              'w-full resize-none rounded-md border border-hair bg-bg px-3 py-2.5 font-mono text-[13px] text-ink',
              'outline-none transition-[border-color,box-shadow]',
              'focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--color-k-accent-soft)]',
            )}
          />
          <p className="mt-1 text-[11px] text-muted">
            {wordCount} / 12 mots
            {wordCount > 0 && wordCount !== 12
              ? ' — il en faut exactement 12.'
              : null}
          </p>
        </div>

        <Field
          label="Nouveau mot de passe"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={PASSWORD_MIN_LENGTH}
          required
        />
        <PasswordRulesList rules={rules} />
        {strength ? (
          <StrengthBar
            score={strength.score as 0 | 1 | 2 | 3 | 4}
            warning={strength.warning}
            rulesOk={rulesOk}
          />
        ) : null}

        <Field
          label="Confirmer le mot de passe"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          error={
            confirmMismatch
              ? 'Les deux mots de passe ne correspondent pas.'
              : undefined
          }
        />

        {error ? <InlineAlert className="mb-3">{error}</InlineAlert> : null}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={!canSubmit}
          className="mt-2 w-full"
        >
          {submitting ? 'Récupération…' : 'Récupérer mon compte'}
        </Button>

        <div className="mt-4.5 text-center text-[12.5px] text-muted">
          <Link to="/login" className="cursor-pointer transition-colors hover:text-ink">
            ← Retour à la connexion
          </Link>
        </div>
      </form>
    </>
  );
}
