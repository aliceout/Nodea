import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { cn } from '@/lib/utils';
import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';

interface ResetFormProps {
  password: string;
  setPassword: (next: string) => void;
  confirm: string;
  setConfirm: (next: string) => void;
  passwordsMatch: boolean;
  strength: { score: number; warning: string | null } | null;
  acknowledged: boolean;
  setAcknowledged: (next: boolean) => void;
  error: string | null;
  submitting: boolean;
  canSubmit: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

/**
 * Destructive reset form — new password (typed twice) +
 * acknowledgement checkbox. Doesn't surface the full
 * `<PasswordRulesList>` + `<StrengthBar>` rig because the reset
 * flow is intentionally a destructive « last resort » : the
 * `password ≥ 12 chars` + `zxcvbn ≥ 3` gate is enough for the
 * orchestrator to accept the submission, the educational rule
 * checklist would feel out of place next to the danger banner.
 *
 * The acknowledgement checkbox is the user's last-chance gate
 * against accidental clicks — without it ticked, the submit
 * button stays disabled even when the password is strong.
 */
export default function ResetForm(props: ResetFormProps) {
  const {
    password,
    setPassword,
    confirm,
    setConfirm,
    passwordsMatch,
    strength,
    acknowledged,
    setAcknowledged,
    error,
    submitting,
    canSubmit,
    onSubmit,
  } = props;

  return (
    <>
      <p className="mb-1 text-[13px] text-muted">Réinitialisation</p>
      <h2 className="mb-5 text-[24px] font-semibold tracking-[-0.02em] text-ink">
        Choisis un nouveau mot de passe.
      </h2>

      {/* The destructive warning lives here in the form column
          rather than as a body line in the marketing panel —
          it's actionable, the user needs to read it right
          before clicking submit. K · Sauge danger tone
          (border-l, danger/5 wash). */}
      <div
        role="alert"
        className="mb-4 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[12.5px] text-danger"
      >
        <p className="font-semibold">Perte définitive de données</p>
        <p className="mt-1 text-ink-soft">
          La clé qui chiffre tes entrées dérive du mot de passe. Comme l’ancienne clé
          a été perdue avec l’ancien mot de passe, toutes tes entrées existantes
          seront supprimées au moment de la validation.
        </p>
      </div>

      <form onSubmit={onSubmit} noValidate>
        <Field
          label="Nouveau mot de passe (≥ 12 caractères)"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={12}
          required
          legend={
            strength ? (
              <span
                className={cn(
                  strength.score >= 3 ? 'text-accent-deep' : 'text-muted',
                )}
              >
                Force : {strength.score} / 4
                {strength.warning ? ` — ${strength.warning}` : ''}
              </span>
            ) : undefined
          }
        />
        <Field
          label="Confirmation"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          error={
            confirm && !passwordsMatch
              ? 'Les deux mots de passe ne correspondent pas.'
              : undefined
          }
        />

        <label className="mb-3.5 flex items-start gap-2 text-[12.5px] text-ink-soft">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 h-4 w-4 cursor-pointer rounded-sm border border-hair accent-accent"
          />
          <span>
            Je comprends que toutes mes données existantes seront supprimées lors de
            cette réinitialisation.
          </span>
        </label>

        {error ? <InlineAlert className="mb-3">{error}</InlineAlert> : null}

        <Button
          type="submit"
          variant="danger-outline"
          size="lg"
          disabled={!canSubmit}
          className="mt-2 w-full"
        >
          {submitting ? 'Réinitialisation…' : 'Réinitialiser et effacer mes données'}
        </Button>

        <div className="mt-[18px] text-center text-[12.5px] text-muted">
          <Link to="/login" className="cursor-pointer transition-colors hover:text-ink">
            ← Annuler
          </Link>
        </div>
      </form>
    </>
  );
}
