import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as zxcvbnCommon from '@zxcvbn-ts/language-common';

import { cn } from '@/lib/utils';
import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';

zxcvbnOptions.setOptions({
  dictionary: zxcvbnCommon.dictionary,
  graphs: zxcvbnCommon.adjacencyGraphs,
});

const ResetFormSchema = z
  .object({
    password: z.string().min(12),
    confirm: z.string().min(1),
    acknowledged: z.literal(true),
  })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'Les deux mots de passe ne correspondent pas.',
  });
type ResetFormValues = z.infer<typeof ResetFormSchema>;

/**
 * Destructive reset form — new password (typed twice) +
 * acknowledgement checkbox.
 *
 * Migrated to React Hook Form + Zod resolver as part of REFACTO-06.
 * Doesn't surface the full `<PasswordRulesList>` + `<StrengthBar>`
 * rig because the reset flow is intentionally a destructive « last
 * resort » : the `password ≥ 12 chars` + `zxcvbn ≥ 3` gate is
 * enough, the educational rule checklist would feel out of place
 * next to the danger banner.
 *
 * The acknowledgement checkbox is the user's last-chance gate
 * against accidental clicks — without it ticked (Zod
 * `z.literal(true)`), submission stays blocked even when the
 * password is strong.
 *
 * The crypto-heavy submission stays in the parent — the form
 * just calls `onValidSubmit(password)` on a clean validation. The
 * parent handles the OPAQUE registration + AES-GCM wraps + the
 * `submitting` / `error` state so the form stays presentation +
 * form state only.
 */
export default function ResetForm({
  submitting,
  error,
  onValidSubmit,
}: {
  submitting: boolean;
  error: string | null;
  onValidSubmit: (password: string) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<ResetFormValues>({
    resolver: zodResolver(ResetFormSchema),
    mode: 'onChange',
    defaultValues: { password: '', confirm: '', acknowledged: false as never },
  });

  const password = watch('password');
  const strength = useMemo(() => {
    if (!password) return null;
    const { score, feedback } = zxcvbn(password);
    return { score, warning: feedback.warning ?? null };
  }, [password]);
  const strengthOk = (strength?.score ?? 0) >= 3;

  async function onSubmit(values: ResetFormValues): Promise<void> {
    if (!strengthOk) return;
    await onValidSubmit(values.password);
  }

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

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field
          label="Nouveau mot de passe (≥ 12 caractères)"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          error={errors.password?.message}
          legend={
            strength ? (
              <span className={cn(strengthOk ? 'text-accent-deep' : 'text-muted')}>
                Force : {strength.score} / 4
                {strength.warning ? ` — ${strength.warning}` : ''}
              </span>
            ) : undefined
          }
          {...register('password')}
        />
        <Field
          label="Confirmation"
          type="password"
          autoComplete="new-password"
          required
          error={errors.confirm?.message}
          {...register('confirm')}
        />

        <label className="mb-3.5 flex items-start gap-2 text-[12.5px] text-ink-soft">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 cursor-pointer rounded-sm border border-hair accent-accent"
            {...register('acknowledged')}
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
          disabled={!isValid || !strengthOk || submitting}
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
